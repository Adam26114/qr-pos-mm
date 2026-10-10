"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  MenuRestaurantIcon,
  UserGroupIcon,
  CreditCardIcon,
  QrCodeIcon,
} from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@workspace/ui/components/dropdown-menu"
import { useTheme } from "next-themes"
import { useCopy } from "./language-switcher"

export function WorkspaceNavigation({
  owner,
  hasStore,
  storeName,
}: {
  owner: boolean
  hasStore: boolean
  storeName?: string
}) {
  const { copy } = useCopy()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const items = [
    { href: "/workspace", label: copy.overview, icon: DashboardSquare01Icon },
    ...(hasStore
      ? [
          {
            href: "/workspace/menu",
            label: copy.menu,
            icon: MenuRestaurantIcon,
          },
          ...(owner
            ? [
                {
                  href: "/workspace/staff",
                  label: copy.staffTeam,
                  icon: UserGroupIcon,
                },
                {
                  href: "/workspace/subscription",
                  label: copy.subscription,
                  icon: CreditCardIcon,
                },
              ]
            : []),
        ]
      : []),
  ]
  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      mobileTitle={copy.workspace}
      mobileDescription={copy.navigationIntro}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/workspace" />}
              onClick={() => setOpenMobile(false)}
              aria-label="QR POS"
            >
              <HugeiconsIcon
                icon={QrCodeIcon}
                className="size-5 text-primary"
              />
              <span className="font-heading text-xl font-semibold group-data-[collapsible=icon]:hidden">
                QR<span className="text-primary">POS</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label={copy.workspace}>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      tooltip={item.label}
                      aria-label={item.label}
                      onClick={() => setOpenMobile(false)}
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="px-2 text-sm font-medium [overflow-wrap:anywhere]">
          {storeName ?? copy.workspace}
        </p>
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          {owner ? copy.ownerAccount : copy.staffAccount}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}

export function WorkspaceAccount({
  user,
  owner,
  online,
  onSignOut,
}: {
  user: { name: string; email: string }
  owner: boolean
  online: boolean
  onSignOut: () => Promise<void>
}) {
  const { copy } = useCopy()
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={copy.account} />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback>
            {user.name.trim().slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="font-medium [overflow-wrap:anywhere] text-foreground">
              {user.name}
            </p>
            <p className="mt-1 font-normal break-all">{user.email}</p>
            <p className="mt-1 font-normal">
              {owner ? copy.ownerAccount : copy.staffAccount}
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{copy.appearance}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={setTheme}
          >
            <DropdownMenuRadioItem value="light">
              {copy.lightTheme}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              {copy.darkTheme}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              {copy.systemTheme}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!online} onClick={onSignOut}>
          {copy.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
