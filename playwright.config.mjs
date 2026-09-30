import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/react-parity",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.REACT_E2E_BASE_URL || "http://127.0.0.1:5002",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
