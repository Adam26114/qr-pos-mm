"use client"

import { useState, type ReactNode } from "react"
import { Provider } from "react-redux"
import { ConvexReactClient } from "convex/react"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { authClient } from "@/lib/auth-client"
import { makeUiStore } from "@/lib/ui-store"
import type { Language } from "@/lib/i18n"

export function AppProviders({
  children,
  language,
  initialToken,
}: {
  children: ReactNode
  language: Language
  initialToken?: string | null
}) {
  const [store] = useState(() => makeUiStore(language))
  const [client] = useState(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  )
  return (
    <Provider store={store}>
      <ConvexBetterAuthProvider
        client={client}
        authClient={authClient}
        initialToken={initialToken}
      >
        {children}
      </ConvexBetterAuthProvider>
    </Provider>
  )
}
