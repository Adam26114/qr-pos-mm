"use client"

import type { ReactNode } from "react"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export function DashboardShell({
  sidebar,
  title,
  controls,
  toggleLabel,
  defaultOpen = true,
  children,
}: {
  sidebar: ReactNode
  title: string
  controls: ReactNode
  toggleLabel: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        {sidebar}
        <SidebarInset className="min-w-0">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
            <DashboardTrigger label={toggleLabel} />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">
              {title}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {controls}
            </div>
          </header>
          <div className="flex-1 space-y-6 p-4 lg:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function DashboardTrigger({ label }: { label: string }) {
  const { isMobile, open, openMobile } = useSidebar()
  return (
    <SidebarTrigger
      aria-label={label}
      aria-expanded={isMobile ? openMobile : open}
    />
  )
}
