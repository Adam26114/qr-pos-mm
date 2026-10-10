"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FieldSet } from "@workspace/ui/components/field"
import { TextField } from "@workspace/ui/composed/text-field"
import { Feedback } from "@workspace/ui/composed/feedback"
import { FormCard } from "@workspace/ui/composed/form-card"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { authClient } from "@/lib/auth-client"
import { useCopy } from "./language-switcher"
import { useOnline } from "@/lib/use-online"
import { formError, type MessageKey } from "@/lib/i18n"

type Mode = "register" | "login" | "forgot" | "reset"
type Fields = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function AuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const { copy } = useCopy()
  const online = useOnline()
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const schema = z
    .object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((values, ctx) => {
      if (
        mode === "register" &&
        (values.name.trim().length < 2 || values.name.trim().length > 80)
      )
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "invalidName",
        })
      if (mode !== "reset" && !z.email().safeParse(values.email).success)
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "invalidEmail",
        })
      if (
        mode !== "forgot" &&
        (values.password.length < 8 || values.password.length > 128)
      )
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "invalidPassword",
        })
      if (mode === "reset" && values.password !== values.confirmPassword)
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "passwordMismatch",
        })
    })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isReady },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })
  const title = {
    register: copy.registerTitle,
    login: copy.loginTitle,
    forgot: copy.forgotTitle,
    reset: copy.resetTitle,
  }[mode]
  const intro = {
    register: copy.registerIntro,
    login: copy.loginIntro,
    forgot: copy.forgotIntro,
    reset: copy.resetIntro,
  }[mode]
  const action = {
    register: copy.createAccount,
    login: copy.signIn,
    forgot: copy.sendReset,
    reset: copy.reset,
  }[mode]

  async function submit(values: Fields) {
    if (!online) return
    setFailure(null)
    setNotice(null)
    try {
      let error: { code?: string; message?: string } | null | undefined
      if (mode === "register")
        error = (
          await authClient.signUp.email({
            name: values.name.trim(),
            email: values.email,
            password: values.password,
          })
        ).error
      if (mode === "login")
        error = (
          await authClient.signIn.email({
            email: values.email,
            password: values.password,
          })
        ).error
      if (mode === "forgot")
        error = (
          await authClient.requestPasswordReset({
            email: values.email,
            redirectTo: `${window.location.origin}/reset-password`,
          })
        ).error
      if (mode === "reset")
        error = (
          await authClient.resetPassword({
            newPassword: values.password,
            token: token ?? "",
          })
        ).error
      if (error) {
        const message =
          error.code === "USER_ALREADY_EXISTS" ||
          error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "accountExists"
            : error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "invalidCredentials"
              : error.code === "INVALID_NAME"
                ? "invalidName"
                : error.code === "INVALID_TOKEN"
                  ? "invalidLink"
                  : "requestFailed"
        setFailure(message)
        return
      }
      if (mode === "forgot" || mode === "reset") {
        setNotice(mode === "forgot" ? "emailSent" : "resetSuccess")
        return
      }
      // Start a fresh authenticated client so prior session callbacks cannot redirect it.
      window.location.replace("/workspace")
    } catch {
      setFailure("requestFailed")
    }
  }

  const fields: {
    key: keyof Fields
    label: string
    type: string
    autoComplete: string
  }[] = []
  if (mode === "register")
    fields.push({
      key: "name",
      label: copy.name,
      type: "text",
      autoComplete: "name",
    })
  if (mode !== "reset")
    fields.push({
      key: "email",
      label: copy.email,
      type: "email",
      autoComplete: "email",
    })
  if (mode !== "forgot")
    fields.push({
      key: "password",
      label: copy.password,
      type: "password",
      autoComplete: mode === "login" ? "current-password" : "new-password",
    })
  if (mode === "reset")
    fields.push({
      key: "confirmPassword",
      label: copy.confirmPassword,
      type: "password",
      autoComplete: "new-password",
    })

  const footer =
    mode === "register" ? (
      <p>
        {copy.haveAccount}{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          {copy.signIn}
        </Link>
      </p>
    ) : mode === "login" ? (
      <p>
        {copy.newAccount}{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          {copy.createAccount}
        </Link>
      </p>
    ) : (
      <Link href="/login" className="font-medium text-primary hover:underline">
        {copy.backToLogin}
      </Link>
    )

  return (
    <FormCard
      title={title}
      description={intro}
      eyebrow={copy.ownerAccount}
      footer={footer}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        {!online && <Feedback>{copy.offline}</Feedback>}
        <FieldSet disabled={!isReady || isSubmitting || !online}>
          {fields.map((field) => (
            <TextField
              key={field.key}
              id={field.key}
              label={field.label}
              type={field.type}
              autoComplete={field.autoComplete}
              {...register(field.key)}
              error={
                errors[field.key]
                  ? formError(errors[field.key]?.message, copy)
                  : undefined
              }
            />
          ))}
          {failure && <Feedback tone="error">{copy[failure]}</Feedback>}
          {notice && <Feedback>{copy[notice]}</Feedback>}
          {mode === "reset" && !token && (
            <Feedback tone="error">{copy.invalidLink}</Feedback>
          )}
          <SubmitButton
            pending={isSubmitting}
            pendingLabel={copy.working}
            disabled={mode === "reset" && !token}
          >
            {action}
          </SubmitButton>
        </FieldSet>
      </form>
      {mode === "login" && (
        <Link
          href="/forgot-password"
          className="mt-2 block text-sm font-medium text-primary hover:underline"
        >
          {copy.forgot}
        </Link>
      )}
    </FormCard>
  )
}
