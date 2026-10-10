"use client"
import Image from "next/image"
import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { CatalogCard } from "@workspace/ui/composed/catalog-card"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { ConfirmAction } from "@workspace/ui/composed/confirm-action"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatMMK, type Menu } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import { useCopy } from "./language-switcher"
import { MenuCategoryEditor } from "./menu-category-editor"
import { MenuItemEditor } from "./menu-item-editor"
import { TableManager } from "./table-manager"
import { useSubmissionAttempt } from "@/lib/submission-attempt"
import { useWorkspace } from "./workspace"
import { PosCart, type CartLine } from "./pos-cart"

export function MenuManager({
  storeId,
  connected,
  owner = true,
}: {
  storeId: Id<"stores">
  connected: boolean
  owner?: boolean
}) {
  const managed = useQuery(api.menu.manage, owner ? { storeId } : "skip")
  const viewed = useQuery(api.menu.view, owner ? "skip" : { storeId })
  const menu = owner ? managed : viewed
  if (!menu) return <MenuLoading />
  return (
    <MenuCatalog
      key={storeId}
      menu={menu}
      storeId={storeId}
      owner={owner}
      connected={connected}
    />
  )
}
function MenuLoading() {
  const { copy } = useCopy()
  return <LoadingState label={copy.loading} />
}

