import { defineConfig, devices } from "@playwright/test";

// Set PW_CHANNEL=chrome to use an installed Chrome where Playwright's bundled
// Chromium is unavailable (for example older macOS versions).
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Many tests open the WebGL scene; too many at once starves them and causes timeouts.
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      testMatch: "desktop/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel },
    },
    {
      name: "phone",
      testMatch: "phone/**/*.spec.ts",
      use: { ...devices["Pixel 7"], channel },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start --port 3100",
    url: "http://localhost:3100/build",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
