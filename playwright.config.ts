import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const useExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev -- -p 3000",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] }
    }
  ]
});
