import { v } from "convex/values"
import { internalAction } from "./_generated/server"

const loopback = (url: URL) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)

export const sendPasswordReset = internalAction({
  args: { recipient: v.string(), url: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const capture = process.env.DEV_EMAIL_CAPTURE_URL
    const local =
      process.env.SITE_URL &&
      process.env.CONVEX_SITE_URL &&
      loopback(new URL(process.env.SITE_URL)) &&
      loopback(new URL(process.env.CONVEX_SITE_URL))
    if (capture && (!local || !loopback(new URL(capture))))
      throw new Error("Email capture is only supported by a local deployment")
    if (
      !capture &&
      (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM)
    )
      throw new Error("Password recovery email delivery is not configured")
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
        to: [args.recipient],
        subject: "QR POS — Reset your password / စကားဝှက်ပြန်သတ်မှတ်ရန်",
        text: `Reset your QR POS password using this link. If you did not request it, ignore this email.\n\nQR POS စကားဝှက်ပြန်သတ်မှတ်ရန် အောက်ပါလင့်ခ်ကို အသုံးပြုပါ။ သင်မတောင်းဆိုခဲ့ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုပါ။\n\n${args.url}`,
      }),
    })
    if (!response.ok)
      throw new Error(`Email delivery failed (${response.status})`)
    return null
  },
})
