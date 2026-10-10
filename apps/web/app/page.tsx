import { redirect } from "next/navigation"
import { isAuthenticated } from "@/lib/auth-server"

export default async function Page() {
  redirect((await isAuthenticated()) ? "/workspace" : "/login")
}
