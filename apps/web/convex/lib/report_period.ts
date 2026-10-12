import { ConvexError } from "convex/values"

const offset = 6.5 * 60 * 60 * 1000
const dayMillis = 24 * 60 * 60 * 1000

export function yangonDay(at: number) {
  return new Date(at + offset).toISOString().slice(0, 10)
}

export function reportPeriod(kind: "day" | "month", key: string) {
  const dateKey = kind === "month" ? `${key}-01` : key
  const utc = Date.parse(`${dateKey}T00:00:00Z`)
  if (
    !(kind === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(key) ||
    !Number.isFinite(utc) ||
    utc < 0 ||
    new Date(utc).toISOString().slice(0, 10) !== dateKey ||
    key > yangonDay(Date.now()).slice(0, kind === "month" ? 7 : 10)
  )
    throw new ConvexError("INVALID_REPORT_PERIOD")
  const next =
    kind === "day"
      ? utc + dayMillis
      : Date.UTC(
          new Date(utc).getUTCFullYear(),
          new Date(utc).getUTCMonth() + 1,
          1
        )
  return {
    kind,
    key,
    start: utc - offset,
    end: next - offset,
    firstDay: dateKey,
    endDay: new Date(next).toISOString().slice(0, 10),
  }
}
