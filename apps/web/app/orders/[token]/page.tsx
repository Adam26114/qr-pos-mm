import type { Metadata } from "next"
import { GuestTracking } from "@/components/guest-tracking"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <GuestTracking key={token} token={token} />
}
