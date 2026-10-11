"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "cn"

type SearchProps = {
  searchLabel: string
  search: string
  onSearchChange: (value: string) => void
}
type CategoryProps = {
  categoryLabel: string
  allLabel: string
  categories: { id: string; label: string }[]
  selectedCategory: string
  onCategoryChange: (id: string) => void
}

export function CatalogSearch({
  searchLabel,
  search,
  onSearchChange,
}: SearchProps) {
  return (
    <div className="relative min-w-0">
      <HugeiconsIcon
        icon={Search01Icon}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        className="pl-9"
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  )
}

export function CatalogCategories({
  categoryLabel,
  allLabel,
  categories,
  selectedCategory,
  onCategoryChange,
  tiles = false,
}: CategoryProps & { tiles?: boolean }) {
  const selected = categories.some(
    (category) => category.id === selectedCategory
  )
    ? selectedCategory
    : "all"
  return (
    <div
      role="group"
      aria-label={categoryLabel}
      className="flex gap-3 overflow-x-auto pb-2"
    >
      {[{ id: "all", label: allLabel }, ...categories].map((category) => (
        <Button
          key={category.id}
          variant={tiles || selected !== category.id ? "outline" : "default"}
          aria-pressed={selected === category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            "h-auto min-h-16 min-w-28 shrink-0 px-5 py-3 text-sm whitespace-normal",
            tiles &&
              "min-h-24 min-w-32 rounded-xl shadow-none aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:text-foreground sm:min-h-28 sm:min-w-36 dark:aria-pressed:bg-muted"
          )}
        >
          <span className="max-w-44 [overflow-wrap:anywhere]">
            {category.label}
          </span>
        </Button>
      ))}
    </div>
  )
}

export function CatalogFilters(props: SearchProps & CategoryProps) {
  return (
    <div className="space-y-4">
      <CatalogSearch {...props} />
      <CatalogCategories {...props} />
    </div>
  )
}
