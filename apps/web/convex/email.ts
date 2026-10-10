import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"

const loopback = (url: URL) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)

async function deliverEmail(recipient: string, subject: string, text: string) {
  const capture = process.env.DEV_EMAIL_CAPTURE_URL
  const local =
    process.env.SITE_URL &&
    process.env.CONVEX_SITE_URL &&
    loopback(new URL(process.env.SITE_URL)) &&
    loopback(new URL(process.env.CONVEX_SITE_URL))
  if (capture && (!local || !loopback(new URL(capture))))
    throw new Error("Email capture is only supported by a local deployment")
  if (!capture && (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM))
    throw new Error("Email delivery is not configured")
  const response = await fetch(capture ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(capture
        ? {}
        : { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }),
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM ?? "QR POS <local@example.com>",
      to: [recipient],
      subject,
      text,
    }),
  })
  if (!response.ok)
    throw new Error(`Email delivery failed (${response.status})`)
}

export const sendPasswordReset = internalAction({
  args: { recipient: v.string(), url: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await deliverEmail(
      args.recipient,
      "QR POS — Reset your password / စကားဝှက်ပြန်သတ်မှတ်ရန်",
      `Reset your QR POS password using this link. If you did not request it, ignore this email.\n\nQR POS စကားဝှက်ပြန်သတ်မှတ်ရန် အောက်ပါလင့်ခ်ကို အသုံးပြုပါ။ သင်မတောင်းဆိုခဲ့ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုပါ။\n\n${args.url}`
    )
    return null
  },
})

export const sendStaffInvitation = internalAction({
  args: {
    invitationId: v.id("staffInvitations"),
    recipient: v.string(),
    storeName: v.string(),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      !(await ctx.runQuery(internal.staff.canDeliver, {
        invitationId: args.invitationId,
      }))
    )
      return null
    let delivery: "sent" | "failed" = "sent"
    try {
      await deliverEmail(
        args.recipient,
        "QR POS — Staff invitation / ဝန်ထမ်းဖိတ်ကြားခြင်း",
        `You have been invited to work at ${args.storeName}. Sign in or create your individual account using this invitation. This link expires in seven days.\n\n${args.storeName} ဆိုင်တွင် အလုပ်လုပ်ရန် ဖိတ်ကြားထားပါသည်။ သင့်ကိုယ်ပိုင်အကောင့်ဖြင့် ဝင်ပါ သို့မဟုတ် အကောင့်ဖန်တီးပါ။ ဤလင့်ခ်သည် ၇ ရက်အတွင်း သက်တမ်းကုန်ပါမည်။\n\n${args.url}`
      )
    } catch {
      delivery = "failed"
    }
    await ctx.runMutation(internal.staff.recordDelivery, {
      invitationId: args.invitationId,
      delivery,
    })
    return null
  },
})
