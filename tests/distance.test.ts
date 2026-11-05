import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, distance, formatDistance } from "../lib/stations";
test("distâncias em metros, quilômetros e localização fora do Rio", () => {
  const uva = { ...catalog[6], accuracy: 20 };
  assert.equal(distance(uva, uva), 0);
  assert.equal(formatDistance(250), "250 m");
  assert.equal(formatDistance(1250), "1.3 km");
  const saoPaulo = { lat: -23.55, lng: -46.63, accuracy: 10 };
  assert.ok(distance(saoPaulo, uva) > 300000);
  assert.equal(
    [...catalog].sort((a, b) => distance(uva, a) - distance(uva, b))[0].id,
    7,
  );
});
