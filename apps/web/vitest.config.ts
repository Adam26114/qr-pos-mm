import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["@convex-dev/better-auth"] } },
    env: {
      SITE_URL: "http://localhost:3000",
      CONVEX_SITE_URL: "http://127.0.0.1:3211",
      BETTER_AUTH_SECRET: "test-only-secret-at-least-thirty-two-characters",
    },
  },
})
