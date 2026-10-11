"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  ImageUpload01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { Controller, useForm } from "react-hook-form"
import { useConvex, useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { TextField } from "@workspace/ui/composed/text-field"
import { FormCard } from "@workspace/ui/composed/form-card"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { authClient } from "@/lib/auth-client"
import { menuError, type MenuCategory, type MenuItem } from "@/lib/menu"
import { formError, type MessageKey } from "@/lib/i18n"
import { useCopy } from "./language-switcher"

type Fields = {
  name: string
  description: string
  price: string
  categoryId: string
  available: boolean
}

export function MenuItemEditor({
  storeId,
  item,
  categories,
  connected,
  onSaved,
  onCancel,
  embedded = false,
  onPendingChange,
}: {
  storeId: Id<"stores">
  item?: MenuItem
  categories: MenuCategory[]
  connected: boolean
  onSaved: () => void
  onCancel: () => void
  embedded?: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  const { copy } = useCopy()
  const client = useConvex()
  const save = useMutation(api.menu.saveItem)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{
    file: File
    url: string
  } | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const file = selectedPhoto?.file ?? null
  const previewUrl = selectedPhoto?.url
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
  function chooseFile(nextFile: File | null) {
    setSelectedPhoto(
      nextFile ? { file: nextFile, url: URL.createObjectURL(nextFile) } : null
    )
    setRemovePhoto(false)
  }
  const initial: Fields = {
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? String(item.price) : "",
    categoryId: item?.categoryId ?? categories[0]!._id,
    available: item?.available ?? true,
  }
  const schema = z.object({
    name: z
      .string()
      .max(120, "invalidMenuName")
      .refine((value) => !!value.trim(), "invalidMenuName"),
    description: z.string().max(2000, "invalidDescription"),
    price: z
      .string()
      .refine(
        (value) =>
          /^\d+$/.test(value) &&
          Number.isSafeInteger(Number(value)) &&
          Number(value) > 0,
        "invalidPrice"
      ),
    categoryId: z.string().min(1, "chooseCategory"),
    available: z.boolean(),
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isReady, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: initial })
  const disabled = !isReady || isSubmitting || !connected
  async function submit(values: Fields) {
    if (
      !connected ||
      !navigator.onLine ||
      !client.connectionState().isWebSocketConnected
    )
      return
    setFailure(null)
    setSaved(false)
    onPendingChange?.(true)
    try {
      let photoId = removePhoto ? null : (item?.photoId ?? null)
      if (file) {
        if (file.size > 5 * 1024 * 1024)
          throw new ConvexError("PHOTO_TOO_LARGE")
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
          throw new ConvexError("INVALID_PHOTO")
        const { data } = await authClient.convex.token()
        if (!data?.token) throw new Error("Authentication required")
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/menu-photo?storeId=${storeId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": file.type,
              Authorization: `Bearer ${data.token}`,
            },
            body: file,
          }
        )
        const result = (await response.json()) as {
          photoId?: Id<"menuPhotos">
          code?: string
        }
        if (!response.ok || !result.photoId)
          throw new ConvexError(result.code ?? "INVALID_PHOTO")
        photoId = result.photoId
      }
      if (!navigator.onLine || !client.connectionState().isWebSocketConnected)
        throw new Error("Disconnected")
      await save({
        storeId,
        itemId: item?._id,
        ...values,
        categoryId: values.categoryId as Id<"menuCategories">,
        price: Number(values.price),
        photoId,
      })
      reset({
        name: "",
        description: "",
        price: "",
        categoryId: categories[0]!._id,
        available: true,
      })
      setSelectedPhoto(null)
      setRemovePhoto(false)
      if (fileInput.current) fileInput.current.value = ""
      setSaved(true)
      onSaved()
    } catch (error) {
      setFailure(menuError(error))
    } finally {
      onPendingChange?.(false)
    }
  }
  const photoUrl = selectedPhoto?.url ?? (!removePhoto ? item?.photoUrl : null)
  const content = (
    <>
      <form
        className={embedded ? "flex min-h-0 flex-1 flex-col" : undefined}
        onSubmit={(event) => {
          void handleSubmit(submit)(event)
        }}
        noValidate
      >
        <div
          className={
            embedded ? "min-h-0 flex-1 overflow-y-auto px-6 py-5" : undefined
          }
        >
          <FieldSet disabled={disabled} className="gap-5">
            <TextField
              autoFocus
              id="item-name"
              label={copy.itemName}
              {...register("name")}
              error={
                errors.name ? formError(errors.name.message, copy) : undefined
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="item-price"
                label={copy.itemPrice}
                description={copy.finalPriceNote}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                {...register("price")}
                error={
                  errors.price
                    ? formError(errors.price.message, copy)
                    : undefined
                }
              />
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.categoryId} className="min-w-0">
                    <FieldLabel htmlFor="item-category">
                      {copy.itemCategory}
                    </FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? "")}
                      name={field.name}
                      disabled={disabled}
                      items={categories.map((category) => ({
                        value: category._id,
                        label: category.name,
                      }))}
                    >
                      <SelectTrigger
                        id="item-category"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        className="w-full"
                        aria-invalid={!!errors.categoryId}
                        aria-describedby={
                          errors.categoryId ? "category-error" : undefined
                        }
                      >
                        <SelectValue placeholder={copy.chooseCategory} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.categoryId && (
                      <FieldError id="category-error">
                        {formError(errors.categoryId.message, copy)}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>
            <Field>
              <FieldLabel id="photo-label" htmlFor="item-photo">
                {copy.itemPhoto}
              </FieldLabel>
              <Input
                id="item-photo"
                type="file"
                className="hidden"
                aria-label={copy.itemPhoto}
                accept="image/png,image/jpeg,image/webp"
                ref={fileInput}
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
              />
              <div
                className="relative flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-muted/20 p-5 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!disabled && event.dataTransfer.files.length)
                    chooseFile(event.dataTransfer.files[0] ?? null)
                }}
              >
                {photoUrl ? (
                  <div className="relative h-40 w-full">
                    <Image
                      src={photoUrl}
                      alt={file?.name ?? item?.name ?? copy.itemPhoto}
                      fill
                      unoptimized
                      className="rounded-md object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground">
                    <HugeiconsIcon
                      icon={ImageUpload01Icon}
                      size={22}
                      aria-hidden="true"
                    />
                  </div>
                )}
                {(file || (!removePhoto && item?.photoId)) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-3 right-3 z-10 rounded-full"
                    aria-label={copy.removePhoto}
                    onClick={() => {
                      setSelectedPhoto(null)
                      setRemovePhoto(true)
                      if (fileInput.current) fileInput.current.value = ""
                    }}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={16}
                      aria-hidden="true"
                    />
                  </Button>
                )}
                <p
                  id="photo-current"
                  className="max-w-full text-sm [overflow-wrap:anywhere] text-muted-foreground"
                >
                  {file?.name ??
                    (!removePhoto && item?.photoId
                      ? copy.currentPhoto
                      : copy.noPhotoChosen)}
                </p>
                <FieldDescription id="photo-note" className="text-center">
                  {copy.photoNote}
                </FieldDescription>
                <Button
                  id="choose-photo"
                  type="button"
                  variant="outline"
                  aria-describedby="photo-label photo-note photo-current"
                  onClick={() => fileInput.current?.click()}
                >
                  <HugeiconsIcon
                    icon={Upload04Icon}
                    size={16}
                    aria-hidden="true"
                  />
                  {copy.choosePhoto}
                </Button>
              </div>
              {file && (
                <FieldDescription role="status">
                  {copy.photoSelected}
                </FieldDescription>
              )}
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="item-description">
                {copy.itemDescription}
              </FieldLabel>
              <Textarea
                id="item-description"
                className="min-h-20"
                {...register("description")}
                aria-invalid={!!errors.description}
                aria-describedby={`description-note${errors.description ? " description-error" : ""}`}
              />
              <FieldDescription id="description-note">
                {copy.optionalDescription}
              </FieldDescription>
              {errors.description && (
                <FieldError id="description-error">
                  {formError(errors.description.message, copy)}
                </FieldError>
              )}
            </Field>
            <Controller
              name="available"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="item-available">
                    {copy.availableItem}
                  </FieldLabel>
                  <Switch
                    id="item-available"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    disabled={disabled}
                  />
                </Field>
              )}
            />
            {failure && <Feedback tone="error">{copy[failure]}</Feedback>}
            {saved && !embedded && <Feedback>{copy.itemSaved}</Feedback>}
          </FieldSet>
        </div>
        <DialogFooter
          className={cn(
            "flex-row flex-wrap justify-end gap-2 border-t pt-4",
            embedded && "shrink-0 bg-popover px-6 py-4"
          )}
        >
          {(embedded || item) && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              {copy.cancel}
            </Button>
          )}
          <SubmitButton
            className="h-9 w-auto rounded-md"
            disabled={disabled}
            pending={isSubmitting}
            pendingLabel={copy.working}
          >
            {item ? copy.saveItem : copy.addItem}
          </SubmitButton>
        </DialogFooter>
      </form>
    </>
  )
  return embedded ? (
    content
  ) : (
    <FormCard title={item ? copy.editItem : copy.addItem}>{content}</FormCard>
  )
}
