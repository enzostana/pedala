import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: process.env.E2E_URL || "https://pedala.enzostana.space",
    browserName: "chromium",
    headless: true,
  },
  reporter: "list",
});
