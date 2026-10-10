"use client"

import { useState } from "react"
import { flushSync } from "react-dom"
import { authClient } from "./auth-client"

// Callers unmount their whole auth boundary when signingOut is true.
export function useSignOut(destination: string) {
  const [signingOut, setSigningOut] = useState(false)
  const [failure, setFailure] = useState(false)
  async function signOut() {
    flushSync(() => setSigningOut(true))
    setFailure(false)
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error("Sign out failed")
      window.location.replace(destination)
    } catch {
      setSigningOut(false)
      setFailure(true)
    }
  }
  return { signingOut, failure, signOut }
}
