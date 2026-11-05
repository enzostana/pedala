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
    page.getByText("VIAGEM EM ANDAMENTO", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("VIAGEM EM ANDAMENTO", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Onde você vai devolver?").selectOption("6");
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
  await expect(page.locator(".qrcard")).toHaveCount(24);
});
test("celular não tem overflow e mapa e lista são acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app?demo=1");
  await expect(page.locator(".station")).toHaveCount(6);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".map-pin")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/pedala-mobile.png", fullPage: true });
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/");
  await page.screenshot({ path: "/tmp/pedala-desktop.png", fullPage: true });
});
