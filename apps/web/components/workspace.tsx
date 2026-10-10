"use client"

import { useState } from "react"
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/convex/_generated/api"
import { LanguageSwitcher, useCopy } from "./language-switcher"
import { useOnline } from "@/lib/use-online"
import { formError } from "@/lib/i18n"

export function Workspace({
  onSignOut,
  signOutFailed,
}: {
  onSignOut: () => Promise<void>
  signOutFailed: boolean
}) {
  const { copy, language } = useCopy()
  const online = useOnline()
  const connection = useConvexConnectionState()
  const canSubmit = online && connection.isWebSocketConnected
  const { isAuthenticated } = useConvexAuth()
  const workspace = useQuery(
    api.stores.workspace,
    isAuthenticated ? {} : "skip"
  )
  const createStore = useMutation(api.stores.create)
  const [failure, setFailure] = useState(false)
  const schema = z.object({
    name: z.string().trim().min(2, "invalidName").max(80, "invalidName"),
  })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isReady },
  } = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  async function submit(values: { name: string }) {
    if (!canSubmit) return
    setFailure(false)
    try {
      await createStore(values)
    } catch {
      setFailure(true)
    }
  }

  const date = (value: number) =>
    new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Yangon",
    }).format(value)

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <span className="font-heading text-xl font-semibold tracking-tight">
            QR<span className="text-primary">POS</span>
          </span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button variant="outline" onClick={onSignOut} disabled={!online}>
              {copy.signOut}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        {!online && (
          <p role="status" className="mb-6 text-sm text-destructive">
            {copy.offline}
          </p>
        )}
        {online && connection.hasEverConnected && (
          <p role="status" className="mb-6 text-sm text-muted-foreground">
            {connection.isWebSocketConnected ? copy.online : copy.disconnected}
          </p>
        )}
        {!workspace ? (
          <p role="status">{copy.loading}</p>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              {copy.ownerWorkspace}
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
              <h1 className="font-heading text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
                {workspace.store?.name ?? copy.createStoreTitle}
              </h1>
              <p className="text-sm break-all text-muted-foreground">
                {workspace.user.name} · {workspace.user.email}
              </p>
            </div>
            {(failure || signOutFailed) && (
              <p
                role="alert"
                className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
              >
                {copy.requestFailed}
              </p>
            )}
            {!workspace.store ? (
              <section className="mt-10 grid gap-8 rounded-2xl border border-border bg-card p-6 sm:p-10 md:grid-cols-2">
                <div>
                  <h2 className="font-heading text-2xl font-semibold">
                    {copy.trialPromise}
                  </h2>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
                    {copy.createStoreIntro}
                  </p>
                  <p className="mt-8 text-sm font-medium">{copy.trialLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.trialNote}
                  </p>
                </div>
                <form
                  onSubmit={handleSubmit(submit)}
                  noValidate
                  className="space-y-5"
                >
                  <fieldset
                    disabled={!isReady || isSubmitting || !canSubmit}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="store-name"
                        className="block text-sm font-medium"
                      >
                        {copy.storeName}
                      </label>
                      <input
                        id="store-name"
                        autoComplete="organization"
                        placeholder={copy.storePlaceholder}
                        {...register("name")}
                        aria-invalid={!!errors.name}
                        aria-describedby={
                          errors.name ? "store-name-error" : undefined
                        }
                        className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {errors.name && (
                        <p
                          id="store-name-error"
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {formError(errors.name.message, copy)}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-12 w-full rounded-xl"
                    >
                      {isSubmitting ? copy.working : copy.createStore}
                    </Button>
                  </fieldset>
                </form>
              </section>
            ) : (
              <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
                <section className="rounded-2xl bg-[#123f35] p-7 text-white sm:p-10">
                  <span className="inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-medium">
                    {workspace.access?.active
                      ? copy.activeTrial
                      : copy.expiredTrial}
                  </span>
                  <h2 className="mt-8 font-heading text-3xl leading-snug font-semibold">
                    {workspace.access?.active
                      ? copy.storeReady
                      : copy.expiredTrial}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
                    {workspace.access?.active
                      ? copy.storeReadyIntro
                      : copy.expiryIntro}
                  </p>
                  <dl className="mt-10 grid gap-6 border-t border-white/20 pt-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-white/65">
                        {copy.trialStarted}
                      </dt>
                      <dd className="mt-2 text-sm">
                        {date(workspace.store.trialStartedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-white/65">
                        {copy.trialEnds}
                      </dt>
                      <dd data-testid="trial-end" className="mt-2 text-sm">
                        {date(workspace.store.trialEndsAt)}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="rounded-2xl border border-border bg-card p-7 sm:p-10">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {copy.monthlyPlan}
                  </p>
                  <p className="mt-6 font-heading text-2xl font-semibold">
                    {copy.monthlyPrice}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {copy.trialNote}
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
