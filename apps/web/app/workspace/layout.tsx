import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isAuthenticated } from "@/lib/auth-server"
import { WorkspaceBoundary } from "@/components/workspace-boundary"

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode
}) {
  if (!(await isAuthenticated())) redirect("/login")
  const cookieStore = await cookies()
  return (
    <WorkspaceBoundary
      defaultSidebarOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </WorkspaceBoundary>
  )
}
