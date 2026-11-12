import type { Page } from "@playwright/test";
export async function openHudOptions(page: Page) {
  const button = page.locator(".hudoptionstoggle");
  if (
    (await button.count()) &&
    (await button.getAttribute("aria-expanded")) === "false"
  )
    await button.click();
}
