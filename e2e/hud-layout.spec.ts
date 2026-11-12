import { test, expect } from "@playwright/test";
test("HUD compacto libera mapa e alterna tema sem inverter marcadores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app?demo=1");
  await expect(
    page.getByText("DEMONSTRAÇÃO GUIADA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código da bicicleta").fill("PDL-001");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.locator(".ridehud")).toBeVisible();
  await expect(page.locator(".hudoptionstoggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect((await page.locator(".hudbottom").boundingBox())!.height).toBeLessThan(
    844 * 0.3,
  );
  await expect(page.locator(".ridehud")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator(".ridehud .leaflet-tile-pane")
      .evaluate((e) => getComputedStyle(e).filter),
  ).not.toBe("none");
  await page.getByRole("button", { name: "Destino e opções" }).click();
  await expect(page.getByLabel("Buscar destino")).toBeVisible();
  await page.getByRole("button", { name: "Recolher opções" }).click();
  await page.getByRole("button", { name: "Usar mapa claro" }).click();
  await expect(page.locator(".ridehud")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator(".ridehud")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Usar mapa escuro" }).click();
  await page.screenshot({ path: "/tmp/pedala-hud-compact.png" });
  await page.getByRole("button", { name: "Destino e opções" }).click();
  await page.getByLabel("Escolher estação para devolver").selectOption("6");
  await page
    .getByRole("button", { name: "Confirmar devolução simulada" })
    .click();
  await expect(
    page.getByText("Bicicleta devolvida. Obrigado por pedalar!"),
  ).toBeVisible();
});
