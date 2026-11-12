import { openHudOptions } from "./hud-helper";
import { test, expect } from "@playwright/test";
test("landing, demo isolada, viagem persistente, devolução e QR imprimível", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "O Rio é seu. Vai de PedaLá." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Experimentar agora" }).click();
  await expect(
    page.getByText("DEMONSTRAÇÃO GUIADA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código da bicicleta").fill("PDL-001");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(
    page.locator(".ridehud").getByText("VIAGEM EM ANDAMENTO", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".ridehud").getByText("VIAGEM EM ANDAMENTO", { exact: true }),
  ).toBeVisible();
  await openHudOptions(page);
  await page.getByLabel("Escolher estação para devolver").selectOption("6");
  await page
    .getByRole("button", { name: "Confirmar devolução simulada" })
    .click();
  await expect(
    page.getByText("Bicicleta devolvida. Obrigado por pedalar!"),
  ).toBeVisible();
  await expect(page.locator(".trip")).toHaveCount(1);
  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(page.locator(".trip")).toHaveCount(0);
  await page.goto("/bikes/PDL-001");
  await expect(page.getByLabel("Código da bicicleta")).toHaveValue("PDL-001");
  await page.goto("/cards");
  await expect(page.locator(".qrcard")).toHaveCount(28);
});
test("celular não tem overflow e mapa e lista são acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app?demo=1");
  await expect(page.locator(".station")).toHaveCount(7);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".map-pin")).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/pedala-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({ path: "/tmp/pedala-desktop.png", fullPage: true });
});
test("localização, UVA, filtros e ampliação", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: -22.9118129,
    longitude: -43.2213347,
    accuracy: 20,
  });
  await page.goto("/app?demo=1");
  await expect(
    page.getByText("Distâncias aproximadas em linha reta.", { exact: false }),
  ).toBeVisible();
  const first = page.locator(".station").first();
  await expect(first.getByRole("heading")).toHaveText(
    "UVA — Rua Ibituruna, 108",
  );
  await expect(first.locator(".stationid")).toHaveText("Estação 07");
  await first.click();
  await expect(page.getByRole("link", { name: "Como chegar" })).toHaveAttribute(
    "href",
    /destination=-22.9118129,-43.2213347/,
  );
  await page
    .getByRole("button", { name: "Com bicicletas", exact: true })
    .click();
  await expect(page.locator(".station")).toHaveCount(6);
  await page.getByRole("button", { name: "Com vagas", exact: true }).click();
  await expect(page.locator(".station")).toHaveCount(6);
  await page.getByRole("button", { name: "Ampliar mapa" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ampliar mapa" }),
  ).toBeFocused();
});
for (const code of [1, 2, 3])
  test(`geolocalização falha ${code}: estações continuam acessíveis`, async ({
    page,
  }) => {
    await page.addInitScript((code) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (
            _s: unknown,
            error: (e: { code: number }) => void,
          ) => error({ code }),
        },
      });
    }, code);
    await page.goto("/app");
    await expect(
      page.getByRole("status").filter({
        hasText:
          code === 1
            ? "Localização não autorizada"
            : "Não foi possível obter sua localização",
      }),
    ).toBeVisible();
    await expect(page.locator(".station")).toHaveCount(7);
    await page.getByRole("button", { name: "Ir para UVA" }).click();
    await expect(page.locator(".map-pin")).toHaveCount(7);
  });
test("sete imagens ilustrativas disponíveis e leves", async ({ page }) => {
  for (let id = 1; id <= 7; id++) {
    const r = await page.request.get("/stations/" + id + ".webp");
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["content-type"]).toContain("image/webp");
    expect((await r.body()).length).toBeLessThan(250 * 1024);
  }
  await page.goto("/app");
  await page.locator(".station").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".stationphoto").last()).toBeVisible();
  expect(
    await page
      .locator(".stationphoto")
      .last()
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
});
