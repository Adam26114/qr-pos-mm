"use client"

import { Button } from "@workspace/ui/components/button"
import { useCopy } from "@/components/language-switcher"

export default function WorkspaceError({ retry }: { retry: () => void }) {
  const { copy } = useCopy()
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold">{copy.errorTitle}</h1>
      <p>{copy.requestFailed}</p>
      <Button onClick={retry}>{copy.retry}</Button>
    </main>
  )
}
