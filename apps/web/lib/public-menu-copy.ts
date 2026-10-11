import { useCopy } from "@/components/language-switcher"

const en = {
  menuQr: "Menu QR",
  qrIntro: "One QR for your store. Customers choose their table when ordering.",
  qrImage: "Store menu QR",
  download: "Download QR",
  openMenu: "Open customer menu",
  printNote:
    "Download the SVG to print it at any size. Keep the white border around the QR.",
  localNote:
    "This QR uses localhost. To test on a phone, open this workspace using an address the phone can reach.",
  loading: "Opening the menu…",
  missing: "Menu not found",
  missingIntro: "Check the menu link or ask the store for its QR.",
}
const my: Record<keyof typeof en, string> = {
  menuQr: "မီနူး QR",
  qrIntro:
    "ဆိုင်တစ်ဆိုင်အတွက် QR တစ်ခုတည်း။ ဖောက်သည်က အော်ဒါတင်ချိန်တွင် စားပွဲကို ရွေးပါမည်။",
  qrImage: "ဆိုင်မီနူး QR",
  download: "QR ဒေါင်းလုဒ်မည်",
  openMenu: "ဖောက်သည်မီနူး ဖွင့်မည်",
  printNote:
    "အရွယ်အစားမရွေး ပုံနှိပ်ရန် SVG ကို ဒေါင်းလုဒ်ပါ။ QR ပတ်လည်ရှိ အဖြူရောင်ဘောင်ကို ထားပါ။",
  localNote:
    "ဤ QR သည် localhost ကို သုံးထားပါသည်။ ဖုန်းဖြင့် စမ်းရန် ဖုန်းမှ ဝင်နိုင်သော လိပ်စာဖြင့် ဤလုပ်ငန်းခွင်ကို ဖွင့်ပါ။",
  loading: "မီနူးဖွင့်နေပါသည်…",
  missing: "မီနူးမတွေ့ပါ",
  missingIntro: "မီနူးလင့်ခ်ကို စစ်ပါ သို့မဟုတ် ဆိုင်ထံမှ QR ကို တောင်းပါ။",
}

export function usePublicMenuCopy() {
  const { language } = useCopy()
  return language === "my" ? my : en
}
