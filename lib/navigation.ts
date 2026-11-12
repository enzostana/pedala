export function decodeValhalla(encoded: string): number[][] {
  let index = 0,
    lat = 0,
    lon = 0;
  const coordinates: number[][] = [];
  while (index < encoded.length) {
    const read = () => {
      let result = 0,
        shift = 0,
        byte: number;
      do {
        if (index >= encoded.length) throw Error("Trajeto inválido");
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 31) << shift;
        shift += 5;
        if (shift > 30) throw Error("Trajeto inválido");
      } while (byte >= 32);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    lat += read();
    lon += read();
    coordinates.push([lon / 1e6, lat / 1e6]);
  }
  return coordinates;
}
export interface NavigationRoute {
  coordinates: number[][];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: {
    instruction: string;
    type: number;
    begin: number;
    end: number;
    distanceMeters: number;
    durationSeconds: number;
  }[];
}
export function projectRoute(
  position: { lat: number; lng: number },
  coords: number[][],
  previous = 0,
) {
  let best = Infinity,
    bestIndex = previous,
    bestT = 0;
  const scale = Math.cos((position.lat * Math.PI) / 180);
  for (let i = Math.max(0, previous - 4); i < coords.length - 1; i++) {
    const a = coords[i],
      b = coords[i + 1],
      ax = (a[0] - position.lng) * scale,
      ay = a[1] - position.lat,
      bx = (b[0] - position.lng) * scale,
      by = b[1] - position.lat,
      dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)),
    );
    const d = Math.hypot(ax + t * dx, ay + t * dy) * 111195;
    if (d < best) {
      best = d;
      bestIndex = i;
      bestT = t;
    }
  }
  return {
    offRoute: best,
    index: Math.max(previous, bestIndex),
    fraction: bestIndex >= previous ? bestT : 0,
  };
}
export function remainingMeters(
  coords: number[][],
  index: number,
  fraction = 0,
) {
  let total = 0;
  for (let i = Math.min(index, coords.length - 1); i < coords.length - 1; i++) {
    const a = coords[i],
      b = coords[i + 1],
      dy = (b[1] - a[1]) * 111195,
      dx = (b[0] - a[0]) * 111195 * Math.cos(((a[1] + b[1]) * Math.PI) / 360);
    total += Math.hypot(dx, dy) * (i === index ? 1 - fraction : 1);
  }
  return total;
}
export function maneuverArrow(type: number, instruction: string) {
  if ([12, 13].includes(type)) return "↶";
  if ([26, 27].includes(type)) return "⟳";
  if ([2, 5, 9, 10, 11, 18, 20, 23, 37].includes(type)) return "↱";
  if ([3, 6, 14, 15, 16, 19, 21, 24, 38].includes(type)) return "↰";
  if (type === 1) {
    const m = instruction
      .toLocaleLowerCase("pt-BR")
      .match(
        /para (nordeste|noroeste|sudeste|sudoeste|norte|sul|leste|oeste)\b/,
      );
    const arrows: Record<string, string> = {
      norte: "↑",
      sul: "↓",
      leste: "→",
      oeste: "←",
      nordeste: "↗",
      noroeste: "↖",
      sudeste: "↘",
      sudoeste: "↙",
    };
    if (m) return arrows[m[1]];
  }
  return "↑";
}
