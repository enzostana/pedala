import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  migrateUva,
  init,
  pool,
  session,
  transaction,
  seed,
  start,
  finish,
} from "../lib/db";
before(async () => {
  await init();
});
beforeEach(async () => {
  await pool.query("TRUNCATE trips,visitors,bikes,stations,scenarios CASCADE");
  await transaction((c) => seed(c, "shared"));
});
after(async () => {
  await pool.end();
});
test("retiro, recuperação da sessão, devolução e repetição idempotente", async () => {
  const v = await session();
  assert.equal((await session(v.id)).id, v.id);
  const t = await transaction((c) => start(c, v.id, "PDL-001"));
  assert.equal((await transaction((c) => start(c, v.id, "PDL-001"))).id, t.id);
  assert.equal(
    (
      await pool.query(
        "SELECT station FROM bikes WHERE scenario='shared' AND id='PDL-001'",
      )
    ).rows[0].station,
    null,
  );
  await transaction((c) => finish(c, v.id, Number(t.id), 6));
  await transaction((c) => finish(c, v.id, Number(t.id), 6));
  assert.equal(
    (
      await pool.query(
        "SELECT station FROM bikes WHERE scenario='shared' AND id='PDL-001'",
      )
    ).rows[0].station,
    6,
  );
});
test("duas pessoas não retiram a mesma bike", async () => {
  const a = await session(),
    b = await session();
  const result = await Promise.allSettled([
    transaction((c) => start(c, a.id, "PDL-001")),
    transaction((c) => start(c, b.id, "PDL-001")),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await pool.query("SELECT * FROM trips WHERE ended_at IS NULL")).rowCount,
    1,
  );
});
test("apenas uma devolução ocupa a última vaga", async () => {
  const a = await session(),
    b = await session();
  const ta = await transaction((c) => start(c, a.id, "PDL-001")),
    tb = await transaction((c) => start(c, b.id, "PDL-002"));
  await pool.query(
    "UPDATE stations SET capacity=5 WHERE scenario='shared' AND id=2",
  );
  const result = await Promise.allSettled([
    transaction((c) => finish(c, a.id, Number(ta.id), 2)),
    transaction((c) => finish(c, b.id, Number(tb.id), 2)),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
});
test("rejeita estação cheia, bike inválida e segundo aluguel", async () => {
  const a = await session();
  await assert.rejects(transaction((c) => start(c, a.id, "PDL-999")));
  const t = await transaction((c) => start(c, a.id, "PDL-001"));
  await assert.rejects(transaction((c) => start(c, a.id, "PDL-002")));
  await assert.rejects(transaction((c) => finish(c, a.id, Number(t.id), 5)));
});
test("viagem pertence ao visitante e cenários são isolados", async () => {
  const a = await session(),
    b = await session();
  await transaction((c) => seed(c, "isolated"));
  await pool.query("UPDATE visitors SET scenario=$1 WHERE id=$2", [
    "isolated",
    b.id,
  ]);
  const ta = await transaction((c) => start(c, a.id, "PDL-001"));
  const tb = await transaction((c) => start(c, b.id, "PDL-001"));
  assert.notEqual(ta.id, tb.id);
  await assert.rejects(transaction((c) => finish(c, b.id, Number(ta.id), 6)));
});
test("todas as estações têm coordenadas geográficas válidas", async () => {
  const result = await pool.query(
    "SELECT * FROM stations WHERE scenario='shared'",
  );
  assert.equal(result.rows.length, 7);
  for (const station of result.rows) {
    assert.equal(typeof station.lat, "number");
    assert.equal(typeof station.lng, "number");
    assert.ok(station.lat >= -23.1 && station.lat <= -22.8);
    assert.ok(station.lng >= -43.3 && station.lng <= -43.1);
  }
});
test("migração UVA é idempotente e preserva viagem ativa", async () => {
  const v = await session();
  const t = await transaction((c) => start(c, v.id, "PDL-001"));
  await pool.query(
    "DELETE FROM bikes WHERE id IN ('PDL-025','PDL-026','PDL-027','PDL-028')",
  );
  await pool.query("DELETE FROM stations WHERE id=7");
  await pool.query("DELETE FROM schema_migrations WHERE version=1");
  await transaction((c) => migrateUva(c));
  await transaction((c) => migrateUva(c));
  assert.equal(
    (await pool.query("SELECT * FROM bikes WHERE scenario='shared'")).rowCount,
    28,
  );
  assert.equal(
    (
      await pool.query("SELECT * FROM trips WHERE id=$1 AND ended_at IS NULL", [
        t.id,
      ])
    ).rowCount,
    1,
  );
});
test("API local valida sessão, busca, rota, limite municipal e quota", async (t) => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../app/api/navigation/[action]/route");
  const v = await session();
  await transaction((c) => start(c, v.id, "PDL-001"));
  let routeCalls = 0;
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (input: any, options: any) => {
      const url = new URL(String(input));
      if (url.pathname === "/search" && url.searchParams.has("polygon_geojson"))
        return Response.json([
          {
            name: "Rio de Janeiro",
            geojson: {
              type: "Polygon",
              coordinates: [
                [
                  [-44, -23.2],
                  [-43, -23.2],
                  [-43, -22.6],
                  [-44, -22.6],
                  [-44, -23.2],
                ],
              ],
            },
            address: { city: "Rio de Janeiro" },
          },
        ]);
      if (url.pathname === "/search")
        return Response.json([
          {
            display_name: "Rua Ibituruna, Rio de Janeiro",
            lat: "-22.9118",
            lon: "-43.2213",
            addresstype: "road",
            address: { city: "Rio de Janeiro" },
          },
          {
            display_name: "Niterói",
            lat: "-22.89",
            lon: "-43.12",
            address: { city: "Niterói" },
          },
        ]);
      if (url.pathname === "/route") {
        routeCalls++;
        const body = JSON.parse(options.body);
        assert.equal(body.costing, "bicycle");
        assert.equal(body.language, "pt-BR");
        return Response.json({
          trip: {
            summary: { length: 1.2, time: 300 },
            legs: [
              {
                shape: "_c`|@_gayB??",
                maneuvers: [
                  {
                    instruction: "Siga",
                    type: 1,
                    begin_shape_index: 0,
                    end_shape_index: 1,
                    length: 1.2,
                    time: 300,
                  },
                ],
              },
            ],
          },
        });
      }
      throw Error("Unexpected URL");
    },
  );
  const call = (action: string, body: any, cookie = v.id) =>
    POST(
      new NextRequest("http://localhost/api/navigation/" + action, {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
          cookie: "pedala=" + cookie,
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ action }) },
    );
  const search = await call("search", { text: "Ibituruna" });
  assert.equal(search.status, 200);
  const results = (await search.json()).results;
  assert.ok(results.some((x: any) => x.name.includes("Ibituruna")));
  assert.ok(!results.some((x: any) => x.name === "Niterói"));
  assert.equal((await call("search", { text: "ab" })).status, 400);
  assert.equal(
    (await call("search", { text: "rua" }, "bad-cookie")).status,
    403,
  );
  const origin = { lat: -22.9118, lng: -43.2213 },
    destination = { lat: -22.92, lng: -43.2 };
  assert.equal(
    (await call("route", { origin, destination: { lat: -10, lng: -60 } }))
      .status,
    400,
  );
  const route = await call("route", { origin, destination });
  assert.equal(route.status, 200);
  const data = await route.json();
  assert.equal(data.distanceMeters, 1200);
  assert.equal(data.durationSeconds, 300);
  assert.equal(data.maneuvers[0].instruction, "Siga");
  assert.equal(data.coordinates.length, 2);
  assert.equal(routeCalls, 1);
  assert.equal((await call("route", { origin, destination })).status, 200);
  assert.equal((await call("route", { origin, destination })).status, 200);
  assert.equal((await call("route", { origin, destination })).status, 429);
  mock.mock.restore();
});
