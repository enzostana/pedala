import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeValhalla,
  projectRoute,
  remainingMeters,
  maneuverArrow,
} from "../lib/navigation";
import { containsMunicipality } from "../lib/municipality";
test("decodifica geometria com precisão 6 e detecta dados incompletos", () => {
  assert.deepEqual(decodeValhalla("_c`|@_gayB"), [[2, 1]]);
  assert.throws(() => decodeValhalla("_"));
});
test("projeta progresso e distância restante em geometria real", () => {
  const coords = [
    [-43.22, -22.91],
    [-43.219, -22.91],
    [-43.218, -22.91],
  ];
  const p = projectRoute({ lng: -43.2195, lat: -22.91 }, coords);
  assert.ok(p.offRoute < 1);
  assert.equal(p.index, 0);
  assert.ok(p.fraction > 0.49 && p.fraction < 0.51);
  assert.ok(remainingMeters(coords, p.index, p.fraction) > 150);
  assert.ok(
    projectRoute({ lng: -43.2195, lat: -22.909 }, coords).offRoute > 100,
  );
  assert.ok(projectRoute({ lng: -43.2198, lat: -22.91 }, coords, 1).index >= 1);
});
test("limites administrativos incluem polígonos e respeitam buracos", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
    ],
  };
  assert.equal(containsMunicipality({ lng: 0.5, lat: 0.5 }, geometry), true);
  assert.equal(containsMunicipality({ lng: 1.5, lat: 1.5 }, geometry), false);
  assert.equal(containsMunicipality({ lng: 5, lat: 5 }, geometry), false);
});

test("setas acompanham o tipo de manobra e o sentido inicial", () => {
  assert.equal(maneuverArrow(1, "Pedale para sudoeste em Rua A"), "↙");
  assert.equal(maneuverArrow(10, "Vire à direita"), "↱");
  assert.equal(maneuverArrow(15, "Vire à esquerda"), "↰");
  assert.equal(maneuverArrow(26, "Entre na rotatória"), "⟳");
});
