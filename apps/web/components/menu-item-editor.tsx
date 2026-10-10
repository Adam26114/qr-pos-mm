"use client"

import Image from "next/image"
import { useRef, useState } from "react"
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
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
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
      setFile(null)
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
  const content = (
    <>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <FieldSet disabled={disabled}>
          <TextField
            autoFocus={!!item}
            id="item-name"
            label={copy.itemName}
            {...register("name")}
            error={
              errors.name ? formError(errors.name.message, copy) : undefined
            }
          />
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="item-description">
              {copy.itemDescription}
            </FieldLabel>
            <Textarea
              id="item-description"
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
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Field data-invalid={!!errors.categoryId}>
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
              errors.price ? formError(errors.price.message, copy) : undefined
            }
          />
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
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setRemovePhoto(false)
              }}
            />
            <Button
              id="choose-photo"
              type="button"
              variant="outline"
              aria-describedby="photo-label photo-note photo-current"
              onClick={() => fileInput.current?.click()}
            >
              {copy.choosePhoto}
            </Button>
            <p
              id="photo-current"
              className="text-sm [overflow-wrap:anywhere] text-muted-foreground"
            >
              {file?.name ??
                (!removePhoto && item?.photoId
                  ? copy.currentPhoto
                  : copy.noPhotoChosen)}
            </p>
            <FieldDescription id="photo-note">
              {copy.photoNote}
            </FieldDescription>
          </Field>
          {file && (
            <p className="text-sm text-muted-foreground">
              {copy.photoSelected}
            </p>
          )}
          {!removePhoto && item?.photoUrl && (
            <Image
              src={item.photoUrl}
              alt={item.name}
              width={96}
              height={96}
              unoptimized
              className="size-24 rounded-xl object-cover"
            />
          )}
          {(file || (!removePhoto && item?.photoId)) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null)
                setRemovePhoto(true)
                if (fileInput.current) fileInput.current.value = ""
              }}
            >
              {copy.removePhoto}
            </Button>
          )}
          <SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
            {item ? copy.saveItem : copy.addItem}
          </SubmitButton>
        </FieldSet>
        {failure && (
          <Feedback tone="error" className="mt-4">
            {copy[failure]}
          </Feedback>
        )}
        {saved && !embedded && (
          <Feedback className="mt-4">{copy.itemSaved}</Feedback>
        )}
      </form>
      {item && (
        <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {copy.cancelEditing}
        </Button>
      )}
    </>
  )
  return embedded ? (
    content
  ) : (
    <FormCard title={item ? copy.editItem : copy.addItem}>{content}</FormCard>
  )
}
