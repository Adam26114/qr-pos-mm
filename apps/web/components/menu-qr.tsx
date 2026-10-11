"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import type { Id } from "@/convex/_generated/dataModel"
import { usePublicMenuCopy } from "@/lib/public-menu-copy"
import { useCopy } from "./language-switcher"

export function MenuQr({
  storeId,
  connected,
}: {
  storeId: Id<"stores">
  connected: boolean
}) {
  const { copy } = useCopy()
  const text = usePublicMenuCopy()
  const [qr, setQr] = useState<{
    menuUrl: string
    imageUrl: string
    local: boolean
  } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let imageUrl: string | undefined
    const menuUrl = new URL(`/menu/${storeId}`, location.origin).href
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toString(menuUrl, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 4,
          width: 720,
        })
      )
      .then((svg) => {
        if (!active) return
        imageUrl = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" })
        )
        setQr({
          menuUrl,
          imageUrl,
          local: ["localhost", "127.0.0.1", "[::1]"].includes(
            location.hostname
          ),
        })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [storeId])
  if (failed) return <Feedback tone="error">{copy.requestFailed}</Feedback>
  if (!qr) return <LoadingState label={text.loading} />
  return (
    <div className="space-y-4">
      <Image
        src={qr.imageUrl}
        alt={text.qrImage}
        width={720}
        height={720}
        unoptimized
        className="mx-auto size-64 max-w-full"
      />
      <p className="text-center text-sm [overflow-wrap:anywhere] text-muted-foreground">
        {qr.menuUrl}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          render={<a href={qr.imageUrl} download="menu-qr.svg" />}
          nativeButton={false}
          role="link"
          disabled={!connected}
        >
          {text.download}
        </Button>
        <Button
          variant="outline"
          render={
            <a href={qr.menuUrl} target="_blank" rel="noopener noreferrer" />
          }
          nativeButton={false}
          role="link"
          disabled={!connected}
        >
          {text.openMenu}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{text.printNote}</p>
      {qr.local && <Feedback>{text.localNote}</Feedback>}
    </div>
  )
}
