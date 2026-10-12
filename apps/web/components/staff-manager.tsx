"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Copy01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import {
  DataTable,
  type DataTableColumn,
} from "@workspace/ui/composed/data-table"
import { TextField } from "@workspace/ui/composed/text-field"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { ConfirmDialog } from "@workspace/ui/composed/confirm-dialog"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCopy } from "./language-switcher"
import type { MessageKey } from "@/lib/i18n"
import { staffError } from "@/lib/staff-error"

type Directory = FunctionReturnType<typeof api.staff.directory>
type Member = Directory["members"][number]
type Invitation = Directory["invitations"][number]
type CreatedLink = FunctionReturnType<typeof api.staff.createJoinLink>
type Command = "deactivate" | "reactivate" | "revoke" | "regenerate"
type Confirmation = { kind: Command; id: string; name: string }
const memberId = (member: Member) => member._id
const invitationId = (invitation: Invitation) => invitation._id
const memberSorting = [{ id: "joined", desc: true }]
const linkSorting = [{ id: "created", desc: true }]

export function StaffManager({
  storeId,
  connected,
}: {
  storeId: Id<"stores">
  connected: boolean
}) {
  const { copy, language } = useCopy()
  const directory = useQuery(api.staff.directory, { storeId })
  const create = useAction(api.staff.createJoinLink)
  const regenerate = useAction(api.staff.regenerateJoinLink)
  const remove = useMutation(api.staff.remove)
  const reactivate = useMutation(api.staff.reactivate)
  const revoke = useMutation(api.staff.revokeInvitation)
  const [tab, setTab] = useState("staff")
  const [dialog, setDialog] = useState<"create" | "result" | null>(null)
  const [days, setDays] = useState<1 | 3 | 7>(7)
  const [created, setCreated] = useState<CreatedLink | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const [copied, setCopied] = useState<"success" | "failure" | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const dialogTrigger = useRef<HTMLButtonElement | null>(null)
  const generated = useRef<CreatedLink | null>(null)
  const resultHandoff = useRef(false)
  const rowChanged = useRef(false)
  const [keyboard, setKeyboard] = useState(false)
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Asia/Yangon",
      }),
    [language]
  )
  const number = useMemo(
    () => new Intl.NumberFormat(language === "my" ? "my-MM" : "en-GB"),
    [language]
  )
  const restoreFocus = () => {
    const trigger = dialogTrigger.current
    return trigger?.isConnected &&
      trigger.getClientRects().length &&
      !trigger.matches(":disabled, [aria-disabled='true']")
      ? trigger
      : heading.current
  }
  const openConfirmation = useCallback(function openConfirmation(
    kind: Command,
    id: string,
    name: string,
    trigger: HTMLButtonElement | null,
    fromKeyboard: boolean
  ) {
    rowChanged.current = false
    setFailure(null)
    dialogTrigger.current = trigger
    setKeyboard(fromKeyboard)
    setConfirmation({ kind, id, name })
  }, [])
  async function createLink() {
    if (!connected || pending) return
    setPending(true)
    setFailure(null)
    try {
      setCreated(await create({ storeId, expiresInDays: days }))
      setCopied(null)
      setDialog("result")
      setTab("links")
    } catch (error) {
      setFailure(staffError(error))
    } finally {
      setPending(false)
    }
  }
  async function confirmCommand() {
    if (!connected || !confirmation) throw new Error("Disconnected")
    setFailure(null)
    try {
      if (confirmation.kind === "deactivate")
        await remove({
          storeId,
          membershipId: confirmation.id as Id<"memberships">,
        })
      else if (confirmation.kind === "reactivate")
        await reactivate({
          storeId,
          membershipId: confirmation.id as Id<"memberships">,
        })
      else if (confirmation.kind === "revoke")
        await revoke({
          storeId,
          invitationId: confirmation.id as Id<"staffInvitations">,
        })
      else {
        generated.current = await regenerate({
          storeId,
          invitationId: confirmation.id as Id<"staffInvitations">,
        })
        resultHandoff.current = true
      }
      if (confirmation.kind !== "regenerate") rowChanged.current = true
    } catch (error) {
      setFailure(staffError(error))
      throw error
    }
  }
  const memberColumns = useMemo<DataTableColumn<Member>[]>(
    () => [
      {
        id: "member",
        accessorFn: (member) =>
          `${member.name ?? ""} ${member.email ?? ""} ${member.phone ?? ""}`,
        header: copy.staffMember,
        cell: ({ row }) => {
          const member = row.original
          const name = member.name ?? member.email ?? member._id.slice(-6)
          return (
            <div className="flex max-w-80 min-w-48 items-center gap-3">
              <Avatar className="size-9" aria-hidden="true">
                <AvatarFallback>
                  {Array.from(name).slice(0, 2).join("").toLocaleUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 whitespace-normal">
                <p className="font-medium [overflow-wrap:anywhere] break-words">
                  {name}
                </p>
                <p className="mt-0.5 text-xs break-all text-muted-foreground">
                  {member.email ?? "—"}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: copy.phone,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.phone ?? "—"}
          </span>
        ),
      },
      {
        id: "joined",
        accessorKey: "joinedAt",
        header: copy.joinedOn,
        sortFn: "basic",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {date.format(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: copy.status,
        filterFn: "equalsString",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "secondary" : "outline"}
            className="max-w-48 whitespace-normal"
          >
            <span
              className={
                row.original.status === "active"
                  ? "size-1.5 shrink-0 rounded-full bg-primary"
                  : "size-1.5 shrink-0 rounded-full bg-muted-foreground"
              }
              aria-hidden="true"
            />
            {row.original.status === "active"
              ? copy.activeMember
              : copy.deactivatedMember}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{copy.actions}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <StaffRowMenu
            label={`${copy.staffActions}: ${row.original.name ?? row.original.email ?? row.original._id.slice(-6)}`}
            disabled={!connected}
            items={[
              {
                label:
                  row.original.status === "active"
                    ? copy.deactivateStaff
                    : copy.reactivateStaff,
                destructive: row.original.status === "active",
                onSelect: (trigger, fromKeyboard) =>
                  openConfirmation(
                    row.original.status === "active"
                      ? "deactivate"
                      : "reactivate",
                    row.original._id,
                    row.original.name ??
                      row.original.email ??
                      row.original._id.slice(-6),
                    trigger,
                    fromKeyboard
                  ),
              },
            ]}
          />
        ),
      },
    ],
    [copy, connected, date, openConfirmation]
  )
  const linkColumns = useMemo<DataTableColumn<Invitation>[]>(
    () => [
      {
        id: "link",
        accessorFn: (link) => `${link._id.slice(-6)} ${link.email ?? ""}`,
        header: copy.linkLabel,
        cell: ({ row }) => (
          <div className="max-w-80 min-w-44 whitespace-normal">
            <p className="font-medium break-all">
              {row.original.kind === "email"
                ? row.original.email
                : `${copy.linkLabel} ${row.original._id.slice(-6)}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.original.kind === "email"
                ? copy.legacyInvitation
                : copy.singleUseLink}
            </p>
          </div>
        ),
      },
      {
        id: "created",
        accessorKey: "createdAt",
        header: copy.createdOn,
        sortFn: "basic",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {date.format(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "expires",
        accessorKey: "expiresAt",
        header: copy.expiresOn,
        sortFn: "basic",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {date.format(row.original.expiresAt)}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: copy.status,
        filterFn: "equalsString",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "pending" ? "secondary" : "outline"
            }
            className="max-w-48 whitespace-normal"
          >
            {
              {
                pending: copy.invitePending,
                accepted: copy.inviteAccepted,
                expired: copy.inviteExpired,
                revoked: copy.inviteRevoked,
              }[row.original.status]
            }
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{copy.actions}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const invitation = row.original
          const name =
            invitation.kind === "email"
              ? (invitation.email ?? copy.legacyInvitation)
              : `${copy.linkLabel} ${invitation._id.slice(-6)}`
          const items = []
          if (
            invitation.kind === "link" &&
            invitation.status !== "accepted" &&
            !invitation.replacedBy
          )
            items.push({
              label: copy.regenerateLink,
              onSelect: (
                trigger: HTMLButtonElement | null,
                fromKeyboard: boolean
              ) =>
                openConfirmation(
                  "regenerate",
                  invitation._id,
                  name,
                  trigger,
                  fromKeyboard
                ),
            })
          if (invitation.status === "pending")
            items.push({
              label: copy.revokeLink,
              destructive: true,
              onSelect: (
                trigger: HTMLButtonElement | null,
                fromKeyboard: boolean
              ) =>
                openConfirmation(
                  "revoke",
                  invitation._id,
                  name,
                  trigger,
                  fromKeyboard
                ),
            })
          return items.length ? (
            <StaffRowMenu
              label={`${copy.linkActions}: ${invitation._id.slice(-6)}`}
              disabled={!connected}
              items={items}
            />
          ) : (
            <span className="text-muted-foreground" aria-hidden="true">
              —
            </span>
          )
        },
      },
    ],
    [copy, connected, date, openConfirmation]
  )
  const confirmationCopy = confirmation
    ? {
        deactivate: {
          label: copy.deactivateStaff,
          title: copy.deactivateStaffTitle,
          intro: copy.deactivateStaffIntro,
        },
        reactivate: {
          label: copy.reactivateStaff,
          title: copy.reactivateStaffTitle,
          intro: copy.reactivateStaffIntro,
        },
        revoke: {
          label: copy.revokeLink,
          title: copy.revokeLinkTitle,
          intro: copy.revokeLinkIntro,
        },
        regenerate: {
          label: copy.regenerateLink,
          title: copy.regenerateLinkTitle,
          intro: copy.regenerateLinkIntro,
        },
      }[confirmation.kind]
    : null
  const paginationCopy = {
    rowsPerPage: copy.rowsPerPage,
    previousPage: copy.previousPage,
    nextPage: copy.nextPage,
    page: copy.page,
    of: copy.of,
  }
  const linkUrl =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${created.token}`
      : ""
  const instant = keyboard
    ? "animate-none data-open:animate-none data-closed:animate-none"
    : "motion-reduce:animate-none"
  function closeLinkDialog() {
    resultHandoff.current = false
    setDialog(null)
    setCreated(null)
    setCopied(null)
    setFailure(null)
  }
  return (
    <section className="min-w-0 space-y-5" aria-label={copy.staffTeam}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-heading text-2xl font-semibold tracking-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {copy.staffTeam}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {copy.staffTeamIntro}
          </p>
        </div>
        <Button
          ref={createButton}
          className="h-auto min-h-9 max-w-full py-2 whitespace-normal"
          disabled={!connected}
          onPointerDown={() => setKeyboard(false)}
          onKeyDown={() => setKeyboard(true)}
          onClick={() => {
            dialogTrigger.current = createButton.current
            setFailure(null)
            setDays(7)
            setDialog("create")
          }}
        >
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          {copy.createJoinLink}
        </Button>
      </div>
      {!directory ? (
        <LoadingState label={copy.loading} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (typeof value === "string") setTab(value)
          }}
          className="min-w-0 gap-4"
        >
          <div className="overflow-x-auto border-b">
            <TabsList
              variant="line"
              aria-label={copy.staffTeam}
              className="h-10 gap-5 p-0"
            >
              <TabsTrigger
                value="staff"
                className="flex-none px-1 transition-none after:transition-none group-data-horizontal/tabs:after:bottom-0"
              >
                {copy.staffTeam}
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {number.format(directory.members.length)}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="links"
                className="flex-none px-1 transition-none after:transition-none group-data-horizontal/tabs:after:bottom-0"
              >
                {copy.joinLinks}
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {number.format(directory.invitations.length)}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="staff" keepMounted className="min-w-0">
            <DataTable
              data={directory.members}
              columns={memberColumns}
              getRowId={memberId}
              label={copy.staffTeam}
              search={{ columnId: "member", label: copy.searchStaff }}
              filter={{
                columnId: "status",
                label: copy.status,
                allLabel: copy.allStatuses,
                options: [
                  { value: "active", label: copy.activeMember },
                  { value: "removed", label: copy.deactivatedMember },
                ],
              }}
              empty={
                directory.members.length ? copy.noMatchingStaff : copy.noStaff
              }
              initialSorting={memberSorting}
              paginationCopy={paginationCopy}
              formatNumber={(value) => number.format(value)}
            />
          </TabsContent>
          <TabsContent value="links" keepMounted className="min-w-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              {copy.joinLinksIntro}
            </p>
            <DataTable
              data={directory.invitations}
              columns={linkColumns}
              getRowId={invitationId}
              label={copy.joinLinks}
              search={{ columnId: "link", label: copy.searchLinks }}
              filter={{
                columnId: "status",
                label: copy.status,
                allLabel: copy.allStatuses,
                options: [
                  { value: "pending", label: copy.invitePending },
                  { value: "accepted", label: copy.inviteAccepted },
                  { value: "expired", label: copy.inviteExpired },
                  { value: "revoked", label: copy.inviteRevoked },
                ],
              }}
              empty={
                directory.invitations.length
                  ? copy.noMatchingLinks
                  : copy.noJoinLinks
              }
              initialSorting={linkSorting}
              paginationCopy={paginationCopy}
              formatNumber={(value) => number.format(value)}
            />
          </TabsContent>
        </Tabs>
      )}
      <EditorDialog
        open={dialog !== null}
        onClose={closeLinkDialog}
        title={dialog === "result" ? copy.linkReady : copy.createJoinLink}
        description={
          dialog === "result" ? copy.copyBeforeClosing : copy.joinLinkIntro
        }
        closeLabel={copy.cancel}
        pending={pending}
        finalFocus={restoreFocus}
        formLayout
        className={`sm:max-w-lg ${instant}`}
        overlayClassName={instant}
      >
        {dialog === "result" && created ? (
          <>
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <TextField
                id="staff-join-link"
                label={copy.linkLabel}
                value={linkUrl}
                readOnly
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
              <p className="text-sm text-muted-foreground">
                {copy.expiresOn}:{" "}
                <span className="tabular-nums">
                  {date.format(created.expiresAt)}
                </span>
              </p>
              {copied && (
                <Feedback tone={copied === "failure" ? "error" : "status"}>
                  {copied === "success" ? copy.linkCopied : copy.copyLinkFailed}
                </Feedback>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={closeLinkDialog}>
                {copy.done}
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkUrl)
                    setCopied("success")
                  } catch {
                    setCopied("failure")
                  }
                }}
              >
                <HugeiconsIcon icon={Copy01Icon} aria-hidden="true" />
                {copy.copyLink}
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createLink()
            }}
            className="flex min-h-0 flex-col"
          >
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="staff-link-expiry">{copy.linkExpiry}</Label>
                <Select
                  items={[
                    { value: "1", label: copy.oneDay },
                    { value: "3", label: copy.threeDays },
                    { value: "7", label: copy.sevenDays },
                  ]}
                  value={String(days)}
                  onValueChange={(value) => {
                    if (value === "1" || value === "3" || value === "7")
                      setDays(Number(value) as 1 | 3 | 7)
                  }}
                  disabled={!connected || pending}
                >
                  <SelectTrigger id="staff-link-expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="motion-reduce:animate-none">
                    <SelectItem value="1">{copy.oneDay}</SelectItem>
                    <SelectItem value="3">{copy.threeDays}</SelectItem>
                    <SelectItem value="7">{copy.sevenDays}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {failure && <Feedback tone="error">{copy[failure]}</Feedback>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={closeLinkDialog}
              >
                {copy.cancel}
              </Button>
              <SubmitButton
                className="h-auto min-h-9 max-w-full py-2 whitespace-normal"
                pending={pending}
                pendingLabel={copy.working}
                disabled={!connected}
              >
                {copy.createJoinLink}
              </SubmitButton>
            </div>
          </form>
        )}
      </EditorDialog>
      {confirmation && confirmationCopy && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirmation(null)
              setFailure(null)
              if (generated.current) {
                setCreated(generated.current)
                generated.current = null
                setCopied(null)
                setDialog("result")
              }
            }
          }}
          label={confirmationCopy.label}
          title={confirmationCopy.title}
          description={`${confirmation.name} — ${confirmationCopy.intro}`}
          cancelLabel={copy.cancel}
          pendingLabel={copy.working}
          failureMessage={copy[failure ?? "requestFailed"]}
          disabled={!connected}
          confirmVariant={
            confirmation.kind === "reactivate" ||
            confirmation.kind === "regenerate"
              ? "default"
              : "destructive"
          }
          onConfirm={confirmCommand}
          finalFocus={() =>
            resultHandoff.current
              ? false
              : rowChanged.current
                ? heading.current
                : restoreFocus()
          }
          className={instant}
          overlayClassName={instant}
        />
      )}
    </section>
  )
}

function StaffRowMenu({
  label,
  disabled,
  items,
}: {
  label: string
  disabled: boolean
  items: {
    label: string
    destructive?: boolean
    onSelect: (trigger: HTMLButtonElement | null, keyboard: boolean) => void
  }[]
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [keyboard, setKeyboard] = useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={trigger}
            variant="ghost"
            size="icon-sm"
            className="transition-none"
          />
        }
        aria-label={label}
        title={label}
        disabled={disabled}
        onPointerDown={() => setKeyboard(false)}
        onKeyDown={() => setKeyboard(true)}
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`w-52 motion-reduce:animate-none ${keyboard ? "animate-none data-open:animate-none data-closed:animate-none" : ""}`}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            variant={item.destructive ? "destructive" : "default"}
            disabled={disabled}
            onClick={() => item.onSelect(trigger.current, keyboard)}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
