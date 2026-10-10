"use client"

import { useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FieldSet } from "@workspace/ui/components/field"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { FormCard } from "@workspace/ui/composed/form-card"
import { TextField } from "@workspace/ui/composed/text-field"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { ConfirmAction } from "@workspace/ui/composed/confirm-action"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCopy } from "./language-switcher"
import { formError, type MessageKey } from "@/lib/i18n"
import { staffError } from "@/lib/staff-error"

export function StaffManager({
  storeId,
  connected,
}: {
  storeId: Id<"stores">
  connected: boolean
}) {
  const { copy, language } = useCopy()
  const directory = useQuery(api.staff.directory, { storeId })
  const invite = useAction(api.staff.invite)
  const remove = useMutation(api.staff.remove)
  const revoke = useMutation(api.staff.revokeInvitation)
  const [failure, setFailure] = useState<MessageKey | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isReady },
  } = useForm<{ email: string }>({
    resolver: zodResolver(
      z.object({
        email: z.string().trim().email("invalidEmail").max(254, "invalidEmail"),
      })
    ),
    defaultValues: { email: "" },
  })
  async function submit({ email }: { email: string }) {
    if (!connected) return
    setFailure(null)
    setSaved(false)
    try {
      await invite({ storeId, email })
      reset()
      setSaved(true)
    } catch (error) {
      setFailure(staffError(error))
    }
  }
  const confirmation = {
    cancelLabel: copy.keepAccess,
    pendingLabel: copy.working,
    failureMessage: copy.requestFailed,
    disabled: !connected,
  }
  const statuses = {
    pending: copy.invitePending,
    accepted: copy.inviteAccepted,
    expired: copy.inviteExpired,
    revoked: copy.inviteRevoked,
  }
  const date = (value: number) =>
    new Intl.DateTimeFormat(language === "my" ? "my-MM" : "en-GB", {
      dateStyle: "medium",
      timeZone: "Asia/Yangon",
    }).format(value)
  return (
    <section className="space-y-6" aria-label={copy.staffTeam}>
      <FormCard title={copy.staffTeam} description={copy.staffTeamIntro}>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <FieldSet disabled={!isReady || isSubmitting || !connected}>
            <TextField
              id="staff-email"
              label={copy.staffEmail}
              type="email"
              autoComplete="off"
              {...register("email")}
              error={
                errors.email ? formError(errors.email.message, copy) : undefined
              }
            />
            <SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
              {copy.inviteStaff}
            </SubmitButton>
          </FieldSet>
          {failure && (
            <Feedback tone="error" className="mt-4">
              {copy[failure]}
            </Feedback>
          )}
          {saved && (
            <Feedback className="mt-4">{copy.invitationQueued}</Feedback>
          )}
        </form>
      </FormCard>
      {!directory ? (
        <LoadingState label={copy.loading} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{copy.staffTeam}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {directory.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.noStaff}</p>
              ) : (
                <ul className="space-y-5">
                  {directory.members.map((member) => (
                    <li
                      key={member._id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 last:border-0"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium break-all">{member.name}</p>
                        <p className="text-sm break-all text-muted-foreground">
                          {member.email}
                        </p>
                        <Badge
                          variant={
                            member.status === "active" ? "secondary" : "outline"
                          }
                        >
                          {member.status === "active"
                            ? copy.activeMember
                            : copy.removedMember}
                        </Badge>
                      </div>
                      {member.status === "active" && (
                        <ConfirmAction
                          {...confirmation}
                          label={copy.removeAccess}
                          title={copy.removeAccessTitle}
                          description={`${member.email} — ${copy.removeAccessIntro}`}
                          onConfirm={() => {
                            if (!connected)
                              return Promise.reject(new Error("Disconnected"))
                            return remove({ storeId, membershipId: member._id })
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{copy.invitations}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {directory.invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {copy.noInvitations}
                </p>
              ) : (
                <ul className="space-y-5">
                  {directory.invitations.map((invitation) => (
                    <li
                      key={invitation._id}
                      className="space-y-2 border-b border-border pb-4 last:border-0"
                    >
                      <p className="text-sm break-all">{invitation.email}</p>
                      <Badge variant="outline">
                        {statuses[invitation.status]}
                      </Badge>
                      {invitation.status === "pending" && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {copy.invitationExpires}:{" "}
                            {date(invitation.expiresAt)}
                          </p>
                          <p
                            className="text-sm"
                            role={
                              invitation.delivery === "failed"
                                ? "alert"
                                : undefined
                            }
                          >
                            {invitation.delivery === "sent"
                              ? copy.deliverySent
                              : invitation.delivery === "failed"
                                ? copy.deliveryFailed
                                : copy.deliveryQueued}
                          </p>
                          <ConfirmAction
                            {...confirmation}
                            label={copy.cancelInvitation}
                            title={copy.cancelInvitationTitle}
                            description={`${invitation.email} — ${copy.cancelInvitationIntro}`}
                            onConfirm={() => {
                              if (!connected)
                                return Promise.reject(new Error("Disconnected"))
                              return revoke({
                                storeId,
                                invitationId: invitation._id,
                              })
                            }}
                          />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}
