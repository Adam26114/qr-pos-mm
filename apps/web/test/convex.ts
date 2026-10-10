import { convexTest } from "convex-test"
import { register } from "@convex-dev/better-auth/test"
import { components } from "../convex/_generated/api"
import schema from "../convex/schema"

const modules = import.meta.glob("../convex/**/*.ts")

export function backend() {
  const t = convexTest(schema, modules)
  register(t)
  return t
}

export async function authenticate(
  t: ReturnType<typeof backend>,
  email: string,
  signUp = true
) {
  const response = await t.fetch(
    signUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Cafe team member",
        email,
        password: "CafePassword42!",
      }),
    }
  )
  if (response.status !== 200)
    throw new Error(`Authentication failed (${response.status})`)
  const account = (await response.json()) as {
    token: string
    user: { id: string }
  }
  const session = await t.query(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "token", value: account.token }],
  })
  if (!session) throw new Error("Authentication did not create a session")
  return t.withIdentity({ subject: account.user.id, sessionId: session._id })
}
