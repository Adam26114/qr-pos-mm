import { ConvexError } from "convex/values"
import type { MessageKey } from "./i18n"

export function staffError(error: unknown): MessageKey {
  const messages: Record<string, MessageKey> = {
    INVALID_EMAIL: "invalidEmail",
    INVALID_INVITATION: "invalidInvitation",
    INVITATION_EMAIL_MISMATCH: "invitationMismatch",
    MEMBERSHIP_CONFLICT: "membershipConflict",
    MEMBER_EXISTS: "memberExists",
    INVALID_PHONE: "invalidPhone",
    STAFF_DEACTIVATED: "staffDeactivated",
  }
  return error instanceof ConvexError && typeof error.data === "string"
    ? (messages[error.data] ?? "requestFailed")
    : "requestFailed"
}
