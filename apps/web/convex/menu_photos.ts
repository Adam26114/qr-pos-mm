import { ConvexError, v } from "convex/values"
import {
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { authComponent } from "./auth"
import { requireStoreOwner } from "./lib/store_access"

const maxBytes = 5 * 1024 * 1024

export const authorizeUpload = internalQuery({
  args: { storeId: v.id("stores") },
  returns: v.null(),
  handler: async (ctx, { storeId }) => {
    await requireStoreOwner(ctx, storeId)
    return null
  },
})

export const registerPhoto = internalMutation({
  args: { storeId: v.id("stores"), storageId: v.id("_storage") },
  returns: v.id("menuPhotos"),
  handler: async (ctx, { storeId, storageId }) => {
    const { user } = await requireStoreOwner(ctx, storeId)
    return await ctx.db.insert("menuPhotos", {
      storeId,
      storageId,
      uploadedBy: user._id,
    })
  },
})

// Raster formats only: never serve client-controlled SVG/HTML as a menu photo.
function matchesImageType(bytes: Uint8Array, type: string) {
  if (type === "image/png")
    return (
      bytes.length >= 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (byte, index) => bytes[index] === byte
      )
    )
  if (type === "image/jpeg")
    return (
      bytes.length >= 4 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255 &&
      bytes.at(-2) === 255 &&
      bytes.at(-1) === 217
    )
  if (type === "image/webp")
    return (
      bytes.length >= 16 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    )
  return false
}

export const upload = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin")
  const headers = {
    "Access-Control-Allow-Origin": process.env.SITE_URL ?? "",
    Vary: "Origin",
    "Cache-Control": "no-store",
  }
  const respond = (code: string, status: number) =>
    Response.json({ code }, { status, headers })
  if (origin && origin !== process.env.SITE_URL)
    return respond("STORE_ACCESS_DENIED", 403)
  try {
    await authComponent.getAuthUser(ctx)
    const storeId = new URL(request.url).searchParams.get(
      "storeId"
    ) as Id<"stores"> | null
    if (!storeId) return respond("INVALID_PHOTO", 400)
    await ctx.runQuery(internal.menu_photos.authorizeUpload, { storeId })
    if (Number(request.headers.get("Content-Length")) > maxBytes)
      return respond("PHOTO_TOO_LARGE", 413)
    const reader = request.body?.getReader()
    if (!reader) return respond("INVALID_PHOTO", 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) {
        await reader.cancel()
        return respond("PHOTO_TOO_LARGE", 413)
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    const type = request.headers.get("Content-Type")?.toLowerCase() ?? ""
    if (!matchesImageType(bytes, type)) return respond("INVALID_PHOTO", 400)
    const storageId = await ctx.storage.store(new Blob([bytes], { type }))
    try {
      // Repeat authorization atomically when registering, in case access changed mid-upload.
      const photoId = await ctx.runMutation(
        internal.menu_photos.registerPhoto,
        { storeId, storageId }
      )
      return Response.json({ photoId }, { headers })
    } catch (error) {
      await ctx.storage.delete(storageId)
      throw error
    }
  } catch (error) {
    const code =
      error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "INVALID_PHOTO"
    return respond(
      code,
      code === "Unauthenticated"
        ? 401
        : ["OWNER_REQUIRED", "STORE_ACCESS_DENIED"].includes(code)
          ? 403
          : 400
    )
  }
})

export const preflight = httpAction(async (_ctx, request) => {
  if (request.headers.get("Origin") !== process.env.SITE_URL)
    return new Response(null, { status: 403 })
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.SITE_URL!,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    },
  })
})
