"use client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { usePaymentCopy } from "@/lib/payment-copy"
export function PaymentMethodField({
  value,
  onChange,
  disabled,
  id,
}: {
  value: "cash" | "mmqr"
  onChange: (value: "cash" | "mmqr") => void
  disabled?: boolean
  id: string
}) {
  const capabilities = useQuery(api.payments.capabilities, {})
  const text = usePaymentCopy()
  if (!capabilities?.simulator) return null
  return (
    <Field>
      <FieldLabel htmlFor={id}>{text.method}</FieldLabel>
      <Select
        value={value}
        onValueChange={(value) => onChange(value as "cash" | "mmqr")}
        disabled={disabled}
        items={[
          { value: "cash", label: text.cash },
          { value: "mmqr", label: text.mmqr },
        ]}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">{text.cash}</SelectItem>
          <SelectItem value="mmqr">{text.mmqr}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}
