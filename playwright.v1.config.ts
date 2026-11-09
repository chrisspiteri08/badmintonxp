import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/v1-browser",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    channel: "chrome",
    trace: "off",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 360, height: 800 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  reporter: [["list"]],
});
