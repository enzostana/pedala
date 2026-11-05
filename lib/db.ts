import { Pool, PoolClient } from "pg";
import { randomBytes } from "crypto";
import { catalog } from "./stations";
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
export const places: readonly (readonly [string, number, number])[] =
  catalog.map((s) => [s.name, s.lat, s.lng] as const);
export async function migrateUva(c: PoolClient) {
  await c.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version int PRIMARY KEY)",
  );
  const applied = await c.query(
    "SELECT version FROM schema_migrations WHERE version=1",
  );
  if (applied.rowCount) return;
  const scenarios = await c.query("SELECT id FROM scenarios");
  const uva = catalog[6];
  for (const row of scenarios.rows) {
    await c.query(
      "INSERT INTO stations VALUES($1,7,$2,$3,$4,8) ON CONFLICT DO NOTHING",
      [row.id, uva.name, uva.lat, uva.lng],
    );
    for (let n = 25; n <= 28; n++)
      await c.query(
        "INSERT INTO bikes VALUES($1,$2,7) ON CONFLICT DO NOTHING",
        [row.id, "PDL-" + String(n).padStart(3, "0")],
      );
  }
  await c.query("INSERT INTO schema_migrations VALUES(1)");
}
let ready: Promise<void> | undefined;
export function init() {
  return (ready ??= (async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(812311)");
      await c.query(`
CREATE TABLE IF NOT EXISTS scenarios(id text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS visitors(id text PRIMARY KEY,scenario text REFERENCES scenarios(id),created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS stations(scenario text REFERENCES scenarios(id),id int,name text,lat double precision,lng double precision,capacity int NOT NULL CHECK(capacity>0),PRIMARY KEY(scenario,id));
CREATE TABLE IF NOT EXISTS bikes(scenario text,id text,station int,PRIMARY KEY(scenario,id),FOREIGN KEY(scenario,station) REFERENCES stations(scenario,id));
CREATE TABLE IF NOT EXISTS trips(id bigserial PRIMARY KEY,visitor text REFERENCES visitors(id),scenario text,bike text,origin int,destination int,started_at timestamptz DEFAULT now(),ended_at timestamptz,FOREIGN KEY(scenario,bike) REFERENCES bikes(scenario,id));
CREATE UNIQUE INDEX IF NOT EXISTS one_visitor_trip ON trips(visitor) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_bike_trip ON trips(scenario,bike) WHERE ended_at IS NULL;`);
      await seed(c, "shared");
      await migrateUva(c);
      await c.query(
        "UPDATE stations SET lng=-43.18 WHERE id=4 AND lng IS NULL",
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      ready = undefined;
      throw e;
    } finally {
      c.release();
    }
  })());
}
export async function seed(c: PoolClient, id: string) {
  const inserted = await c.query(
    "INSERT INTO scenarios VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
    [id],
  );
  if (!inserted.rowCount) return;
  let n = 0;
  for (let i = 0; i < places.length; i++) {
    const [name, lat, lng] = places[i];
    await c.query("INSERT INTO stations VALUES($1,$2,$3,$4,$5,8)", [
      id,
      i + 1,
      name,
      lat,
      lng,
    ]);
    for (let j = 0; j < (i === 4 ? 8 : i === 5 ? 0 : 4); j++)
      await c.query("INSERT INTO bikes VALUES($1,$2,$3)", [
        id,
        `PDL-${String(++n).padStart(3, "0")}`,
        i + 1,
      ]);
  }
}
export async function session(cookie?: string) {
  await init();
  if (cookie && /^[a-f0-9]{48}$/.test(cookie)) {
    const r = await pool.query("SELECT * FROM visitors WHERE id=$1", [cookie]);
    if (r.rows.length) return r.rows[0];
  }
  const id = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO visitors(id,scenario) VALUES($1,$2)", [
    id,
    "shared",
  ]);
  return { id, scenario: "shared" };
}
export class UserError extends Error {}
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function start(c: PoolClient, visitor: string, code: string) {
  const v = (
    await c.query("SELECT * FROM visitors WHERE id=$1 FOR UPDATE", [visitor])
  ).rows[0];
  await c.query("SELECT id FROM scenarios WHERE id=$1 FOR UPDATE", [
    v.scenario,
  ]);
  const active = (
    await c.query("SELECT * FROM trips WHERE visitor=$1 AND ended_at IS NULL", [
      visitor,
    ])
  ).rows[0];
  if (active) {
    if (active.bike === code) return active;
    throw new UserError("Você já tem uma viagem em andamento.");
  }
  const b = (
    await c.query(
      "SELECT * FROM bikes WHERE scenario=$1 AND id=$2 FOR UPDATE",
      [v.scenario, code],
    )
  ).rows[0];
  if (!b) throw new UserError("Código de bicicleta não encontrado.");
  if (!b.station) throw new UserError("Esta bicicleta já está em uso.");
  const t = await c.query(
    "INSERT INTO trips(visitor,scenario,bike,origin) VALUES($1,$2,$3,$4) RETURNING *",
    [visitor, v.scenario, code, b.station],
  );
  await c.query("UPDATE bikes SET station=NULL WHERE scenario=$1 AND id=$2", [
    v.scenario,
    code,
  ]);
  return t.rows[0];
}
export async function finish(
  c: PoolClient,
  visitor: string,
  id: number,
  station: number,
) {
  const v = (
    await c.query("SELECT * FROM visitors WHERE id=$1 FOR UPDATE", [visitor])
  ).rows[0];
  await c.query("SELECT id FROM scenarios WHERE id=$1 FOR UPDATE", [
    v.scenario,
  ]);
  const t = (
    await c.query("SELECT * FROM trips WHERE id=$1 AND visitor=$2 FOR UPDATE", [
      id,
      visitor,
    ])
  ).rows[0];
  if (!t) throw new UserError("Viagem não encontrada.");
  if (t.ended_at) return t;
  const s = (
    await c.query("SELECT * FROM stations WHERE scenario=$1 AND id=$2", [
      v.scenario,
      station,
    ])
  ).rows[0];
  if (!s) throw new UserError("Estação não encontrada.");
  const count = Number(
    (
      await c.query(
        "SELECT count(*) FROM bikes WHERE scenario=$1 AND station=$2",
        [v.scenario, station],
      )
    ).rows[0].count,
  );
  if (count >= s.capacity)
    throw new UserError("Estação lotada. Escolha outra estação.");
  await c.query("UPDATE bikes SET station=$1 WHERE scenario=$2 AND id=$3", [
    station,
    v.scenario,
    t.bike,
  ]);
  return (
    await c.query(
      "UPDATE trips SET ended_at=now(),destination=$1 WHERE id=$2 RETURNING *",
      [station, id],
    )
  ).rows[0];
}
