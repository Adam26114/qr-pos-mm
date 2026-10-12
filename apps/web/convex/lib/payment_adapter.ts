import type { ActionCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { internal } from "../_generated/api"
import { requireSimulator } from "./payment_config"
import type { ProviderEvent } from "./payment_protocol"

// Server-only adapter. Merchant routing and amounts always come from the persisted attempt.
export async function createCheckout(
  ctx: ActionCtx,
  attemptId: Id<"paymentAttempts">
): Promise<void> {
  requireSimulator()
  await ctx.runMutation(internal.simulator.open, { attemptId })
}
export async function checkCheckout(
  ctx: ActionCtx,
  attemptId: Id<"paymentAttempts">
): Promise<{ available: boolean; events: ProviderEvent[] }> {
  requireSimulator()
  return ctx.runMutation(internal.simulator.snapshot, { attemptId })
}
