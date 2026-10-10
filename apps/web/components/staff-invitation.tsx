"use client"

import Link from "next/link"
import { useState } from "react"
import {
  useConvexAuth,
  useConvexConnectionState,
  useQuery,
  useMutation,
} from "convex/react"
import { AuthBoundary } from "@convex-dev/better-auth/react"
import { ConvexError } from "convex/values"
import { Button } from "@workspace/ui/components/button"
import { FormCard } from "@workspace/ui/composed/form-card"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { useOnline } from "@/lib/use-online"
import { useSignOut } from "@/lib/use-sign-out"
import { staffError } from "@/lib/staff-error"
import type { MessageKey } from "@/lib/i18n"
import { AuthForm } from "./auth-form"
import { useCopy } from "./language-switcher"

export function StaffInvitation({ token }: { token: string }) {
  const { copy } = useCopy()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const invitation = useQuery(api.staff.preview, { token })
  const {
    signingOut,
    failure: signOutFailed,
    signOut,
  } = useSignOut(`/invite/${token}`)
  const [mode, setMode] = useState<"register" | "login">("register")
  if (invitation === undefined || isLoading || signingOut)
    return <LoadingState label={copy.loading} />
  if (!invitation)
    return (
      <FormCard title={copy.invitations}>
        <Feedback tone="error">{copy.invalidInvitation}</Feedback>
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          {copy.backToLogin}
        </Link>
      </FormCard>
    )
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {copy.invitationTitle}{" "}
        <strong className="[overflow-wrap:anywhere] text-foreground">
          {invitation.storeName}
        </strong>
      </p>
      {isAuthenticated ? (
        <AuthBoundary
          authClient={authClient}
          getAuthUserFn={api.auth.getAuthUser}
          isAuthError={(error) =>
            error instanceof ConvexError && error.data === "Unauthenticated"
          }
          onUnauth={() => window.location.replace(`/invite/${token}`)}
        >
          <AcceptInvitation
            token={token}
            email={invitation.email}
            onSignOut={signOut}
            signOutFailed={signOutFailed}
          />
        </AuthBoundary>
      ) : (
        <AuthForm
          key={mode}
          mode={mode}
          invitation={{ token, email: invitation.email }}
          onModeChange={setMode}
        />
      )}
    </div>
  )
}

function AcceptInvitation({
  token,
  email,
  onSignOut,
  signOutFailed,
}: {
  token: string
  email: string
  onSignOut: () => Promise<void>
  signOutFailed: boolean
}) {
  const { copy } = useCopy()
  const online = useOnline()
  const connection = useConvexConnectionState()
  const connected = online && connection.isWebSocketConnected
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const user = useQuery(api.auth.getAuthUser, {})
  const accept = useMutation(api.staff.accept)
  async function join() {
    if (!connected || pending) return
    setPending(true)
    setFailure(null)
    try {
      await accept({ token })
      window.location.replace("/workspace")
    } catch (error) {
      setFailure(staffError(error))
      setPending(false)
    }
  }
  if (!user) return <LoadingState label={copy.loading} />
  const matching = user.email.toLowerCase() === email
  return (
    <FormCard
      title={copy.joinStore}
      description={copy.invitationIntro}
      eyebrow={copy.staffAccount}
    >
      <p className="mb-4 text-sm break-all">
        {user.name} · {user.email}
      </p>
      {!online && <Feedback>{copy.offline}</Feedback>}
      {online && !connection.isWebSocketConnected && (
        <Feedback>{copy.disconnected}</Feedback>
      )}
      {!matching && <Feedback tone="error">{copy.invitationMismatch}</Feedback>}
      {(failure || signOutFailed) && (
        <Feedback tone="error">
          {failure ? copy[failure] : copy.requestFailed}
        </Feedback>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <SubmitButton
          type="button"
          pending={pending}
          pendingLabel={copy.working}
          disabled={!connected || !matching}
          onClick={join}
        >
          {copy.joinStore}
        </SubmitButton>
        <Button
          variant="outline"
          disabled={!online || pending}
          onClick={onSignOut}
        >
          {copy.signOut}
        </Button>
      </div>
    </FormCard>
  )
}
