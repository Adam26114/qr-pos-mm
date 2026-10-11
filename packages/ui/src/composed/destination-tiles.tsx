"use client"

import { Button } from "@workspace/ui/components/button"

export function DestinationTiles({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="h-auto min-h-20 rounded-xl px-3 py-4 whitespace-normal shadow-none aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:text-foreground dark:aria-pressed:bg-muted"
        >
          <span className="[overflow-wrap:anywhere]">{option.label}</span>
        </Button>
      ))}
    </div>
  )
}
