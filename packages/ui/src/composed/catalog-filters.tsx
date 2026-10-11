"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export function CatalogFilters({
  searchLabel,
  categoryLabel,
  allLabel,
  search,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
}: {
  searchLabel: string
  categoryLabel: string
  allLabel: string
  search: string
  onSearchChange: (value: string) => void
  categories: { id: string; label: string }[]
  selectedCategory: string
  onCategoryChange: (id: string) => void
}) {
  const selected = categories.some(
    (category) => category.id === selectedCategory
  )
    ? selectedCategory
    : "all"
  return (
    <div className="space-y-4">
      <Input
        type="search"
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div
        role="group"
        aria-label={categoryLabel}
        className="flex gap-3 overflow-x-auto pb-2"
      >
        {[{ id: "all", label: allLabel }, ...categories].map((category) => (
          <Button
            key={category.id}
            variant={selected === category.id ? "default" : "outline"}
            aria-pressed={selected === category.id}
            onClick={() => onCategoryChange(category.id)}
            className="h-auto min-h-16 min-w-28 shrink-0 px-5 py-3 text-sm whitespace-normal"
          >
            <span className="max-w-44 [overflow-wrap:anywhere]">
              {category.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