function MenuCatalog({
  menu,
  storeId,
  owner,
  connected,
}: {
  menu: Menu
  storeId: Id<"stores">
  owner: boolean
  connected: boolean
}) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const action = usePosCommand()
  const { workspace } = useWorkspace()
  const recovery = useSubmissionAttempt(
    `qr-pos-submission:${workspace.user._id}:${storeId}`,
    storeId
  )
  const removeItem = useMutation(api.menu.removeItem)
  const removeCategory = useMutation(api.menu.removeCategory)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<string>("all")
  const [dialog, setDialog] = useState<"item" | "categories" | "tables" | null>(
    null
  )
  const [editingItem, setEditingItem] = useState<Id<"menuItems"> | null>(null)
  const [editingCategory, setEditingCategory] =
    useState<Id<"menuCategories"> | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState<"itemSaved" | "categorySaved" | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [note, setNote] = useState("")
  const categories = menu.categories.filter(
    (category) => category.removedAt === null
  )
  const items = menu.items.filter((item) => item.removedAt === null)
  const item = items.find((item) => item._id === editingItem)
  const category = categories.find(
    (category) => category._id === editingCategory
  )
  const visible = items.filter(
    (item) =>
      (filter === "all" ||
        !categories.some((c) => c._id === filter) ||
        item.categoryId === filter) &&
      `${item.name} ${item.description}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
  )
  function add(itemId: Id<"menuItems">) {
    setLines((current) =>
      current.some((line) => line.itemId === itemId)
        ? current.map((line) =>
            line.itemId === itemId
              ? { ...line, quantity: Math.min(99, line.quantity + 1) }
              : line
          )
        : [...current, { itemId, quantity: 1 }]
    )
  }
  const confirmation = {
    cancelLabel: copy.keepAccess,
    pendingLabel: copy.working,
    failureMessage: copy.requestFailed,
    disabled: !connected,
  }
  return (
    <section aria-label={copy.menuManagement} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold">{copy.menu}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{pos.posIntro}</p>
        </div>
        {owner && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!connected}
              onClick={() => setDialog("categories")}
            >
              {copy.categories}
            </Button>
            <Button
              variant="outline"
              disabled={!connected}
              onClick={() => setDialog("tables")}
            >
              {pos.tables}
            </Button>
            <Button
              disabled={!connected || !categories.length}
              onClick={() => {
                setSaved(null)
                setEditingItem(null)
                setDialog("item")
              }}
            >
              {copy.addItem}
            </Button>
          </div>
        )}
      </div>
      {saved && <Feedback>{copy[saved]}</Feedback>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label={copy.menuPreview} className="min-w-0 space-y-5">
          <Input
            aria-label={pos.search}
            placeholder={pos.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
          />
          <div
            aria-label={pos.filterCategory}
            className="flex gap-3 overflow-x-auto pb-2"
          >
            {[{ _id: "all", name: pos.allItems }, ...categories].map(
              (category) => (
                <Button
                  key={category._id}
                  variant={filter === category._id ? "default" : "outline"}
                  aria-pressed={filter === category._id}
                  onClick={() => setFilter(category._id)}
                  className="h-auto min-h-16 min-w-28 shrink-0 px-5 py-3 text-sm whitespace-normal"
                >
                  <span className="max-w-44 [overflow-wrap:anywhere]">
                    {category.name}
                  </span>
                </Button>
              )
            )}
          </div>
          {!categories.length && (
            <Feedback>{owner ? copy.noCategories : copy.noMenuItems}</Feedback>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {visible.map((item) => (
              <CatalogCard
                key={item._id}
                title={item.name}
                description={item.description}
                price={formatMMK(item.price)}
                image={
                  item.photoUrl ? (
                    <Image
                      src={item.photoUrl}
                      alt={item.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 300px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {pos.noPhoto}
                    </div>
                  )
                }
                status={
                  !item.available ? (
                    <Badge variant="outline">{copy.unavailableItem}</Badge>
                  ) : undefined
                }
                actions={
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={
                        !item.available || !connected || !!recovery.attempt
                      }
                      aria-label={`${pos.addToCart}: ${item.name}`}
                      onClick={() => add(item._id)}
                    >
                      {pos.addToCart}
                    </Button>
                    {owner && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!connected}
                          onClick={() => {
                            setSaved(null)
                            setEditingItem(item._id)
                            setDialog("item")
                          }}
                        >
                          {copy.editItem}
                        </Button>
                        <ConfirmAction
                          {...confirmation}
                          label={copy.removeFromSale}
                          title={copy.removeItemTitle}
                          description={`${item.name} — ${copy.removeItemIntro}`}
                          onConfirm={() => {
                            if (!action.ready())
                              return Promise.reject(new Error("Disconnected"))
                            return removeItem({ storeId, itemId: item._id })
                          }}
                        />
                      </div>
                    )}
                  </div>
                }
              />
            ))}
          </div>
          {!visible.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {items.length ? pos.noResults : copy.noMenuItems}
            </p>
          )}
        </section>
        <PosCart
          storeId={storeId}
          recovery={recovery}
          items={items}
          lines={lines}
          setLines={setLines}
          note={note}
          setNote={setNote}
        />
      </div>
      {owner && menu.items.some((item) => item.removedAt !== null) && (
        <section
          aria-label={copy.removedItems}
          className="space-y-2 border-t pt-4"
        >
          <h2 className="font-medium">{copy.removedItems}</h2>
          {menu.items
            .filter((item) => item.removedAt !== null)
            .map((item) => (
              <p
                key={item._id}
                className="flex justify-between gap-3 text-sm [overflow-wrap:anywhere]"
              >
                <span>{item.name}</span>
                <span>{formatMMK(item.price)}</span>
              </p>
            ))}
        </section>
      )}
      {owner && (
        <>
          <EditorDialog
            open={dialog === "item"}
            title={editingItem ? copy.editItem : copy.addItem}
            closeLabel={pos.close}
            pending={pending}
            onClose={() => setDialog(null)}
          >
            {categories.length > 0 && (!editingItem || item) ? (
              <MenuItemEditor
                key={editingItem ?? "new"}
                embedded
                storeId={storeId}
                item={item}
                onCancel={() => setDialog(null)}
                categories={categories}
                connected={connected}
                onPendingChange={setPending}
                onSaved={() => {
                  setDialog(null)
                  setSaved("itemSaved")
                }}
              />
            ) : (
              <Feedback>{copy.itemRemoved}</Feedback>
            )}
          </EditorDialog>
          <EditorDialog
            open={dialog === "categories"}
            title={copy.categories}
            closeLabel={pos.close}
            pending={pending}
            onClose={() => setDialog(null)}
          >
            <MenuCategoryEditor
              key={category?._id ?? "new"}
              embedded
              storeId={storeId}
              category={category}
              onCancel={() => setEditingCategory(null)}
              connected={connected}
              onPendingChange={setPending}
              onSaved={() => {
                setEditingCategory(null)
                setSaved("categorySaved")
              }}
            />
            <ul className="space-y-4">
              {categories.map((category) => {
                const used = items.some(
                  (item) => item.categoryId === category._id
                )
                return (
                  <li key={category._id} className="space-y-2 border-t pt-3">
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {category.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={pending || !connected}
                        onClick={() => {
                          setSaved(null)
                          setEditingCategory(category._id)
                        }}
                      >
                        {copy.editCategory}
                      </Button>
                      <ConfirmAction
                        {...confirmation}
                        disabled={pending || !connected || used}
                        label={copy.removeCategory}
                        title={copy.removeCategoryTitle}
                        description={`${category.name} — ${copy.removeCategoryIntro}`}
                        onConfirm={() => {
                          if (!action.ready())
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
          </EditorDialog>
          <EditorDialog
            open={dialog === "tables"}
            title={pos.tables}
            description={pos.tableIntro}
            closeLabel={pos.close}
            pending={pending}
            onClose={() => setDialog(null)}
          >
            <TableManager storeId={storeId} onPendingChange={setPending} />
          </EditorDialog>
        </>
      )}
    </section>
  )
}
