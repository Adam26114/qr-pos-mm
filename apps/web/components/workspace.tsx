"use client"

import { usePosCopy } from "@/lib/pos-copy"
import { createContext, useContext, type ReactNode } from "react"
import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { usePathname } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { DashboardShell } from "@workspace/ui/composed/dashboard-shell"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { LanguageSwitcher, useCopy } from "./language-switcher"
import { WorkspaceNavigation, WorkspaceAccount } from "./workspace-navigation"
import { StoreOnboarding } from "./workspace-onboarding"
import { useOnline } from "@/lib/use-online"

type WorkspaceData = FunctionReturnType<typeof api.stores.workspace>
const WorkspaceContext = createContext<{
  workspace: WorkspaceData
  connected: boolean
} | null>(null)

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("Workspace pages require an active workspace.")
  return value
}

export function Workspace({
  onSignOut,
  signOutFailed,
  defaultSidebarOpen,
  children,
}: {
  onSignOut: () => Promise<void>
  signOutFailed: boolean
  defaultSidebarOpen: boolean
  children: ReactNode
}) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const pathname = usePathname()
  const online = useOnline()
  const connection = useConvexConnectionState()
  const connected = online && connection.isWebSocketConnected
  const { isAuthenticated } = useConvexAuth()
  const workspace = useQuery(
    api.stores.workspace,
    isAuthenticated ? {} : "skip"
  )
  if (!workspace)
    return (
      <div className="mx-auto max-w-2xl p-8">
        <LoadingState label={copy.loading} />
      </div>
    )
  const owner = workspace.accountKind === "owner"
  const title =
    pathname === "/workspace/orders"
      ? pos.orders
      : pathname === "/workspace/menu"
        ? copy.menu
        : pathname === "/workspace/staff"
          ? copy.staffTeam
          : pathname === "/workspace/subscription"
            ? copy.subscription
            : copy.overview
  const privatePage =
    pathname === "/workspace/staff" || pathname === "/workspace/subscription"
  return (
    <WorkspaceContext.Provider value={{ workspace, connected }}>
      <DashboardShell
        defaultOpen={defaultSidebarOpen}
        sidebar={
          <WorkspaceNavigation
            owner={owner}
            hasStore={!!workspace.store}
            storeName={workspace.store?.name}
          />
        }
        title={title}
        toggleLabel={copy.toggleSidebar}
        controls={
          <>
            {connected && (
              <Badge
                variant="outline"
                role="status"
                title={copy.online}
                className="gap-1.5"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-primary"
                />
                <span className="sr-only sm:not-sr-only">{copy.online}</span>
              </Badge>
            )}
            <LanguageSwitcher />
            <WorkspaceAccount
              user={workspace.user}
              owner={owner}
              online={online}
              onSignOut={onSignOut}
            />
          </>
        }
      >
        {!online ? (
          <Feedback>{copy.offline}</Feedback>
        ) : connection.hasEverConnected && !connection.isWebSocketConnected ? (
          <Feedback>{copy.disconnected}</Feedback>
        ) : null}
        {signOutFailed && (
          <Feedback tone="error">{copy.requestFailed}</Feedback>
        )}
        {!workspace.store ? (
          owner ? (
            <StoreOnboarding connected={connected} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h1>{copy.staffAccessRemoved}</h1>
                </CardTitle>
                <CardDescription>
                  {copy.staffAccessRemovedIntro}
                </CardDescription>
              </CardHeader>
            </Card>
          )
        ) : !owner && privatePage ? (
          <Feedback>{copy.ownerOnly}</Feedback>
        ) : (
          children
        )}
      </DashboardShell>
    </WorkspaceContext.Provider>
  )
}
