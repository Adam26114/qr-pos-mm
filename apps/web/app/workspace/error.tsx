"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Feedback } from "@workspace/ui/composed/feedback"
import { useCopy } from "@/components/language-switcher"

export default function WorkspaceError({ retry }: { retry: () => void }) {
  const { copy } = useCopy()
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            <h1>{copy.errorTitle}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Feedback tone="error">{copy.requestFailed}</Feedback>
          <Button onClick={retry}>{copy.retry}</Button>
        </CardContent>
      </Card>
    </main>
  )
}
