"use client"

import type { ReactNode } from "react"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import type { CatalogCategoryProps } from "@workspace/ui/composed/catalog-filters"

export function CatalogTabs({
  categoryLabel,
  allLabel,
  categories,
  selectedCategory,
  onCategoryChange,
  children,
}: CatalogCategoryProps & { children: ReactNode }) {
  const options = [{ id: "all", label: allLabel }, ...categories]
  const selected = options.some((category) => category.id === selectedCategory)
    ? selectedCategory
    : "all"
  return (
    <Tabs
      value={selected}
      onValueChange={(value) => {
        if (typeof value === "string") onCategoryChange(value)
      }}
      className="min-w-0 gap-4"
    >
      <div className="overflow-x-auto border-b">
        <TabsList
          variant="line"
          aria-label={categoryLabel}
          className="h-10 justify-start gap-4 p-0"
        >
          {options.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              title={category.label}
              className="max-w-48 flex-none px-1 group-data-horizontal/tabs:after:bottom-0"
            >
              <span className="truncate">{category.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {options.map((category) => (
        <TabsContent
          key={category.id}
          value={category.id}
          className="space-y-4"
        >
          {selected === category.id ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
