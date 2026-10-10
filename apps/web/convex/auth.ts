import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth/minimal"
import { APIError } from "better-auth/api"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"

export const authComponent = createClient<DataModel>(components.betterAuth)

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const name = user.name.trim()
            if (name.length < 2 || name.length > 80)
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: "Enter a name between 2 and 80 characters.",
              })
            return { data: { ...user, name } }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!("scheduler" in ctx))
          throw new Error("Password recovery requires an action or mutation")
        await ctx.scheduler.runAfter(0, internal.email.sendPasswordReset, {
          recipient: user.email,
          url,
        })
      },
    },
    plugins: [convex({ authConfig })],
  })
}

export const { getAuthUser } = authComponent.clientApi()
