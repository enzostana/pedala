import { test, expect } from "@playwright/test";
test("HUD segue rota, recalcula desvio, restaura destino e mantém aluguel ativo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let offset = 0;
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + offset;
    let watch: ((p: any) => void) | undefined;
    const make = (lat: number, lng: number) => ({
      coords: { latitude: lat, longitude: lng, accuracy: 5 },
      timestamp: Date.now(),
    });
    const initial = () => make(-22.9118129, -43.2213347);
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (ok: any) => setTimeout(() => ok(initial()), 0),
        watchPosition: (ok: any) => {
          watch = ok;
          setTimeout(() => ok(initial()), 0);
          return 1;
        },
        clearWatch: () => {
          watch = undefined;
        },
      },
    });
    (window as any).gpsPoint = (lat: number, lng: number, advance: number) => {
      offset += advance;
      watch?.(make(lat, lng));
    };
  });
  let calls = 0;
  await page.route("**/api/navigation/search", (r) =>
    r.fulfill({
      json: {
        results: [
          { name: "Destino de teste", lat: -22.9118129, lng: -43.2193347 },
        ],
      },
    }),
  );
  await page.route("**/api/navigation/route", (r) => {
    calls++;
    return r.fulfill({
      json: {
        coordinates: [
          [-43.2213347, -22.9118129],
          [-43.2203347, -22.9118129],
          [-43.2193347, -22.9118129],
        ],
        distanceMeters: 205,
        durationSeconds: 80,
        maneuvers: [
          {
            instruction: "Siga pela Rua Ibituruna",
            type: 1,
            begin: 0,
            end: 1,
            distanceMeters: 102,
            durationSeconds: 40,
          },
          {
            instruction: "Vire à direita",
            type: 10,
            begin: 1,
            end: 2,
            distanceMeters: 103,
            durationSeconds: 40,
          },
        ],
      },
    });
  });
  await page.goto("/app?demo=1");
  await expect(
    page.getByText("DEMONSTRAÇÃO GUIADA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código da bicicleta").fill("PDL-001");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.locator(".ridehud")).toBeVisible();
  await page.getByLabel("Buscar destino").fill("teste");
  await page.getByRole("button", { name: "Buscar destino" }).click();
  await page.getByRole("button", { name: "Destino de teste" }).click();
  await expect(page.getByText("Rota pronta.", { exact: false })).toBeVisible();
  await expect(
    page.locator('.ridehud .leaflet-overlay-pane path[stroke="#e66d50"]'),
  ).toHaveCount(1);
  await expect(page.locator(".hudtop")).toContainText(
    "Siga pela Rua Ibituruna",
  );
  await page.evaluate(() => (window as any).gpsPoint(-22.9108, -43.2213, 0));
  await page.evaluate(() => (window as any).gpsPoint(-22.9108, -43.2213, 6000));
  await page.evaluate(() => (window as any).gpsPoint(-22.9108, -43.2213, 5000));
  await expect.poll(() => calls).toBe(2);
  await page.reload();
  await expect(page.locator(".ridehud")).toBeVisible();
  await expect.poll(() => calls).toBe(3);
  await expect(page.locator(".hudbottom")).toContainText("Destino de teste");
  await page.evaluate(() =>
    (window as any).gpsPoint(-22.9118129, -43.2193347, 0),
  );
  await expect(
    page.getByText("Você chegou ao destino. O aluguel continua ativo.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".ridehud")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar rota" }).click();
  await expect(page.locator(".ridehud")).toBeVisible();
  await page.getByLabel("Escolher estação para devolver").selectOption("6");
  await page
    .getByRole("button", { name: "Confirmar devolução simulada" })
    .click();
  await expect(
    page.getByText("Bicicleta devolvida. Obrigado por pedalar!"),
  ).toBeVisible();
});
test("GPS negado permite escolher destino e devolver sem encerrar antecipadamente", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_ok: any, error: any) =>
          setTimeout(() => error({ code: 1 }), 0),
        watchPosition: (_ok: any, error: any) => {
          setTimeout(() => error({ code: 1 }), 0);
          return 1;
        },
        clearWatch: () => {},
      },
    });
  });
  await page.goto("/app?demo=1");
  await expect(
    page.getByText("DEMONSTRAÇÃO GUIADA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código da bicicleta").fill("PDL-001");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.locator(".ridehud")).toBeVisible();
  await expect(
    page.locator(".ridehud").getByText("GPS indisponível", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Navegar até uma estação").selectOption("7");
  await expect(page.locator(".hudbottom")).toContainText(
    "Aguardando sinal de GPS preciso",
  );
  await expect(page.locator(".hudbottom")).toContainText(
    "UVA — Rua Ibituruna, 108",
  );
  await page.getByRole("button", { name: "Minimizar mapa" }).click();
  await page.getByRole("button", { name: "Voltar à navegação" }).click();
  await expect(page.locator(".hudbottom")).toContainText(
    "UVA — Rua Ibituruna, 108",
  );
  await page.getByLabel("Escolher estação para devolver").selectOption("6");
  await page
    .getByRole("button", { name: "Confirmar devolução simulada" })
    .click();
  await expect(
    page.getByText("Bicicleta devolvida. Obrigado por pedalar!"),
  ).toBeVisible();
});
