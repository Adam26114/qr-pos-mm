"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Badge } from "@workspace/ui/components/badge"
import { FieldSet } from "@workspace/ui/components/field"
import { TextField } from "@workspace/ui/composed/text-field"
import { Feedback } from "@workspace/ui/composed/feedback"
import { FormCard } from "@workspace/ui/composed/form-card"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { api } from "@/convex/_generated/api"
import { useCopy } from "./language-switcher"
import { formError } from "@/lib/i18n"

export function StoreOnboarding({
  connected: canSubmit,
}: {
  connected: boolean
}) {
  const { copy } = useCopy()
  const createStore = useMutation(api.stores.create)
  const [failure, setFailure] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isReady },
  } = useForm<{ name: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().trim().min(2, "invalidName").max(80, "invalidName"),
      })
    ),
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
  return (
    <>
      <h1 className="font-heading text-3xl font-semibold">
        {copy.createStoreTitle}
      </h1>
      {failure && <Feedback tone="error">{copy.requestFailed}</Feedback>}
      <FormCard
        className="max-w-2xl"
        title={copy.trialPromise}
        description={copy.createStoreIntro}
      >
        <Badge variant="secondary">{copy.trialLabel}</Badge>
        <p className="mb-3 text-sm text-muted-foreground">{copy.trialNote}</p>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <FieldSet disabled={!isReady || isSubmitting || !canSubmit}>
            <TextField
              id="store-name"
              label={copy.storeName}
              autoComplete="organization"
              placeholder={copy.storePlaceholder}
              {...register("name")}
              error={
                errors.name ? formError(errors.name.message, copy) : undefined
              }
            />
            <SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
              {copy.createStore}
            </SubmitButton>
          </FieldSet>
        </form>
      </FormCard>
    </>
  )
}
