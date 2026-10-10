"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@workspace/ui/components/card"
import { LanguageSwitcher, useCopy } from "./language-switcher"

export function AuthShell({
  children,
  intent = "owner",
}: {
  children: ReactNode
  intent?: "owner" | "staff"
}) {
  const { copy } = useCopy()
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 font-heading text-lg font-bold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm text-primary-foreground">
            Q
          </span>
          QR POS
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto grid max-w-7xl items-stretch gap-8 px-5 pb-8 sm:px-10 lg:min-h-[calc(100svh-100px)] lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <aside className="flex">
          <Card className="flex-1 justify-between bg-primary text-primary-foreground ring-0 [--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(12)]">
            <CardHeader className="gap-5">
              <p className="text-xs font-medium tracking-[0.22em] text-primary-foreground/80 uppercase">
                QR POS ·{" "}
                {intent === "staff" ? copy.staffAccount : copy.trialLabel}
              </p>
              <CardTitle className="max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
                <h1>{copy.homeTagline}</h1>
              </CardTitle>
              <CardDescription className="max-w-sm text-base leading-7 text-primary-foreground/80">
                {copy.homeIntro}
              </CardDescription>
            </CardHeader>
            {intent === "owner" && (
              <CardFooter className="mt-8 flex-wrap items-center justify-between gap-4 border-t border-primary-foreground/20">
                <Badge
                  variant="outline"
                  className="border-primary-foreground/25 text-primary-foreground"
                >
                  {copy.trialLabel}
                </Badge>
                <p className="text-sm">{copy.monthlyPrice}</p>
                <p className="w-full text-sm leading-6 text-primary-foreground/80">
                  {copy.trialPromise}
                </p>
              </CardFooter>
            )}
          </Card>
        </aside>
        <section className="flex items-center justify-center py-6 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  )
}
