import { openHudOptions } from "./hud-helper";
import { test, expect } from "@playwright/test";
test.skip(
  process.env.PEDALA_REAL_SERVICES !== "1",
  "Requer os serviços locais de navegação",
);
test("busca endereço e calcula rota real por bicicleta sem chave", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: -22.9118129,
    longitude: -43.2213347,
    accuracy: 8,
  });
  await page.goto("/app?demo=1");
  await expect(
    page.getByText("DEMONSTRAÇÃO GUIADA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código da bicicleta").fill("PDL-001");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(
    page.locator(".ridehud").getByText("GPS ativo", { exact: false }),
  ).toBeVisible();
  await openHudOptions(page);
  await page.getByLabel("Navegar até uma estação").selectOption("4");
  await expect(page.getByText("Rota pronta.", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".hudbottom")).toContainText("Botafogo");
  await expect(page.locator(".hudtop strong")).not.toHaveText(
    "Boa pedalada! ↗",
  );
  await expect(
    page.locator('.ridehud .leaflet-overlay-pane path[stroke="#e66d50"]'),
  ).toHaveCount(1);
  await openHudOptions(page);
  await page.getByLabel("Buscar destino").fill("Avenida Rio Branco");
  await page.getByRole("button", { name: "Buscar destino" }).click();
  await expect(page.locator(".hudresults button").first()).toBeVisible({
    timeout: 15000,
  });
  await page.locator(".hudresults button").first().click();
  await expect(page.getByText("Rota pronta.", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".hudbottom")).toContainText("Avenida Rio Branco");
  await openHudOptions(page);
  await page.getByLabel("Escolher estação para devolver").selectOption("6");
  await page
    .getByRole("button", { name: "Confirmar devolução simulada" })
    .click();
  await expect(
    page.getByText("Bicicleta devolvida. Obrigado por pedalar!"),
  ).toBeVisible();
});
