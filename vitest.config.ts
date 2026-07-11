import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}", "tests/api/verifier.bench.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", "dev-dist/**", ".worktrees/**"],
    setupFiles: ["./tests/setup.ts"],
  },
})
