"use client"

import { useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

export function useReportPeriod(storeId: Id<"stores">, connected: boolean) {
  // A unique query argument obtains fresh server dates instead of reusing an old cached clock.
  const [refresh, setRefresh] = useState(() => crypto.randomUUID())
  const [selection, setSelection] = useState<{
    kind: "day" | "month"
    key: string | null
    invalid: boolean
  }>({ kind: "day", key: null, invalid: false })
  const dates = useQuery(api.reports.dates, { storeId, refresh })
  useEffect(() => {
    if (!connected || !dates) return
    const timer = setTimeout(
      () => setRefresh(crypto.randomUUID()),
      Math.max(0, dates.nextMidnight - dates.now) + 100
    )
    return () => clearTimeout(timer)
  }, [dates, connected])
  useEffect(() => {
    if (!connected) return
    const refreshDates = () => {
      if (document.visibilityState === "visible")
        setRefresh(crypto.randomUUID())
    }
    refreshDates()
    document.addEventListener("visibilitychange", refreshDates)
    window.addEventListener("focus", refreshDates)
    return () => {
      document.removeEventListener("visibilitychange", refreshDates)
      window.removeEventListener("focus", refreshDates)
    }
  }, [connected])
  const key =
    selection.key ?? (selection.kind === "day" ? dates?.day : dates?.month)
  return { dates, selection, setSelection, key }
}
