export const catalog = [
  { id: 1, name: "Copacabana", lat: -22.9714, lng: -43.1822 },
  { id: 2, name: "Ipanema", lat: -22.9848, lng: -43.2028 },
  { id: 3, name: "Leblon", lat: -22.984, lng: -43.222 },
  { id: 4, name: "Botafogo", lat: -22.949, lng: -43.18 },
  { id: 5, name: "Flamengo", lat: -22.929, lng: -43.174 },
  { id: 6, name: "Centro", lat: -22.907, lng: -43.178 },
  {
    id: 7,
    name: "UVA — Rua Ibituruna, 108",
    lat: -22.9118129,
    lng: -43.2213347,
  },
].map((s) => ({
  ...s,
  address:
    s.id === 7
      ? "Rua Ibituruna, 108, Tijuca, Rio de Janeiro"
      : s.name + ", Rio de Janeiro",
  image: "/stations/" + s.id + ".webp",
  imageAlt: "Estação fictícia de bicicletas PedaLá em " + s.name,
}));
export interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  available: number;
  bikes: string[];
  address: string;
  image: string;
  imageAlt: string;
}
export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}
export function distance(a: Position, b: { lat: number; lng: number }) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function formatDistance(d: number) {
  return d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km";
}
