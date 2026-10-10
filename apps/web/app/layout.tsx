import { Geist_Mono, Space_Grotesk, Montserrat } from "next/font/google"
import type { Metadata } from "next"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { cookies } from "next/headers"
import { AppProviders } from "@/components/app-providers"
import { parseLanguage } from "@/lib/i18n"
import { getToken } from "@/lib/auth-server"

const montserratHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "QR POS",
  description: "QR menu and counter POS for cafes and restaurants in Myanmar.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const language = parseLanguage(
    (await cookies()).get("qr-pos-language")?.value
  )
  const initialToken = await getToken()
  return (
    <html
      lang={language}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        spaceGrotesk.variable,
        montserratHeading.variable
      )}
    >
      <body>
        <ThemeProvider>
          <AppProviders language={language} initialToken={initialToken}>
            {children}
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  )
}
