"use client"

import type { Ref } from "react"
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"

type Option = { value: string; label: string }

export function ComboboxField({
  id,
  label,
  placeholder,
  emptyMessage,
  options,
  value,
  onValueChange,
  name,
  disabled,
  error,
  onBlur,
  ref,
}: {
  id: string
  label: string
  placeholder: string
  emptyMessage: string
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  name?: string
  disabled?: boolean
  error?: string
  onBlur?: () => void
  ref?: Ref<HTMLInputElement>
}) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <Field
      className="min-w-0"
      data-invalid={!!error}
      data-disabled={disabled || undefined}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        items={options}
        value={options.find((option) => option.value === value) ?? null}
        onValueChange={(option) => onValueChange(option?.value ?? "")}
        itemToStringLabel={(option) => option.label}
        itemToStringValue={(option) => option.value}
        name={name}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxInput
          id={id}
          ref={ref}
          onBlur={onBlur}
          placeholder={placeholder}
          triggerLabel={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className="h-12 w-full rounded-xl [&_input]:h-full [&_input]:px-4 [&_input]:text-base"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(option: Option) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  )
}
