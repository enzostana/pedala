import { NextRequest } from "next/server";
import { session, pool } from "@/lib/db";
import { catalog } from "@/lib/stations";
import { decodeValhalla } from "@/lib/navigation";
import { rioBoundary, containsMunicipality } from "@/lib/municipality";
const limits = new Map<string, number[]>();
function limited(id: string, action: string) {
  const now = Date.now(),
    key = id + ":" + action;
  for (const [k, v] of limits)
    if (v.every((t) => now - t >= 60000)) limits.delete(k);
  const recent = (limits.get(key) || []).filter((t) => now - t < 60000);
  if (recent.length >= (action === "route" ? 4 : 20)) return true;
  recent.push(now);
  limits.set(key, recent);
  return false;
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.PUBLIC_URL
  )
    return Response.json({ error: "Origem inválida" }, { status: 403 });
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
    const { action } = await params,
      b = await req.json();
    if ((action === "search" || action === "route") && limited(v.id, action))
      return Response.json(
        { error: "Muitas tentativas; aguarde um minuto." },
        { status: 429 },
      );
    if (action === "search") {
      if (
        typeof b.text !== "string" ||
        b.text.trim().length < 3 ||
        b.text.length > 200
      )
        return Response.json(
          { error: "Digite pelo menos três caracteres." },
          { status: 400 },
        );
      const q = b.text.trim();
      const stations = catalog
        .filter((s) =>
          (s.name + " " + s.address)
            .toLocaleLowerCase("pt-BR")
            .includes(q.toLocaleLowerCase("pt-BR")),
        )
        .map((s) => ({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          stationId: s.id,
        }));
      const url = new URL(
        "/search",
        process.env.NOMINATIM_URL || "http://nominatim:8080",
      );
      url.searchParams.set("q", q + ", Rio de Janeiro, RJ, Brasil");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "5");
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error("search");
      const data = await response.json();
      const results = data
        .filter((x: any) => {
          const a = x.address || {};
          return (a.city || a.municipality || a.town) === "Rio de Janeiro";
        })
        .map((x: any) => ({
          name: x.display_name,
          lat: Number(x.lat),
          lng: Number(x.lon),
          approximate: x.addresstype === "road",
        }));
      return Response.json(
        { results: [...stations, ...results].slice(0, 5) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (action === "route") {
      if (
        !b.destination ||
        !Number.isFinite(b.destination.lat) ||
        !Number.isFinite(b.destination.lng)
      )
        return Response.json({ error: "Destino inválido." }, { status: 400 });
      if (!containsMunicipality(b.destination, await rioBoundary()))
        return Response.json(
          {
            error: "Escolha um destino dentro do município do Rio de Janeiro.",
          },
          { status: 400 },
        );
      for (const x of [b.origin, b.destination])
        if (
          !x ||
          !Number.isFinite(x.lat) ||
          !Number.isFinite(x.lng) ||
          x.lat < -23.1 ||
          x.lat > -22.7 ||
          x.lng < -43.85 ||
          x.lng > -43.0
        )
          return Response.json(
            { error: "Posição fora da área de navegação." },
            { status: 400 },
          );
      const url = new URL(
        "/route",
        process.env.VALHALLA_URL || "http://valhalla:8002",
      );
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: [
            { lat: b.origin.lat, lon: b.origin.lng },
            { lat: b.destination.lat, lon: b.destination.lng },
          ],
          costing: "bicycle",
          units: "kilometers",
          language: "pt-BR",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw Error("route");
      const trip = (await res.json()).trip;
      if (!trip?.legs?.length) throw Error("route");
      let coordinates: number[][] = [],
        maneuvers: any[] = [];
      for (const leg of trip.legs) {
        const pts = decodeValhalla(leg.shape);
        const offset = coordinates.length;
        coordinates.push(...pts);
        for (const m of leg.maneuvers || [])
          maneuvers.push({
            instruction: m.instruction,
            type: m.type,
            begin: offset + m.begin_shape_index,
            end: offset + m.end_shape_index,
            distanceMeters: m.length * 1000,
            durationSeconds: m.time,
          });
      }
      return Response.json(
        {
          coordinates,
          distanceMeters: trip.summary.length * 1000,
          durationSeconds: trip.summary.time,
          maneuvers,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  } catch {
    return Response.json(
      { error: "Busca ou rota indisponível. Tente novamente." },
      { status: 503 },
    );
  }
}
