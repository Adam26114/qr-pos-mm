"use client"
import { useMutation, useQuery } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FieldSet } from "@workspace/ui/components/field"
import { TextField } from "@workspace/ui/composed/text-field"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { ConfirmAction } from "@workspace/ui/composed/confirm-action"
import { Feedback } from "@workspace/ui/composed/feedback"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"

export function TableManager({
  storeId,
  onPendingChange,
}: {
  storeId: Id<"stores">
  onPendingChange: (pending: boolean) => void
}) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const action = usePosCommand()
  const data = useQuery(api.tables.list, { storeId })
  const add = useMutation(api.tables.add)
  const remove = useMutation(api.tables.remove)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ number: string }>({
    defaultValues: { number: "" },
    resolver: zodResolver(
      z.object({
        number: z
          .string()
          .refine(
            (value) =>
              /^\d+$/.test(value) &&
              Number(value) >= 1 &&
              Number(value) <= 9999,
            "invalidTable"
          ),
      })
    ),
  })
  return (
    <div className="space-y-5">
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          onPendingChange(true)
          try {
            if (
              await action.run(() =>
                add({ storeId, number: Number(values.number) })
              )
            )
              reset()
          } finally {
            onPendingChange(false)
          }
        })}
      >
        <FieldSet disabled={!action.connected || isSubmitting}>
          <TextField
            id="table-number"
            label={pos.tableNumber}
            inputMode="numeric"
            {...register("number")}
            error={errors.number ? pos.invalidTable : undefined}
          />
          <SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
            {pos.addTable}
          </SubmitButton>
        </FieldSet>
      </form>
      {action.failure && <Feedback tone="error">{action.failure}</Feedback>}
      <ul className="space-y-3">
        {data?.tables.map((table) => (
          <li
            key={table._id}
            className="flex items-center justify-between gap-4 border-b pb-3"
          >
            <span>
              {pos.table} {table.number}
            </span>
            <ConfirmAction
              label={pos.removeTable}
              title={pos.removeTableTitle}
              description={pos.removeTableIntro}
              cancelLabel={copy.keepAccess}
              pendingLabel={copy.working}
              failureMessage={copy.requestFailed}
              disabled={!action.connected}
              onConfirm={async () => {
                if (!action.ready()) throw new Error("Disconnected")
                onPendingChange(true)
                try {
                  await remove({ storeId, tableId: table._id })
                } finally {
                  onPendingChange(false)
                }
              }}
            />
          </li>
        ))}
      </ul>
      {data?.tables.length === 0 && (
        <p className="text-sm text-muted-foreground">{pos.noTables}</p>
      )}
    </div>
  )
}
