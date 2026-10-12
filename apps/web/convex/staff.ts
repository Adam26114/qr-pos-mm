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

const day = 24 * 60 * 60 * 1000
const invitationLifetime = 7 * day
const invitationDays = v.union(v.literal(1), v.literal(3), v.literal(7))
type InvitationDays = 1 | 3 | 7
type CreatedJoinLink = {
  invitationId: Id<"staffInvitations">
  token: string
  expiresAt: number
  expiresInDays: InvitationDays
}
const joinLinkResult = v.object({
  invitationId: v.id("staffInvitations"),
  token: v.string(),
  expiresAt: v.number(),
  expiresInDays: invitationDays,
})
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
async function hashInvitationToken(token: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    )
  )
}

// Contact information belongs to the membership; it is never an auth identifier.
function contactPhone(value?: string) {
  const phone = value?.trim()
  if (!phone) return undefined
  if (phone.length > 32 || !/^[+\d\s().-]+$/.test(phone) || !/\d/.test(phone))
    throw new ConvexError("INVALID_PHONE")
  return phone
}

export const createJoinLink = action({
  args: {
    storeId: v.id("stores"),
    expiresInDays: v.optional(invitationDays),
  },
  returns: joinLinkResult,
  handler: async (ctx, args): Promise<CreatedJoinLink> => {
    await authComponent.getAuthUser(ctx)
    const token = hex(crypto.getRandomValues(new Uint8Array(32)))
    const created = await ctx.runMutation(internal.staff.createJoinInvitation, {
      ...args,
      expiresInDays: args.expiresInDays ?? 7,
      tokenHash: await hashInvitationToken(token),
    })
    return { ...created, token }
  },
})

export const regenerateJoinLink = action({
  args: {
    storeId: v.id("stores"),
    invitationId: v.id("staffInvitations"),
    expiresInDays: v.optional(invitationDays),
  },
  returns: joinLinkResult,
  handler: async (ctx, args): Promise<CreatedJoinLink> => {
    await authComponent.getAuthUser(ctx)
    const token = hex(crypto.getRandomValues(new Uint8Array(32)))
    const created = await ctx.runMutation(internal.staff.createJoinInvitation, {
      storeId: args.storeId,
      replacementId: args.invitationId,
      ...(args.expiresInDays === undefined
        ? {}
        : { expiresInDays: args.expiresInDays }),
      tokenHash: await hashInvitationToken(token),
    })
    return { ...created, token }
  },
})

export const createJoinInvitation = internalMutation({
  args: {
    storeId: v.id("stores"),
    tokenHash: v.string(),
    expiresInDays: v.optional(invitationDays),
    replacementId: v.optional(v.id("staffInvitations")),
  },
  returns: v.object({
    invitationId: v.id("staffInvitations"),
    expiresAt: v.number(),
    expiresInDays: invitationDays,
  }),
  handler: async (ctx, args) => {
    await requireStoreOwner(ctx, args.storeId)
    let expiresInDays: InvitationDays = args.expiresInDays ?? 7
    if (args.replacementId) {
      const previous = await ctx.db.get(args.replacementId)
      if (!previous || previous.storeId !== args.storeId)
        throw new ConvexError("STORE_ACCESS_DENIED")
      if (
        previous.kind !== "link" ||
        previous.status === "accepted" ||
        previous.replacedBy !== undefined
      )
        throw new ConvexError("INVALID_INVITATION")
      expiresInDays = args.expiresInDays ?? previous.expiresInDays ?? 7
      // Replacement and revocation commit together. A concurrent acceptance must
      // either consume the old link first, or observe that it has been revoked.
      if (previous.status === "pending")
        await ctx.db.patch(previous._id, { status: "revoked" })
    }
    const now = Date.now()
    const expiresAt = now + expiresInDays * day
    const invitationId = await ctx.db.insert("staffInvitations", {
      storeId: args.storeId,
      kind: "link",
      tokenHash: args.tokenHash,
      createdAt: now,
      expiresAt,
      expiresInDays,
      status: "pending",
    })
    if (args.replacementId)
      await ctx.db.patch(args.replacementId, { replacedBy: invitationId })
    await ctx.scheduler.runAt(expiresAt, internal.staff.expireInvitation, {
      invitationId,
    })
    return { invitationId, expiresAt, expiresInDays }
  },
})

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
      kind: "email",
      email: args.email,
      tokenHash: args.tokenHash,
      createdAt: now,
      expiresAt: now + invitationLifetime,
      expiresInDays: 7,
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
          kind: invitation.kind ?? ("email" as const),
          ...(invitation.email === undefined
            ? {}
            : { email: invitation.email }),
          storeName: store.name,
          expiresAt: invitation.expiresAt,
        }
      : null
  },
})

export const accept = mutation({
  args: { token: v.string(), phone: v.optional(v.string()) },
  returns: v.id("stores"),
  handler: async (ctx, { token, phone }) => {
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
    if (
      invitation.kind !== "link" &&
      user.email.toLowerCase() !== invitation.email
    )
      throw new ConvexError("INVITATION_EMAIL_MISMATCH")
    const memberships = await membershipsForUser(ctx, user._id)
    const membership = memberships.find(
      (member) => member.revokedAt === undefined
    )
    if (membership) throw new ConvexError("MEMBERSHIP_CONFLICT")
    if (
      memberships.some(
        (member) =>
          member.storeId === invitation.storeId &&
          member.role === "staff" &&
          member.revokedAt !== undefined
      )
    )
      throw new ConvexError("STAFF_DEACTIVATED")
    const normalizedPhone = contactPhone(phone)
    await ctx.db.insert("memberships", {
      userId: user._id,
      storeId: invitation.storeId,
      role: "staff",
      name: user.name,
      email: user.email,
      ...(normalizedPhone === undefined ? {} : { phone: normalizedPhone }),
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
          phone: member.phone ?? null,
          joinedAt: member._creationTime,
          status:
            member.revokedAt === undefined
              ? ("active" as const)
              : ("removed" as const),
        })),
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        kind: invitation.kind ?? ("email" as const),
        email: invitation.email ?? null,
        status:
          invitation.status === "pending" && Date.now() >= invitation.expiresAt
            ? ("expired" as const)
            : invitation.status,
        delivery:
          invitation.kind === "link" ? null : (invitation.delivery ?? "queued"),
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        expiresInDays: invitation.expiresInDays ?? 7,
        replacedBy: invitation.replacedBy ?? null,
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

export const reactivate = mutation({
  args: { storeId: v.id("stores"), membershipId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, { storeId, membershipId }) => {
    await requireStoreOwner(ctx, storeId)
    const member = await ctx.db.get(membershipId)
    if (!member || member.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (member.role !== "staff") throw new ConvexError("STAFF_REQUIRED")
    const memberships = await membershipsForUser(ctx, member.userId)
    if (
      memberships.some(
        (other) => other._id !== membershipId && other.revokedAt === undefined
      )
    )
      throw new ConvexError("MEMBERSHIP_CONFLICT")
    if (member.revokedAt !== undefined)
      await ctx.db.patch(membershipId, { revokedAt: undefined })
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
