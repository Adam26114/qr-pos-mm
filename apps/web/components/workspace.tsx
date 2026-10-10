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
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { FieldSet } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { TextField } from "@workspace/ui/composed/text-field"
import { Feedback } from "@workspace/ui/composed/feedback"
import { FormCard } from "@workspace/ui/composed/form-card"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { StaffManager } from "./staff-manager"
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
        {!online && <Feedback className="mb-6">{copy.offline}</Feedback>}
        {online &&
          connection.hasEverConnected &&
          (connection.isWebSocketConnected ? (
            <Badge variant="outline" role="status" className="mb-6">
              {copy.online}
            </Badge>
          ) : (
            <Feedback className="mb-6">{copy.disconnected}</Feedback>
          ))}
        {!workspace ? (
          <LoadingState label={copy.loading} />
        ) : (
          <>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              {workspace.accountKind === "staff"
                ? copy.staffWorkspace
                : copy.ownerWorkspace}
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
              <h1 className="font-heading text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
                {workspace.store?.name ??
                  (workspace.accountKind === "staff"
                    ? copy.staffAccessRemoved
                    : copy.createStoreTitle)}
              </h1>
              <p className="text-sm break-all text-muted-foreground">
                {workspace.user.name} · {workspace.user.email}
              </p>
            </div>
            {(failure || signOutFailed) && (
              <Feedback tone="error" className="mt-6">
                {copy.requestFailed}
              </Feedback>
            )}
            {workspace.accountKind === "staff" ? (
              <Card className="mt-10">
                <CardHeader>
                  <CardTitle>
                    <h2>
                      {workspace.store
                        ? copy.staffReady
                        : copy.staffAccessRemoved}
                    </h2>
                  </CardTitle>
                  <CardDescription>
                    {workspace.store
                      ? copy.staffReadyIntro
                      : copy.staffAccessRemovedIntro}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : !workspace.store ? (
              <FormCard
                className="mt-10 max-w-2xl"
                title={copy.trialPromise}
                description={copy.createStoreIntro}
              >
                <Badge variant="secondary">{copy.trialLabel}</Badge>
                <p className="mb-3 text-sm text-muted-foreground">
                  {copy.trialNote}
                </p>
                <form onSubmit={handleSubmit(submit)} noValidate>
                  <FieldSet disabled={!isReady || isSubmitting || !canSubmit}>
                    <TextField
                      id="store-name"
                      label={copy.storeName}
                      autoComplete="organization"
                      placeholder={copy.storePlaceholder}
                      {...register("name")}
                      error={
                        errors.name
                          ? formError(errors.name.message, copy)
                          : undefined
                      }
                    />
                    <SubmitButton
                      pending={isSubmitting}
                      pendingLabel={copy.working}
                    >
                      {copy.createStore}
                    </SubmitButton>
                  </FieldSet>
                </form>
              </FormCard>
            ) : (
              <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
                <Card className="bg-primary text-primary-foreground ring-0">
                  <CardHeader className="gap-5">
                    <Badge
                      variant="outline"
                      className="border-primary-foreground/25 text-primary-foreground"
                    >
                      {workspace.access?.active
                        ? copy.activeTrial
                        : copy.expiredTrial}
                    </Badge>
                    <CardTitle className="text-3xl font-semibold">
                      <h2>
                        {workspace.access?.active
                          ? copy.storeReady
                          : copy.expiredTrial}
                      </h2>
                    </CardTitle>
                    <CardDescription className="max-w-md leading-7 text-primary-foreground/80">
                      {workspace.access?.active
                        ? copy.storeReadyIntro
                        : copy.expiryIntro}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="gap-6">
                    <Separator className="bg-primary-foreground/20" />
                    <dl className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-primary-foreground/75">
                          {copy.trialStarted}
                        </dt>
                        <dd className="mt-2 text-sm">
                          {date(workspace.store.trialStartedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-primary-foreground/75">
                          {copy.trialEnds}
                        </dt>
                        <dd data-testid="trial-end" className="mt-2 text-sm">
                          {date(workspace.store.trialEndsAt)}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="gap-5">
                    <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      {copy.monthlyPlan}
                    </p>
                    <CardTitle className="text-2xl font-semibold">
                      {copy.monthlyPrice}
                    </CardTitle>
                    <CardDescription className="leading-7">
                      {copy.trialNote}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}
            {workspace.accountKind === "owner" && workspace.store && (
              <StaffManager
                storeId={workspace.store._id}
                connected={canSubmit}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
