/* eslint-disable turbo/no-undeclared-env-vars -- These secrets and deployment URLs belong to the Convex runtime, not Turborepo. */
import { ConvexError } from "convex/values"

export function simulatorEnabled() {
  try {
    return (
      process.env.ORDER_PAYMENT_SIMULATOR === "enabled" &&
      !!process.env.SIMULATOR_EVENT_SECRET &&
      process.env.SIMULATOR_EVENT_SECRET.length >= 32 &&
      [
        process.env.CONVEX_CLOUD_URL,
        process.env.CONVEX_SITE_URL,
        process.env.SITE_URL,
      ].every((value) => {
        if (!value) return false
        const url = new URL(value)
        return (
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        )
      })
    )
  } catch {
    return false
  }
}

export function requireSimulator() {
  if (!simulatorEnabled()) throw new ConvexError("SIMULATOR_DISABLED")
}
