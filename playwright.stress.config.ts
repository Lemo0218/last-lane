import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mobile.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  projects: [{ name: "stress-mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "VITE_E2E=true corepack pnpm dev --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
})
