"use client"

import Image from "next/image"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { useCopy } from "./language-switcher"
import { formatMMK, type Menu } from "@/lib/menu"

export function MenuPreview({ menu }: { menu: Menu }) {
  const { copy } = useCopy()
  const items = menu.items.filter((item) => item.removedAt === null)
  return (
    <section aria-label={copy.menuPreview} className="space-y-5">
      <h2 className="font-heading text-2xl font-semibold">
        {copy.menuPreview}
      </h2>
      {items.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{copy.noMenuItems}</p>
          </CardContent>
        </Card>
      ) : (
        menu.categories
          .filter((category) => category.removedAt === null)
          .map((category) => (
            <Card key={category._id}>
              <CardHeader>
                <CardTitle>
                  <h3 className="[overflow-wrap:anywhere]">{category.name}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-5">
                  {items
                    .filter((item) => item.categoryId === category._id)
                    .map((item) => (
                      <li
                        key={item._id}
                        className="flex gap-4 border-b border-border pb-5 last:border-0 last:pb-0"
                      >
                        {item.photoUrl && (
                          <Image
                            src={item.photoUrl}
                            alt={item.name}
                            width={96}
                            height={96}
                            unoptimized
                            className="size-24 shrink-0 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <h4 className="font-medium [overflow-wrap:anywhere]">
                            {item.name}
                          </h4>
                          {item.description && (
                            <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                          <p className="font-semibold tabular-nums">
                            {formatMMK(item.price)}
                          </p>
                          <Badge
                            variant={item.available ? "secondary" : "outline"}
                          >
                            {item.available
                              ? copy.availableItem
                              : copy.unavailableItem}
                          </Badge>
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))
      )}
    </section>
  )
}
