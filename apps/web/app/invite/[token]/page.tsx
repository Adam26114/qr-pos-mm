import { AuthShell } from "@/components/auth-shell"
import { StaffInvitation } from "@/components/staff-invitation"

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
