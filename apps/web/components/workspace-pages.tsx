"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { MetricCard } from "@workspace/ui/composed/metric-card"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { useWorkspace } from "./workspace"
import { useCopy } from "./language-switcher"
import { MenuManager } from "./menu-manager"
import { StaffManager } from "./staff-manager"
import { WorkspaceSubscription } from "./workspace-subscription"
import { WorkspaceReports } from "./workspace-reports"

export function WorkspaceOverview() {
  const { workspace } = useWorkspace()
  const { copy, language } = useCopy()
  const storeId = workspace.store?._id
  const owner = workspace.accountKind === "owner"
  const menu = useQuery(api.menu.view, storeId ? { storeId } : "skip")
  const directory = useQuery(
    api.staff.directory,
    owner && storeId ? { storeId } : "skip"
  )
  const number = (value: number) =>
    new Intl.NumberFormat(language === "my" ? "my-MM" : "en-GB").format(value)
  const loading = !menu || (owner && !directory)
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-primary">
            {owner ? copy.ownerWorkspace : copy.staffWorkspace}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            {workspace.store?.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.overviewIntro}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/workspace/menu" />} nativeButton={false}>
            {owner ? copy.manageMenu : copy.viewMenu}
          </Button>
          {owner && (
            <Button
              variant="outline"
              render={<Link href="/workspace/staff" />}
              nativeButton={false}
            >
              {copy.manageStaff}
            </Button>
          )}
        </div>
      </div>
      {owner && storeId && <WorkspaceReports storeId={storeId} />}
      {loading ? (
        <LoadingState label={copy.loading} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={copy.menuItems}
            value={number(menu.items.length)}
            description={copy.activeMenuNote}
          />
          <MetricCard
            label={copy.availableItem}
            value={number(menu.items.filter((item) => item.available).length)}
            description={copy.availableMenuNote}
          />
          <MetricCard
            label={copy.categories}
            value={number(menu.categories.length)}
            description={copy.categoriesNote}
          />
          {owner && directory && (
            <MetricCard
              label={copy.staffTeam}
              value={number(
                directory.members.filter((member) => member.status === "active")
                  .length
              )}
              description={copy.activeStaffNote}
            />
          )}
        </div>
      )}
      {owner ? (
        <WorkspaceSubscription overview />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{copy.staffReady}</h2>
            </CardTitle>
            <CardDescription>{copy.staffReadyIntro}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  )
}

export function WorkspaceMenu() {
  const { workspace, connected } = useWorkspace()
  if (!workspace.store) return null
  return (
    <MenuManager
      storeId={workspace.store._id}
      connected={connected}
      owner={workspace.accountKind === "owner"}
    />
  )
}

export function WorkspaceStaff() {
  const { workspace, connected } = useWorkspace()
  if (workspace.accountKind !== "owner" || !workspace.store) return null
  return <StaffManager storeId={workspace.store._id} connected={connected} />
}
