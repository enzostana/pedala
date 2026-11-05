import { NextRequest, NextResponse } from "next/server";
import {
  pool,
  session,
  transaction,
  seed,
  start,
  finish,
  UserError,
} from "@/lib/db";
import { catalog } from "@/lib/stations";
export const dynamic = "force-dynamic";
async function handle(req: NextRequest) {
  try {
    if (
      req.method === "POST" &&
      req.headers.get("origin") !== req.nextUrl.origin &&
      req.headers.get("origin") !== process.env.PUBLIC_URL
    )
      return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
    const v = await session(req.cookies.get("pedala")?.value);
    const path = req.nextUrl.pathname;
    let data: unknown;
    if (req.method === "GET" && path === "/api/state") {
      const stations = await pool.query(
        `SELECT s.*,count(b.id)::int AS available,coalesce(array_agg(b.id ORDER BY b.id) FILTER(WHERE b.id IS NOT NULL),'{}') AS bikes FROM stations s LEFT JOIN bikes b ON b.scenario=s.scenario AND b.station=s.id WHERE s.scenario=$1 GROUP BY s.scenario,s.id ORDER BY s.id`,
        [v.scenario],
      );
      const trips = await pool.query(
        "SELECT * FROM trips WHERE visitor=$1 AND scenario=$2 ORDER BY id DESC LIMIT 50",
        [v.id, v.scenario],
      );
      data = {
        demo: v.scenario !== "shared",
        stations: stations.rows.map((s) => ({
          ...s,
          ...catalog.find((x) => x.id === s.id),
        })),
        trips: trips.rows,
      };
    } else if (req.method === "POST") {
      const b = await req.json();
      if (path === "/api/start") {
        if (typeof b.code !== "string" || !/^PDL-\d{3}$/.test(b.code))
          throw new UserError("Use um código como PDL-001.");
        data = await transaction((c) => start(c, v.id, b.code));
      } else if (path === "/api/finish") {
        if (
          !Number.isInteger(b.station) ||
          !Number.isSafeInteger(Number(b.trip))
        )
          throw new UserError("Devolução inválida.");
        data = await transaction((c) =>
          finish(c, v.id, Number(b.trip), b.station),
        );
      } else if (path === "/api/demo") {
        await transaction(async (c) => {
          await c.query("SELECT id FROM visitors WHERE id=$1 FOR UPDATE", [
            v.id,
          ]);
          if (
            (
              await c.query(
                "SELECT id FROM trips WHERE visitor=$1 AND scenario=$2 AND ended_at IS NULL",
                [v.id, "shared"],
              )
            ).rowCount
          )
            throw new UserError(
              "Devolva sua bicicleta antes de abrir a demonstração.",
            );
          const sc = "demo-" + v.id;
          await seed(c, sc);
          await c.query("DELETE FROM trips WHERE visitor=$1 AND scenario=$2", [
            v.id,
            sc,
          ]);
          await c.query("DELETE FROM bikes WHERE scenario=$1", [sc]);
          let n = 0;
          for (let i = 1; i <= catalog.length; i++)
            for (let j = 0; j < (i === 5 ? 8 : i === 6 ? 0 : 4); j++)
              await c.query("INSERT INTO bikes VALUES($1,$2,$3)", [
                sc,
                `PDL-${String(++n).padStart(3, "0")}`,
                i,
              ]);
          await c.query("UPDATE visitors SET scenario=$1 WHERE id=$2", [
            sc,
            v.id,
          ]);
        });
        data = { ok: true };
      } else if (path === "/api/free") {
        await transaction(async (c) => {
          await c.query("SELECT id FROM visitors WHERE id=$1 FOR UPDATE", [
            v.id,
          ]);
          if (
            (
              await c.query(
                "SELECT id FROM trips WHERE visitor=$1 AND ended_at IS NULL",
                [v.id],
              )
            ).rowCount
          )
            throw new UserError("Conclua a viagem antes de trocar de modo.");
          await c.query("UPDATE visitors SET scenario='shared' WHERE id=$1", [
            v.id,
          ]);
        });
        data = { ok: true };
      } else
        return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    } else
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    const res = NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
    res.cookies.set("pedala", v.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (e) {
    if (e instanceof UserError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    console.error(e);
    return NextResponse.json(
      { error: "Não foi possível concluir. Tente novamente." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST };
