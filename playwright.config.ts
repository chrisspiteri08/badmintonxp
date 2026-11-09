import { defineConfig } from "@playwright/test";
const baseURL = process.env.DEMO_BASE_URL || "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  use: { baseURL, headless: true, channel: "chrome" },
  projects: [
    { name: "mobile", use: { viewport: { width: 360, height: 800 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  reporter: [["list"]],
});
