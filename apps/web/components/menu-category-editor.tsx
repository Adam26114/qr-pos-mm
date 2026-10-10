"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import { FieldSet } from "@workspace/ui/components/field"
import { FormCard } from "@workspace/ui/composed/form-card"
import { TextField } from "@workspace/ui/composed/text-field"
import { Feedback } from "@workspace/ui/composed/feedback"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { menuError, type MenuCategory } from "@/lib/menu"
import { formError, type MessageKey } from "@/lib/i18n"
import { useCopy } from "./language-switcher"

export function MenuCategoryEditor({
  storeId,
  category,
  connected,
  onDone,
}: {
  storeId: Id<"stores">
  category?: MenuCategory
  connected: boolean
  onDone: () => void
}) {
  const { copy } = useCopy()
  const save = useMutation(api.menu.saveCategory)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isReady, isSubmitting },
  } = useForm<{ name: string }>({
    resolver: zodResolver(
      z.object({
        name: z
          .string()
          .max(120, "invalidMenuName")
          .refine((value) => !!value.trim(), "invalidMenuName"),
      })
    ),
    defaultValues: { name: category?.name ?? "" },
  })
  async function submit(values: { name: string }) {
    if (!connected) return
    setFailure(null)
    setSaved(false)
    try {
      await save({ storeId, categoryId: category?._id, ...values })
      reset({ name: "" })
      setSaved(true)
      onDone()
    } catch (error) {
      setFailure(menuError(error))
    }
  }
  return (
    <FormCard title={category ? copy.editCategory : copy.addCategory}>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <FieldSet disabled={!isReady || isSubmitting || !connected}>
          <TextField
            autoFocus={!!category}
            id="category-name"
            label={copy.categoryName}
            {...register("name")}
            error={
              errors.name ? formError(errors.name.message, copy) : undefined
            }
          />
          <SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
            {category ? copy.saveCategory : copy.addCategory}
          </SubmitButton>
        </FieldSet>
        {failure && (
          <Feedback tone="error" className="mt-4">
            {copy[failure]}
          </Feedback>
        )}
        {saved && <Feedback className="mt-4">{copy.categorySaved}</Feedback>}
      </form>
      {category && (
        <Button variant="outline" disabled={isSubmitting} onClick={onDone}>
          {copy.cancelEditing}
        </Button>
      )}
    </FormCard>
  )
}
