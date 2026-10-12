"use client"
import { useCopy } from "@/components/language-switcher"
const en = {
  method: "Payment method",
  cash: "Cash",
  mmqr: "MMQR — simulation",
  checkout: "MMQR checkout",
  simulation: "Simulation · no real payment",
  warning:
    "Non-payable test QR. Do not send money. Confirm test outcomes with the protected local developer command.",
  start: "Generate test QR",
  check: "Check payment",
  retry: "Retry MMQR checkout",
  recover: "Recover checkout",
  save: "Save MMQR order",
  submit: "Submit MMQR order",
  beforeCooking:
    "Payment must be confirmed before cooking. The payment method stays fixed for this bill.",
  creating: "Creating test checkout",
  pending: "Waiting for payment confirmation",
  uncertain: "Payment status is uncertain. Check again before retrying.",
  failed: "Checkout failed. Check payment before creating a replacement.",
  expired:
    "Test QR expired. A late payment may still arrive; check before retrying.",
  succeeded: "Payment confirmed",
  refunded: "Refund recorded",
  expires: "Test QR expires",
  qr: "Non-payable MMQR test QR",
  review: "Review payments",
  reviewIntro:
    "Review excess collections and cancelled bills retaining money. Record a full refund only after returning the money externally.",
  preparing: "Preparing payment review",
  none: "No payments need review.",
  retained: "Retained money",
  disabled: "MMQR simulation is unavailable on this backend.",
  fixed: "This bill’s payment method cannot be changed.",
  required: "Confirm payment before continuing.",
  missing: "Checkout is not ready. Try again.",
}
const my: Record<keyof typeof en, string> = {
  method: "ငွေပေးချေမှုနည်းလမ်း",
  cash: "ငွေသား",
  mmqr: "MMQR — စမ်းသပ်မှု",
  checkout: "MMQR ငွေရှင်းရန်",
  simulation: "စမ်းသပ်မှု · ငွေအစစ်မပေးရ",
  warning:
    "ဤ QR သည် စမ်းသပ်ရန်သာ ဖြစ်သည်။ ငွေမပို့ပါနှင့်။ စက်တွင်း developer command ဖြင့်သာ စမ်းသပ်ရလဒ်ကို အတည်ပြုပါ။",
  start: "စမ်းသပ် QR ထုတ်မည်",
  check: "ငွေပေးချေမှု စစ်မည်",
  retry: "MMQR ငွေရှင်းမှု ပြန်ကြိုးစားမည်",
  recover: "ငွေရှင်းမှု ပြန်ဖွင့်မည်",
  save: "MMQR အော်ဒါ သိမ်းမည်",
  submit: "MMQR အော်ဒါ တင်မည်",
  beforeCooking:
    "ချက်ပြုတ်မစမီ ငွေပေးချေမှု အတည်ပြုရပါမည်။ ဤဘီလ်၏ ငွေပေးချေမှုနည်းလမ်းကို ပြောင်းမရပါ။",
  creating: "စမ်းသပ်ငွေရှင်းမှု ဖန်တီးနေသည်",
  pending: "ငွေပေးချေမှု အတည်ပြုရန် စောင့်နေသည်",
  uncertain: "ငွေပေးချေမှုအခြေအနေ မသေချာပါ။ ပြန်မကြိုးစားမီ ထပ်စစ်ပါ။",
  failed: "ငွေရှင်းမှု မအောင်မြင်ပါ။ အသစ်မဖန်တီးမီ ငွေပေးချေမှု စစ်ပါ။",
  expired:
    "စမ်းသပ် QR သက်တမ်းကုန်ပါပြီ။ နောက်ကျငွေ ဝင်နိုင်သေးသည်။ ပြန်မကြိုးစားမီ စစ်ပါ။",
  succeeded: "ငွေပေးချေမှု အတည်ပြုပြီး",
  refunded: "ငွေပြန်အမ်းမှု မှတ်တမ်းတင်ပြီး",
  expires: "စမ်းသပ် QR သက်တမ်းကုန်ချိန်",
  qr: "ငွေမပေးရသော MMQR စမ်းသပ် QR",
  review: "ငွေပေးချေမှု စစ်ဆေးမည်",
  reviewIntro:
    "ပိုလက်ခံထားသောငွေနှင့် ပယ်ဖျက်ပြီး လက်ကျန်ငွေရှိသောဘီလ်များ စစ်ပါ။ ငွေကို အပြင်တွင် ပြန်ပေးပြီးမှ အပြည့်ပြန်အမ်းမှု မှတ်တမ်းတင်ပါ။",
  preparing: "ငွေပေးချေမှု စစ်ဆေးရန် ပြင်ဆင်နေသည်",
  none: "စစ်ဆေးရန် ငွေပေးချေမှု မရှိပါ။",
  retained: "လက်ကျန်လက်ခံငွေ",
  disabled: "ဤ backend တွင် MMQR စမ်းသပ်မှု မရရှိပါ။",
  fixed: "ဤဘီလ်၏ ငွေပေးချေမှုနည်းလမ်းကို ပြောင်းမရပါ။",
  required: "ဆက်မလုပ်မီ ငွေပေးချေမှု အတည်ပြုပါ။",
  missing: "ငွေရှင်းမှု အဆင်သင့်မဖြစ်သေးပါ။ ပြန်ကြိုးစားပါ။",
}
export function usePaymentCopy() {
  return useCopy().language === "my" ? my : en
}
