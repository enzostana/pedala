import { NextRequest } from "next/server";
import { session, pool } from "@/lib/db";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.PUBLIC_URL
  )
    return Response.json({ error: "Origem inválida" }, { status: 403 });
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key)
    return Response.json(
      { error: "Navegação indisponível: chave Geoapify não configurada." },
      { status: 503 },
    );
  try {
    const v = await session(req.cookies.get("pedala")?.value);
    if (
      !(
        await pool.query(
          "SELECT id FROM trips WHERE visitor=$1 AND ended_at IS NULL",
          [v.id],
        )
      ).rowCount
    )
      return Response.json({ error: "Inicie uma viagem." }, { status: 403 });
    const { action } = await params;
    const b = await req.json();
    let url: URL;
    if (action === "search") {
      if (
        typeof b.text !== "string" ||
        b.text.length < 3 ||
        b.text.length > 200
      )
        return Response.json({ error: "Endereço inválido" }, { status: 400 });
      url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
      url.searchParams.set("text", b.text + ", Rio de Janeiro");
      url.searchParams.set("filter", "countrycode:br");
      url.searchParams.set("limit", "5");
      url.searchParams.set("lang", "pt");
    } else if (action === "route") {
      for (const p of [b.origin, b.destination])
        if (
          !p ||
          !Number.isFinite(p.lat) ||
          !Number.isFinite(p.lng) ||
          Math.abs(p.lat) > 90 ||
          Math.abs(p.lng) > 180
        )
          return Response.json(
            { error: "Coordenadas inválidas" },
            { status: 400 },
          );
      url = new URL("https://api.geoapify.com/v1/routing");
      url.searchParams.set(
        "waypoints",
        `${b.origin.lat},${b.origin.lng}|${b.destination.lat},${b.destination.lng}`,
      );
      url.searchParams.set("mode", "bicycle");
    } else return Response.json({ error: "Não encontrado" }, { status: 404 });
    url.searchParams.set("apiKey", key);
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!r.ok)
      return Response.json(
        { error: "Serviço de navegação indisponível." },
        { status: 503 },
      );
    const data = await r.json();
    if (action === "search")
      return Response.json(
        {
          results: data.features
            .filter((f: any) => f.properties.city === "Rio de Janeiro")
            .map((f: any) => ({
              name: f.properties.formatted,
              lat: f.properties.lat,
              lng: f.properties.lon,
            })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Não foi possível calcular a navegação." },
      { status: 503 },
    );
  }
}
