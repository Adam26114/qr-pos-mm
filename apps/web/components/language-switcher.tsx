"use client"

import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Button } from "@workspace/ui/components/button"
import { messages, type Language } from "@/lib/i18n"
import { setLanguage, type UiState } from "@/lib/ui-store"

export function useCopy() {
  const language = useSelector((state: UiState) => state.ui.language)
  return { language, copy: messages[language] }
}

export function LanguageSwitcher() {
  const { language, copy } = useCopy()
  const dispatch = useDispatch()
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  function choose(value: Language) {
    dispatch(setLanguage(value))
    document.cookie = `qr-pos-language=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
  }
  return (
    <div
      aria-label={copy.language}
      className="flex items-center gap-1 rounded-lg border border-border p-1"
    >
      <Button
        size="sm"
        variant={language === "en" ? "secondary" : "ghost"}
        aria-pressed={language === "en"}
        onClick={() => choose("en")}
      >
        English
      </Button>
      <Button
        size="sm"
        variant={language === "my" ? "secondary" : "ghost"}
        aria-pressed={language === "my"}
        onClick={() => choose("my")}
      >
        မြန်မာ
      </Button>
    </div>
  )
}
