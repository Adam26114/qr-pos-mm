import { v } from "convex/values"

export const destination = v.union(
  v.object({
    kind: v.literal("table"),
    tableId: v.id("tables"),
    number: v.number(),
  }),
  v.object({ kind: v.literal("takeaway") })
)

export const destinationInput = v.union(
  v.object({ kind: v.literal("table"), tableId: v.id("tables") }),
  v.object({ kind: v.literal("takeaway") })
)
