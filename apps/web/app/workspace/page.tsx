import { redirect } from "next/navigation"
import { isAuthenticated } from "@/lib/auth-server"
import { WorkspaceBoundary } from "@/components/workspace-boundary"

export default async function WorkspacePage() {
  if (!(await isAuthenticated())) redirect("/login")
  return <WorkspaceBoundary />
}
