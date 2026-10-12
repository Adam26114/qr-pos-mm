import type { Metadata } from "next"
import { AuthShell } from "@/components/auth-shell"
import { StaffInvitation } from "@/components/staff-invitation"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <AuthShell intent="staff">
      <StaffInvitation token={token} />
    </AuthShell>
  )
}
