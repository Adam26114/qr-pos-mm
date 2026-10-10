import { AuthShell } from "@/components/auth-shell"
import { AuthForm } from "@/components/auth-form"

export default function RegisterPage() {
  return (
    <AuthShell>
      <AuthForm mode="register" />
    </AuthShell>
  )
}
