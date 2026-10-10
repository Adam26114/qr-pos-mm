"use client"

import { useSearchParams } from "next/navigation"
import { AuthForm } from "./auth-form"

export function ResetPasswordForm() {
  const params = useSearchParams()
  return <AuthForm mode="reset" token={params.get("token") ?? undefined} />
}
