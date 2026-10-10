import { AuthShell } from "@/components/auth-shell"
import { AuthForm } from "@/components/auth-form"

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthForm mode="login" />
    </AuthShell>
  )
}
