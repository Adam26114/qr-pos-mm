import { useCopy } from "@/components/language-switcher"
const en = {
  review: "Review order",
  back: "Back to cart",
  table: "Your table",
  chooseTable: "Choose the table where you are seated",
  submit: "Submit cash order",
  cashNote:
    "Pay cash to the store after eating. Each submission has its own bill.",
  noTables: "No tables are available. Ask staff before ordering.",
  track: "Track order",
  tracking: "Live order status",
  link: "Tracking link",
  copyLink: "Copy tracking link",
  copied: "Tracking link copied.",
  privateLink: "Keep this link private. Anyone with it can view this order.",
  missing: "Order not found",
  missingIntro:
    "Use your private tracking link. A table or bill number cannot open an order.",
  again: "Order again",
  previous: "Your previous orders",
  qrOrder: "QR order",
  storage:
    "Browser storage is needed to recover your order. Your saved recovery data could not be read or updated. Keep your tracking link and ask staff before submitting again.",
  conflict:
    "This recovery link belongs to a different submission. Keep it and ask staff before submitting again.",
  reviewingChanged:
    "The menu changed. Go back to your cart and review it again before submitting.",
}
const my: Record<keyof typeof en, string> = {
  review: "အော်ဒါစစ်မည်",
  back: "ခြင်းသို့ ပြန်မည်",
  table: "သင့်စားပွဲ",
  chooseTable: "သင်ထိုင်နေသော စားပွဲကို ရွေးပါ",
  submit: "ငွေသားအော်ဒါ တင်မည်",
  cashNote:
    "စားပြီးမှ ဆိုင်သို့ ငွေသားပေးချေပါ။ အော်ဒါတစ်ခုစီတွင် သီးခြားဘီလ်ရှိပါသည်။",
  noTables: "ရွေးနိုင်သော စားပွဲမရှိပါ။ အော်ဒါမတင်မီ ဝန်ထမ်းကို မေးပါ။",
  track: "အော်ဒါကြည့်မည်",
  tracking: "အော်ဒါအခြေအနေ",
  link: "အော်ဒါကြည့်ရန် လင့်ခ်",
  copyLink: "အော်ဒါလင့်ခ် ကူးမည်",
  copied: "အော်ဒါလင့်ခ် ကူးပြီးပါပြီ။",
  privateLink:
    "ဤလင့်ခ်ကို သီးသန့်ထားပါ။ လင့်ခ်ရှိသူတိုင်း ဤအော်ဒါကို ကြည့်နိုင်ပါသည်။",
  missing: "အော်ဒါမတွေ့ပါ",
  missingIntro:
    "သင့်သီးသန့်အော်ဒါလင့်ခ်ကို သုံးပါ။ စားပွဲနံပါတ် သို့မဟုတ် ဘီလ်နံပါတ်ဖြင့် အော်ဒါကို ဖွင့်မရပါ။",
  again: "ထပ်မှာမည်",
  previous: "သင့်ယခင်အော်ဒါများ",
  qrOrder: "QR အော်ဒါ",
  storage:
    "အော်ဒါပြန်ရှာရန် ဘရောက်ဇာသိမ်းဆည်းမှု လိုပါသည်။ သိမ်းထားသော အချက်အလက်ကို ဖတ်မရ သို့မဟုတ် ပြင်မရပါ။ သင့်အော်ဒါလင့်ခ်ကို သိမ်းထားပြီး ထပ်မတင်မီ ဝန်ထမ်းကို မေးပါ။",
  conflict:
    "ဤလင့်ခ်သည် အခြားအော်ဒါတစ်ခုအတွက် ဖြစ်ပါသည်။ လင့်ခ်ကို သိမ်းထားပြီး ထပ်မတင်မီ ဝန်ထမ်းကို မေးပါ။",
  reviewingChanged:
    "မီနူးပြောင်းသွားပါသည်။ မတင်မီ ခြင်းသို့ ပြန်ပြီး ထပ်စစ်ပါ။",
}
export function useGuestCopy() {
  const { language } = useCopy()
  return language === "my" ? my : en
}
