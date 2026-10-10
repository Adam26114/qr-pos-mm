"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { LanguageSwitcher, useCopy } from "./language-switcher"

export function AuthShell({ children }: { children: ReactNode }) {
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
        <aside className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#123f35] p-8 text-[#effaf5] sm:p-12">
          <div>
            <p className="mb-8 text-xs font-medium tracking-[0.22em] text-[#b5d3c9] uppercase">
              QR POS · {copy.trialLabel}
            </p>
            <h1 className="max-w-lg font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              {copy.homeTagline}
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-[#c4ddd5]">
              {copy.homeIntro}
            </p>
          </div>
          <div className="mt-14 rounded-2xl border border-[#528170] bg-[#194f42] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight">
                {copy.trialLabel}
              </p>
              <span className="text-sm text-[#c4ddd5]">
                {copy.monthlyPrice}
              </span>
            </div>
            <div aria-hidden="true" className="mt-6 grid grid-cols-7 gap-2">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="h-2 rounded-sm bg-[#b7e3d1]" />
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[#c4ddd5]">
              {copy.trialPromise}
            </p>
          </div>
        </aside>
        <section className="flex items-center justify-center py-6 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  )
}
