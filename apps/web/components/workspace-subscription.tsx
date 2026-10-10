"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useWorkspace } from "./workspace"
import { useCopy } from "./language-switcher"

export function WorkspaceSubscription({
  overview = false,
}: {
  overview?: boolean
}) {
  const { workspace } = useWorkspace()
  const { copy, language } = useCopy()
  if (
    workspace.accountKind !== "owner" ||
    !workspace.store ||
    !("trialStartedAt" in workspace.store)
  )
    return null
  const date = (value: number) =>
    new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Yangon",
    }).format(value)
  return (
    <>
      {!overview && (
        <div>
          <h1 className="font-heading text-3xl font-semibold">
            {copy.subscription}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.subscriptionIntro}
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Card className="bg-primary text-primary-foreground ring-0">
          <CardHeader className="gap-5">
            <Badge
              variant="outline"
              className="border-primary-foreground/25 text-primary-foreground"
            >
              {workspace.access?.active ? copy.activeTrial : copy.expiredTrial}
            </Badge>
            <CardTitle className="text-3xl font-semibold">
              <h2>
                {workspace.access?.active ? copy.storeReady : copy.expiredTrial}
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
      {!overview && (
        <p className="text-sm text-muted-foreground">{copy.renewalPending}</p>
      )}
    </>
  )
}
