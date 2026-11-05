import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
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
test('todas as estações têm coordenadas geográficas válidas',async()=>{const result=await pool.query("SELECT * FROM stations WHERE scenario='shared'");assert.equal(result.rows.length,6);for(const station of result.rows){assert.equal(typeof station.lat,'number');assert.equal(typeof station.lng,'number');assert.ok(station.lat>=-23.1&&station.lat<=-22.8);assert.ok(station.lng>=-43.3&&station.lng<=-43.1);}});
