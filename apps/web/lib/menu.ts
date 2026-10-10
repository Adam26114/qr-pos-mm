import { ConvexError } from "convex/values"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"
import type { MessageKey } from "./i18n"

export type Menu = FunctionReturnType<typeof api.menu.manage>
export type MenuCategory = Menu["categories"][number]
export type MenuItem = Menu["items"][number]

export function menuError(error: unknown): MessageKey {
  const messages: Record<string, MessageKey> = {
    INVALID_MENU_NAME: "invalidMenuName",
    INVALID_DESCRIPTION: "invalidDescription",
    INVALID_PRICE: "invalidPrice",
    INVALID_PHOTO: "invalidPhoto",
    PHOTO_TOO_LARGE: "photoTooLarge",
    CATEGORY_IN_USE: "categoryInUse",
    CATEGORY_REMOVED: "categoryRemoved",
    MENU_ITEM_REMOVED: "itemRemoved",
  }
  return error instanceof ConvexError && typeof error.data === "string"
    ? (messages[error.data] ?? "requestFailed")
    : "requestFailed"
}

export function formatMMK(amount: number) {
  return `${new Intl.NumberFormat("en-GB").format(amount)} MMK`
}
