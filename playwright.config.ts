import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  timeout: 30000,
  expect: { timeout: 5000 },
  workers: 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.EOILES_BASE_URL || "http://127.0.0.1:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: process.env.PW_CHANNEL || undefined,
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        channel: process.env.PW_CHANNEL || undefined,
      },
    },
    {
      name: "webkit",
      // Windows WebKit 的驱动响应偶发超过 5 秒；不改变被测应用的转换时序。
      timeout: 60000,
      expect: { timeout: 15000 },
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: process.env.EOILES_BASE_URL || "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
