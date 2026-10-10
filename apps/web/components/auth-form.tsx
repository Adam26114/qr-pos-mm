"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
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
  const router = useRouter()
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
      router.replace("/workspace")
      router.refresh()
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

  return (
    <>
      <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
        {copy.ownerAccount}
      </p>
      <h2 className="font-heading text-3xl leading-snug font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">
        {intro}
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        {!online && (
          <p role="status" className="text-sm text-destructive">
            {copy.offline}
          </p>
        )}
        <fieldset
          disabled={!isReady || isSubmitting || !online}
          className="space-y-5"
        >
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label htmlFor={field.key} className="block text-sm font-medium">
                {field.label}
              </label>
              <input
                id={field.key}
                type={field.type}
                autoComplete={field.autoComplete}
                {...register(field.key)}
                aria-invalid={!!errors[field.key]}
                aria-describedby={
                  errors[field.key] ? `${field.key}-error` : undefined
                }
                className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {errors[field.key] && (
                <p
                  id={`${field.key}-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {formError(errors[field.key]?.message, copy)}
                </p>
              )}
            </div>
          ))}
          {failure && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {copy[failure]}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">
              {copy[notice]}
            </p>
          )}
          {mode === "reset" && !token && (
            <p role="alert" className="text-sm text-destructive">
              {copy.invalidLink}
            </p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || (mode === "reset" && !token)}
            className="h-12 w-full rounded-xl"
          >
            {isSubmitting ? copy.working : action}
          </Button>
        </fieldset>
      </form>
      {mode === "login" && (
        <Link
          href="/forgot-password"
          className="mt-5 block text-sm font-medium text-primary hover:underline"
        >
          {copy.forgot}
        </Link>
      )}
      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        {mode === "register" ? (
          <>
            {copy.haveAccount}{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              {copy.signIn}
            </Link>
          </>
        ) : mode === "login" ? (
          <>
            {copy.newAccount}{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              {copy.createAccount}
            </Link>
          </>
        ) : (
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {copy.backToLogin}
          </Link>
        )}
      </p>
    </>
  )
}
