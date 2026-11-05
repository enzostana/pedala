import { pool, init } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await init();
    await pool.query("SELECT 1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
