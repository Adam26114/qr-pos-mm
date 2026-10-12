"use client"

import Image from "next/image"
import { useState } from "react"
import { useConvexConnectionState, useQuery } from "convex/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CatalogCard } from "@workspace/ui/composed/catalog-card"
import { CatalogFilters } from "@workspace/ui/composed/catalog-filters"
import { Feedback } from "@workspace/ui/composed/feedback"
import { FormCard } from "@workspace/ui/composed/form-card"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { api } from "@/convex/_generated/api"
import { formatMMK } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"
import { usePublicMenuCopy } from "@/lib/public-menu-copy"
import { useOnline } from "@/lib/use-online"
import { useGuestRecovery, type GuestCommand } from "@/lib/guest-recovery"
import { GuestCart, type GuestMenu } from "./guest-cart"
import type { CartLine } from "./pos-cart"
import { LanguageSwitcher, useCopy } from "./language-switcher"

export function PublicMenu({ storeId }: { storeId: string }) {
  const menu = useQuery(api.publicMenu.read, { storeId })
  const online = useOnline()
  const connection = useConvexConnectionState()
  const { copy } = useCopy()
  const text = usePublicMenuCopy()
  const connected = online && connection.isWebSocketConnected
  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <h1 className="min-w-0 font-heading text-2xl font-semibold [overflow-wrap:anywhere]">
          {menu?.store.name ?? copy.menu}
        </h1>
        <LanguageSwitcher />
      </header>
      {!connected && (
        <Feedback tone="error">
          {online ? copy.disconnected : copy.offline}
        </Feedback>
      )}
      {menu === undefined ? (
        <LoadingState label={text.loading} />
      ) : menu === null ? (
        <FormCard title={text.missing} description={text.missingIntro}>
          {null}
        </FormCard>
      ) : (
        <GuestCatalog key={menu.store._id} menu={menu} connected={connected} />
      )}
    </main>
  )
}

function GuestCatalog({
  menu,
  connected,
}: {
  menu: GuestMenu
  connected: boolean
}) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const recovery = useGuestRecovery(menu.store._id)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [lines, setLines] = useState<CartLine[]>([])
  const [note, setNote] = useState("")
  const [review, setReview] = useState<GuestCommand["lines"] | null>(null)
  const activeCategory = menu.categories.some((item) => item._id === category)
    ? category
    : "all"
  const visible = menu.items.filter(
    (item) =>
      (activeCategory === "all" || item.categoryId === activeCategory) &&
      `${item.name} ${item.description}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
  )
  // Derive sections in category order; filtering retains item creation order.
  const sections = menu.categories
    .map((category) => ({
      id: String(category._id),
      name: category.name,
      items: visible.filter((item) => item.categoryId === category._id),
    }))
    .filter((section) => section.items.length > 0)
  const signatures = visible.filter((item) => item.signature)
  if (activeCategory === "all" && signatures.length)
    sections.unshift({
      id: "signature",
      name: copy.signatureItems,
      items: signatures,
    })
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label={copy.menuPreview} className="min-w-0 space-y-5">
        <div>
          <h2 className="font-heading text-xl font-semibold">{copy.menu}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.finalPriceNote}
          </p>
        </div>
        <CatalogFilters
          searchLabel={pos.search}
          categoryLabel={pos.filterCategory}
          allLabel={pos.allItems}
          search={search}
          onSearchChange={setSearch}
          categories={menu.categories.map((category) => ({
            id: category._id,
            label: category.name,
          }))}
          selectedCategory={category}
          onCategoryChange={setCategory}
        />
        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`menu-section-${section.id}`}
              className="space-y-3"
            >
              <h3
                id={`menu-section-${section.id}`}
                className="font-heading text-lg font-semibold [overflow-wrap:anywhere]"
              >
                {section.name}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <CatalogCard
                    key={item._id}
                    headingLevel={4}
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
                          sizes="(max-width: 640px) 50vw, 300px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {pos.noPhoto}
                        </div>
                      )
                    }
                    status={
                      <div className="flex flex-wrap gap-1.5">
                        {item.signature && (
                          <Badge
                            variant="outline"
                            className="max-w-full border-primary/30 bg-primary/10 whitespace-normal"
                          >
                            {copy.signature}
                          </Badge>
                        )}
                        <Badge
                          variant={item.available ? "secondary" : "outline"}
                          className="max-w-full whitespace-normal"
                        >
                          {item.available
                            ? copy.availableItem
                            : copy.unavailableItem}
                        </Badge>
                      </div>
                    }
                    actions={
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={
                          !item.available ||
                          !connected ||
                          !!recovery.attempt ||
                          recovery.broken ||
                          !!review ||
                          (lines.length >= 100 &&
                            !lines.some((line) => line.itemId === item._id)) ||
                          lines.some(
                            (line) =>
                              line.itemId === item._id && line.quantity >= 99
                          )
                        }
                        aria-label={`${pos.addToCart}: ${item.name}`}
                        onClick={() =>
                          setLines((current) =>
                            current.some((line) => line.itemId === item._id)
                              ? current.map((line) =>
                                  line.itemId === item._id
                                    ? {
                                        ...line,
                                        quantity: Math.min(
                                          99,
                                          line.quantity + 1
                                        ),
                                      }
                                    : line
                                )
                              : [...current, { itemId: item._id, quantity: 1 }]
                          )
                        }
                      >
                        {pos.addToCart}
                      </Button>
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {!visible.length && (
          <Feedback>
            {menu.items.length ? pos.noResults : copy.noMenuItems}
          </Feedback>
        )}
      </section>
      <GuestCart
        menu={menu}
        recovery={recovery}
        lines={lines}
        setLines={setLines}
        note={note}
        setNote={setNote}
        review={review}
        setReview={setReview}
      />
    </div>
  )
}
