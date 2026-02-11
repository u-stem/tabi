import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "docker compose up -d",
      url: "http://localhost:3001/health",
      reuseExistingServer: true,
      cwd: "../..",
    },
    {
      command: "bun run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
    },
  ],
});
