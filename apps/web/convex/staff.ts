import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { ConvexError, v } from "convex/values"
import { z } from "zod"
import { authComponent } from "./auth"
import { membershipsForUser, requireStoreOwner } from "./lib/store_access"

const invitationLifetime = 7 * 24 * 60 * 60 * 1000
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
async function hashInvitationToken(token: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    )
  )
}

export const invite = action({
  args: { storeId: v.id("stores"), email: v.string() },
  returns: v.id("staffInvitations"),
  handler: async (ctx, args): Promise<Id<"staffInvitations">> => {
    await authComponent.getAuthUser(ctx)
    const email = args.email.trim().toLowerCase()
    if (!z.email().safeParse(email).success || email.length > 254)
      throw new ConvexError("INVALID_EMAIL")
    // Generate the private capability in an action; authorization and writes stay atomic below.
    const token = hex(crypto.getRandomValues(new Uint8Array(32)))
    return await ctx.runMutation(internal.staff.createInvitation, {
      storeId: args.storeId,
      email,
      token,
      tokenHash: await hashInvitationToken(token),
    })
  },
})

export const createInvitation = internalMutation({
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    token: v.string(),
    tokenHash: v.string(),
  },
  returns: v.id("staffInvitations"),
  handler: async (ctx, args) => {
    const { store, user } = await requireStoreOwner(ctx, args.storeId)
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect()
    if (
      user.email.toLowerCase() === args.email ||
      members.some(
        (member) =>
          member.revokedAt === undefined &&
          member.email?.toLowerCase() === args.email
      )
    )
      throw new ConvexError("MEMBER_EXISTS")
    const now = Date.now()
    const pending = await ctx.db
      .query("staffInvitations")
      .withIndex("by_store_email_status", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("email", args.email)
          .eq("status", "pending")
      )
      .unique()
    if (pending && now < pending.expiresAt) return pending._id
    if (pending) await ctx.db.patch(pending._id, { status: "expired" })
    const invitationId = await ctx.db.insert("staffInvitations", {
      storeId: args.storeId,
      email: args.email,
      tokenHash: args.tokenHash,
      createdAt: now,
      expiresAt: now + invitationLifetime,
      status: "pending",
      delivery: "queued",
    })
    await ctx.scheduler.runAfter(0, internal.email.sendStaffInvitation, {
      invitationId,
      recipient: args.email,
      storeName: store.name,
      url: `${process.env.SITE_URL}/invite/${args.token}`,
    })
    await ctx.scheduler.runAt(
      now + invitationLifetime,
      internal.staff.expireInvitation,
      { invitationId }
    )
    return invitationId
  },
})

export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{64}$/.test(token)) return null
    const tokenHash = await hashInvitationToken(token)
    const invitation = await ctx.db
      .query("staffInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    if (
      !invitation ||
      invitation.status !== "pending" ||
      Date.now() >= invitation.expiresAt
    )
      return null
    const store = await ctx.db.get(invitation.storeId)
    return store
      ? {
          email: invitation.email,
          storeName: store.name,
          expiresAt: invitation.expiresAt,
        }
      : null
  },
})

export const accept = mutation({
  args: { token: v.string() },
  returns: v.id("stores"),
  handler: async (ctx, { token }) => {
    const user = await authComponent.getAuthUser(ctx)
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new ConvexError("INVALID_INVITATION")
    const tokenHash = await hashInvitationToken(token)
    const invitation = await ctx.db
      .query("staffInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    if (
      !invitation ||
      invitation.status !== "pending" ||
      Date.now() >= invitation.expiresAt
    )
      throw new ConvexError("INVALID_INVITATION")
    if (user.email.toLowerCase() !== invitation.email)
      throw new ConvexError("INVITATION_EMAIL_MISMATCH")
    const membership = (await membershipsForUser(ctx, user._id)).find(
      (member) => member.revokedAt === undefined
    )
    if (membership) throw new ConvexError("MEMBERSHIP_CONFLICT")
    await ctx.db.insert("memberships", {
      userId: user._id,
      storeId: invitation.storeId,
      role: "staff",
      name: user.name,
      email: user.email,
    })
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedBy: user._id,
      acceptedAt: Date.now(),
    })
    return invitation.storeId
  },
})

export const directory = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreOwner(ctx, storeId)
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .collect()
    const invitations = await ctx.db
      .query("staffInvitations")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .collect()
    return {
      members: members
        .filter((member) => member.role === "staff")
        .map((member) => ({
          _id: member._id,
          name: member.name ?? null,
          email: member.email ?? null,
          status:
            member.revokedAt === undefined
              ? ("active" as const)
              : ("removed" as const),
        })),
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        email: invitation.email,
        status: invitation.status,
        delivery: invitation.delivery ?? "queued",
        expiresAt: invitation.expiresAt,
      })),
    }
  },
})

export const remove = mutation({
  args: { storeId: v.id("stores"), membershipId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, { storeId, membershipId }) => {
    await requireStoreOwner(ctx, storeId)
    const member = await ctx.db.get(membershipId)
    if (!member || member.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (member.role !== "staff") throw new ConvexError("STAFF_REQUIRED")
    if (member.revokedAt === undefined)
      await ctx.db.patch(membershipId, { revokedAt: Date.now() })
    return null
  },
})

export const expireInvitation = internalMutation({
  args: { invitationId: v.id("staffInvitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId)
    if (invitation?.status === "pending" && Date.now() >= invitation.expiresAt)
      await ctx.db.patch(invitationId, { status: "expired" })
    return null
  },
})

export const revokeInvitation = mutation({
  args: { storeId: v.id("stores"), invitationId: v.id("staffInvitations") },
  returns: v.null(),
  handler: async (ctx, { storeId, invitationId }) => {
    await requireStoreOwner(ctx, storeId)
    const invitation = await ctx.db.get(invitationId)
    if (!invitation || invitation.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (invitation.status === "pending")
      await ctx.db.patch(invitationId, { status: "revoked" })
    return null
  },
})

export const canDeliver = internalQuery({
  args: { invitationId: v.id("staffInvitations") },
  returns: v.boolean(),
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId)
    return (
      !!invitation &&
      invitation.status === "pending" &&
      Date.now() < invitation.expiresAt
    )
  },
})

export const recordDelivery = internalMutation({
  args: {
    invitationId: v.id("staffInvitations"),
    delivery: v.union(v.literal("sent"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, { invitationId, delivery }) => {
    if (await ctx.db.get(invitationId))
      await ctx.db.patch(invitationId, { delivery })
    return null
  },
})
