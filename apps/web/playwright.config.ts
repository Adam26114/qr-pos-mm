/* eslint-disable turbo/no-undeclared-env-vars -- Playwright is invoked directly by Bun, outside Turborepo tasks. */
import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const port = process.env.E2E_PORT ?? "3000"
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw new Error("E2E_PORT must be an unprivileged local port")
const baseURL = `http://localhost:${port}`
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
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/mail-capture.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `bun run dev --port ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
