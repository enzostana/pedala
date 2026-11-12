type Point = { lat: number; lng: number };
type Polygon = number[][][];
type MultiPolygon = number[][][][];
function ringContains(point: Point, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function containsPolygon(point: Point, polygon: Polygon) {
  return (
    !!polygon.length &&
    ringContains(point, polygon[0]) &&
    !polygon.slice(1).some((r) => ringContains(point, r))
  );
}
export function containsMunicipality(
  point: Point,
  geometry: { type: string; coordinates: Polygon | MultiPolygon },
) {
  if (geometry.type === "Polygon")
    return containsPolygon(point, geometry.coordinates as Polygon);
  if (geometry.type === "MultiPolygon")
    return (geometry.coordinates as MultiPolygon).some((p) =>
      containsPolygon(point, p),
    );
  return false;
}
let cached: { type: string; coordinates: Polygon | MultiPolygon } | undefined;
let pending:
  Promise<{ type: string; coordinates: Polygon | MultiPolygon }> | undefined;
export async function rioBoundary() {
  if (cached) return cached;
  if (pending) return pending;
  pending = fetchRioBoundary().catch((e) => {
    pending = undefined;
    throw e;
  });
  return pending;
}
async function fetchRioBoundary() {
  const url = new URL(
    "/search",
    process.env.NOMINATIM_URL || "http://nominatim:8080",
  );
  for (const [k, v] of Object.entries({
    city: "Rio de Janeiro",
    state: "Rio de Janeiro",
    country: "Brazil",
    format: "jsonv2",
    polygon_geojson: "1",
    addressdetails: "1",
    limit: "10",
  }))
    url.searchParams.set(k, v);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Limite municipal indisponível");
  const data = await response.json();
  const found = data.find(
    (x: any) =>
      x.geojson &&
      ["Polygon", "MultiPolygon"].includes(x.geojson.type) &&
      (x.address?.city === "Rio de Janeiro" || x.name === "Rio de Janeiro"),
  );
  if (!found) throw Error("Limite municipal indisponível");
  cached = found.geojson;
  return cached!;
}
