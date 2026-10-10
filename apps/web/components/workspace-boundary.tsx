"use client"

import { AuthBoundary } from "@convex-dev/better-auth/react"
import { ConvexError } from "convex/values"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { flushSync } from "react-dom"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { Workspace } from "./workspace"
import { useCopy } from "./language-switcher"

export function WorkspaceBoundary() {
  const router = useRouter()
  const { copy } = useCopy()
  const [signingOut, setSigningOut] = useState(false)
  const [failure, setFailure] = useState(false)
  async function signOut() {
    // Detach private subscriptions before revoking the session that authorizes them.
    flushSync(() => setSigningOut(true))
    setFailure(false)
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error("Sign out failed")
      router.replace("/login")
      router.refresh()
    } catch {
      setSigningOut(false)
      setFailure(true)
    }
  }
  if (signingOut)
    return (
      <p role="status" className="p-8">
        {copy.working}
      </p>
    )
  return (
    <AuthBoundary
      authClient={authClient}
      getAuthUserFn={api.auth.getAuthUser}
      isAuthError={(error) =>
        error instanceof ConvexError && error.data === "Unauthenticated"
      }
      onUnauth={() => {
        router.replace("/login")
        router.refresh()
      }}
    >
      <Workspace onSignOut={signOut} signOutFailed={failure} />
    </AuthBoundary>
  )
}
