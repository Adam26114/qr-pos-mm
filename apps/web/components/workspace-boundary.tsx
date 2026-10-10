"use client"

import { AuthBoundary } from "@convex-dev/better-auth/react"
import { ConvexError } from "convex/values"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { useSignOut } from "@/lib/use-sign-out"
import { Workspace } from "./workspace"
import { useCopy } from "./language-switcher"
import { LoadingState } from "@workspace/ui/composed/loading-state"

export function WorkspaceBoundary() {
  const router = useRouter()
  const { copy } = useCopy()
  const { signingOut, failure, signOut } = useSignOut("/login")
  if (signingOut)
    return (
      <div className="mx-auto max-w-2xl p-8">
        <LoadingState label={copy.working} />
      </div>
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
