import { defineConfig, devices } from "@playwright/test"

const continuousIntegrationKey = "CI"

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "mobile.spec.ts",
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command:
      "VITE_E2E=true corepack pnpm build && corepack pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env[continuousIntegrationKey],
  },
})
