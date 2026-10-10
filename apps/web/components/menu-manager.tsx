"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { ConfirmAction } from "@workspace/ui/composed/confirm-action"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { formatMMK } from "@/lib/menu"
import { useCopy } from "./language-switcher"
import { MenuCategoryEditor } from "./menu-category-editor"
import { MenuItemEditor } from "./menu-item-editor"
import { MenuPreview } from "./menu-preview"

export function MenuManager({
  storeId,
  connected,
}: {
  storeId: Id<"stores">
  connected: boolean
}) {
  const { copy } = useCopy()
  const menu = useQuery(api.menu.manage, { storeId })
  const removeItem = useMutation(api.menu.removeItem)
  const removeCategory = useMutation(api.menu.removeCategory)
  const [editingCategory, setEditingCategory] =
    useState<Id<"menuCategories"> | null>(null)
  const [editingItem, setEditingItem] = useState<Id<"menuItems"> | null>(null)
  if (!menu) return <LoadingState label={copy.loading} />
  const categories = menu.categories.filter(
    (category) => category.removedAt === null
  )
  const items = menu.items.filter((item) => item.removedAt === null)
  const removedItems = menu.items.filter((item) => item.removedAt !== null)
  const category = categories.find(
    (category) => category._id === editingCategory
  )
  const item = items.find((item) => item._id === editingItem)
  const confirmation = {
    cancelLabel: copy.keepAccess,
    pendingLabel: copy.working,
    failureMessage: copy.requestFailed,
    disabled: !connected,
  }
  return (
    <section aria-label={copy.menuManagement} className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">
          {copy.menuManagement}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.menuIntro}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <MenuCategoryEditor
            key={category?._id ?? "new-category"}
            storeId={storeId}
            category={category}
            connected={connected}
            onDone={() =>
              setEditingCategory((current) =>
                current === (category?._id ?? null) ? null : current
              )
            }
          />
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{copy.categories}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {copy.noCategories}
                </p>
              ) : (
                <ul className="space-y-4">
                  {categories.map((category) => {
                    const used = items.some(
                      (item) => item.categoryId === category._id
                    )
                    return (
                      <li
                        key={category._id}
                        className="space-y-3 border-b border-border pb-4 last:border-0"
                      >
                        <p className="font-medium [overflow-wrap:anywhere]">
                          {category.name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={!connected}
                            onClick={() => setEditingCategory(category._id)}
                          >
                            {copy.editCategory}
                          </Button>
                          <ConfirmAction
                            {...confirmation}
                            disabled={!connected || used}
                            label={copy.removeCategory}
                            title={copy.removeCategoryTitle}
                            description={`${category.name} — ${copy.removeCategoryIntro}`}
                            onConfirm={() => {
                              if (!connected)
                                return Promise.reject(new Error("Disconnected"))
                              return removeCategory({
                                storeId,
                                categoryId: category._id,
                              })
                            }}
                          />
                        </div>
                        {used && (
                          <p className="text-xs text-muted-foreground">
                            {copy.categoryInUse}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        {categories.length > 0 ? (
          <MenuItemEditor
            key={item?._id ?? "new-item"}
            storeId={storeId}
            item={item}
            categories={categories}
            connected={connected}
            onDone={() =>
              setEditingItem((current) =>
                current === (item?._id ?? null) ? null : current
              )
            }
          />
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {copy.noCategories}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>{copy.menuItems}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.noMenuItems}
              </p>
            ) : (
              <ul className="space-y-5">
                {items.map((item) => (
                  <li
                    key={item._id}
                    className="space-y-3 border-b border-border pb-4 last:border-0"
                  >
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {item.name}
                    </p>
                    <p className="text-sm">{formatMMK(item.price)}</p>
                    <Badge variant={item.available ? "secondary" : "outline"}>
                      {item.available
                        ? copy.availableItem
                        : copy.unavailableItem}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={!connected}
                        onClick={() => setEditingItem(item._id)}
                      >
                        {copy.editItem}
                      </Button>
                      <ConfirmAction
                        {...confirmation}
                        label={copy.removeFromSale}
                        title={copy.removeItemTitle}
                        description={`${item.name} — ${copy.removeItemIntro}`}
                        onConfirm={() => {
                          if (!connected)
                            return Promise.reject(new Error("Disconnected"))
                          return removeItem({ storeId, itemId: item._id })
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <MenuPreview menu={menu} />
      </div>
      {removedItems.length > 0 && (
        <section aria-label={copy.removedItems}>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{copy.removedItems}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {removedItems.map((item) => (
                  <li
                    key={item._id}
                    className="flex flex-wrap justify-between gap-3 text-sm"
                  >
                    <span className="[overflow-wrap:anywhere]">
                      {item.name}
                    </span>
                    <span>{formatMMK(item.price)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </section>
  )
}

export function StaffMenu({ storeId }: { storeId: Id<"stores"> }) {
  const { copy } = useCopy()
  const menu = useQuery(api.menu.view, { storeId })
  return (
    <div className="space-y-6">
      {menu ? (
        <MenuPreview menu={menu} />
      ) : (
        <LoadingState label={copy.loading} />
      )}
    </div>
  )
}
