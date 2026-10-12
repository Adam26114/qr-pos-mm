"use client"

import { useCopy } from "@/components/language-switcher"

const en = {
  reports: "Revenue reports",
  day: "Day",
  month: "Month",
  reportDay: "Reporting day",
  reportMonth: "Reporting month",
  today: "Today",
  thisMonth: "This month",
  timezone: "Asia/Yangon · Money received and returned in the selected period.",
  collected: "Collected",
  refunded: "Refunded",
  net: "Net collected",
  unpaid: "Unpaid now",
  collections: "Collections",
  refunds: "Refunds",
  unpaidOrders: "Unpaid orders",
  collectedNote: "Confirmed customer payments, including excess collections.",
  refundedNote: "Full refunds completed in this period.",
  netNote: "Collected minus refunded; may be negative.",
  unpaidNote: "Currently outstanding across all dates.",
  orders: "orders",
  eventTime: "Event time",
  recordedTime: "Recorded time",
  bill: "Bill",
  destination: "Destination",
  method: "Method",
  reference: "Reference",
  amount: "Amount",
  created: "Created",
  status: "Status",
  amountDue: "Amount due",
  viewOrder: "View order",
  preparing:
    "Preparing reports from existing records. Totals will appear when reconciliation finishes.",
  emptyCollections: "No collections in this period.",
  emptyRefunds: "No refunds in this period.",
  emptyUnpaid: "No outstanding unpaid orders.",
  invalidPeriod:
    "Choose a valid day or month no later than the current Yangon date.",
}

const my: typeof en = {
  reports: "ရောင်းရငွေ အစီရင်ခံစာ",
  day: "နေ့",
  month: "လ",
  reportDay: "အစီရင်ခံမည့်နေ့",
  reportMonth: "အစီရင်ခံမည့်လ",
  today: "ယနေ့",
  thisMonth: "ယခုလ",
  timezone: "Asia/Yangon · ရွေးထားသောကာလအတွင်း လက်ခံရငွေနှင့် ပြန်အမ်းငွေ။",
  collected: "လက်ခံရငွေ",
  refunded: "ပြန်အမ်းငွေ",
  net: "အသားတင် လက်ခံရငွေ",
  unpaid: "လက်ရှိ ပေးရန်ကျန်ငွေ",
  collections: "ငွေလက်ခံမှုများ",
  refunds: "ငွေပြန်အမ်းမှုများ",
  unpaidOrders: "ငွေမပေးရသေးသော အော်ဒါများ",
  collectedNote: "အပိုလက်ခံရငွေအပါအဝင် အတည်ပြုထားသော ဖောက်သည်ပေးငွေ။",
  refundedNote: "ဤကာလအတွင်း ပြီးစီးသော ငွေအပြည့်ပြန်အမ်းမှု။",
  netNote: "လက်ခံရငွေမှ ပြန်အမ်းငွေနုတ်ထားသည်။ အနုတ်ဖြစ်နိုင်ပါသည်။",
  unpaidNote: "ရက်အားလုံးအတွက် လက်ရှိပေးရန်ကျန်ငွေ။",
  orders: "အော်ဒါ",
  eventTime: "ငွေလွှဲချိန်",
  recordedTime: "မှတ်တမ်းတင်ချိန်",
  bill: "ဘောင်ချာ",
  destination: "ပို့ဆောင်ရန်နေရာ",
  method: "ငွေပေးချေနည်း",
  reference: "ငွေလွှဲရည်ညွှန်းချက်",
  amount: "ပမာဏ",
  created: "ဖန်တီးချိန်",
  status: "အခြေအနေ",
  amountDue: "ပေးရန်ကျန်ငွေ",
  viewOrder: "အော်ဒါကြည့်ရန်",
  preparing:
    "ရှိပြီးသားမှတ်တမ်းများမှ အစီရင်ခံစာ ပြင်ဆင်နေပါသည်။ စာရင်းကိုက်ညီမှုစစ်ဆေးပြီးလျှင် စုစုပေါင်းများ ပြသပါမည်။",
  emptyCollections: "ဤကာလအတွင်း ငွေလက်ခံမှုမရှိပါ။",
  emptyRefunds: "ဤကာလအတွင်း ငွေပြန်အမ်းမှုမရှိပါ။",
  emptyUnpaid: "ငွေပေးရန်ကျန်သော အော်ဒါမရှိပါ။",
  invalidPeriod:
    "လက်ရှိရန်ကုန်ရက်ထက် မကျော်သော မှန်ကန်သည့်နေ့ သို့မဟုတ် လကို ရွေးပါ။",
}

export function useReportCopy() {
  return useCopy().language === "my" ? my : en
}
