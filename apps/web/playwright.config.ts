import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
// Browser verification may create accounts only on the dedicated local backend.
for (const [name, expected] of Object.entries({
  NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
  NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3211",
})) {
  if (process.env[name] !== expected)
    throw new Error(
      `E2E requires ${name} to point to the local test backend; see docs/development.md`
    )
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/mail-capture.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
