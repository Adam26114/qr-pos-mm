export type Language = "en" | "my"

const en = {
  language: "Language",
  signIn: "Sign in",
  signOut: "Sign out",
  createAccount: "Create account",
  name: "Your name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  registerTitle: "A fresh start for your store.",
  loginTitle: "Welcome back.",
  registerIntro:
    "Create your owner account. Your trial starts when you create your store.",
  loginIntro: "Sign in to your store workspace.",
  haveAccount: "Already have an account?",
  newAccount: "New to QR POS?",
  forgot: "Forgot your password?",
  backToLogin: "Back to sign in",
  forgotTitle: "Let's get you back in.",
  forgotIntro: "Enter your email to receive a password reset link.",
  sendReset: "Send reset link",
  emailSent:
    "If an account exists for this email, a reset link will arrive shortly.",
  resetTitle: "Choose a new password.",
  resetIntro: "Use at least 8 characters to protect your account.",
  reset: "Reset password",
  resetSuccess: "Password updated. You can now sign in.",
  invalidLink: "This reset link is invalid or has expired. Request a new link.",
  accountExists: "An account already uses this email. Sign in instead.",
  invalidCredentials: "The email or password is incorrect.",
  requestFailed:
    "We couldn't complete that request. Check your connection and try again.",
  invalidName: "Enter a name between 2 and 80 characters.",
  invalidEmail: "Enter a valid email address.",
  invalidPassword: "Use between 8 and 128 characters.",
  passwordMismatch: "The passwords must match.",
  working: "Please wait…",
  loading: "Opening your workspace…",
  storeName: "Store name",
  createStore: "Create store",
  createStoreTitle: "Give your store a name.",
  createStoreIntro:
    "This is the name your customers will see. Your 14-day trial begins now.",
  storePlaceholder: "For example, Mingalar Cafe",
  ownerWorkspace: "Owner workspace",
  activeTrial: "Active trial",
  expiredTrial: "Trial expired",
  trialEnds: "Trial ends",
  trialStarted: "Trial started",
  storeReady: "Your store is ready.",
  storeReadyIntro:
    "Your store and trial are saved. This workspace belongs to your owner account.",
  expiryIntro:
    "Your store is still here. New orders require an active subscription; your records remain accessible.",
  monthlyPlan: "Monthly plan",
  monthlyPrice: "30,000 MMK / month",
  trialLabel: "14-day free trial",
  trialPromise: "One store. One fresh start.",
  trialNote: "No payment is required to create your store.",
  ownerAccount: "Owner account",
  online: "Online",
  disconnected: "Connection lost. Reconnecting to your store…",
  offline: "You're offline. Reconnect before continuing.",
  workspace: "Workspace",
  account: "Account",
  retry: "Try again",
  errorTitle: "We couldn't open this page.",
  homeTagline: "One menu. Every table.",
  homeIntro: "A shared QR menu and a counter POS for your cafe or restaurant.",
  validationError: "Check the form and try again.",
  ownerRequired: "Only a store owner can create a store.",
}

const my: Record<keyof typeof en, string> = {
  language: "ဘာသာစကား",
  signIn: "အကောင့်ဝင်မည်",
  signOut: "အကောင့်မှထွက်မည်",
  createAccount: "အကောင့်ဖန်တီးမည်",
  name: "သင့်အမည်",
  email: "အီးမေးလ်",
  password: "စကားဝှက်",
  confirmPassword: "စကားဝှက်အတည်ပြုပါ",
  registerTitle: "သင့်ဆိုင်အတွက် အစပြုခြင်းအသစ်။",
  loginTitle: "ပြန်လည်ကြိုဆိုပါသည်။",
  registerIntro:
    "ဆိုင်ပိုင်ရှင်အကောင့် ဖန်တီးပါ။ ဆိုင်ဖန်တီးချိန်မှ အစမ်းသုံးကာလ စတင်ပါမည်။",
  loginIntro: "သင့်ဆိုင်၏ လုပ်ငန်းစာမျက်နှာသို့ ဝင်ပါ။",
  haveAccount: "အကောင့်ရှိပြီးပြီလား။",
  newAccount: "QR POS ကို စတင်အသုံးပြုမလား။",
  forgot: "စကားဝှက်မေ့နေပါသလား။",
  backToLogin: "အကောင့်ဝင်ရန် ပြန်သွားမည်",
  forgotTitle: "အကောင့်သို့ ပြန်ဝင်ကြပါစို့။",
  forgotIntro: "စကားဝှက်ပြန်သတ်မှတ်ရန် လင့်ခ်ရရှိဖို့ အီးမေးလ်ထည့်ပါ။",
  sendReset: "ပြန်သတ်မှတ်ရန် လင့်ခ်ပို့မည်",
  emailSent: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပါက လင့်ခ်ကို မကြာမီ ရရှိပါမည်။",
  resetTitle: "စကားဝှက်အသစ် ရွေးချယ်ပါ။",
  resetIntro: "သင့်အကောင့်အတွက် အနည်းဆုံး စာလုံး ၈ လုံး အသုံးပြုပါ။",
  reset: "စကားဝှက်ပြန်သတ်မှတ်မည်",
  resetSuccess: "စကားဝှက် ပြောင်းပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။",
  invalidLink:
    "လင့်ခ် မမှန်ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးပါပြီ။ လင့်ခ်အသစ် တောင်းပါ။",
  accountExists: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်သည်။ အကောင့်ဝင်ပါ။",
  invalidCredentials: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မမှန်ပါ။",
  requestFailed:
    "လုပ်ဆောင်ချက် မပြီးမြောက်ပါ။ အင်တာနက်စစ်ဆေးပြီး ပြန်ကြိုးစားပါ။",
  invalidName: "စာလုံး ၂ လုံးမှ ၈၀ လုံးအတွင်း အမည်ထည့်ပါ။",
  invalidEmail: "မှန်ကန်သော အီးမေးလ်ထည့်ပါ။",
  invalidPassword: "စာလုံး ၈ လုံးမှ ၁၂၈ လုံးအတွင်း အသုံးပြုပါ။",
  passwordMismatch: "စကားဝှက်နှစ်ခု တူညီရပါမည်။",
  working: "ခဏစောင့်ပါ…",
  loading: "သင့်ဆိုင်ကို ဖွင့်နေပါသည်…",
  storeName: "ဆိုင်အမည်",
  createStore: "ဆိုင်ဖန်တီးမည်",
  createStoreTitle: "သင့်ဆိုင်အမည် ပေးပါ။",
  createStoreIntro:
    "သင့်ဖောက်သည်များ မြင်ရမည့် ဆိုင်အမည်ဖြစ်သည်။ ၁၄ ရက် အစမ်းသုံးကာလ စတင်ပါမည်။",
  storePlaceholder: "ဥပမာ၊ မင်္ဂလာကဖေး",
  ownerWorkspace: "ဆိုင်ပိုင်ရှင် လုပ်ငန်းစာမျက်နှာ",
  activeTrial: "အစမ်းသုံးကာလအတွင်း",
  expiredTrial: "အစမ်းသုံးကာလကုန်ဆုံးပြီ",
  trialEnds: "အစမ်းသုံးကာလ ကုန်ဆုံးမည့်ရက်",
  trialStarted: "အစမ်းသုံးကာလ စတင်သည့်ရက်",
  storeReady: "သင့်ဆိုင် အဆင်သင့်ဖြစ်ပါပြီ။",
  storeReadyIntro:
    "သင့်ဆိုင်နှင့် အစမ်းသုံးကာလကို သိမ်းဆည်းပြီးပါပြီ။ ဤစာမျက်နှာသည် သင့်ဆိုင်ပိုင်ရှင်အကောင့်အတွက် ဖြစ်သည်။",
  expiryIntro:
    "သင့်ဆိုင်ဒေတာ ရှိနေဆဲဖြစ်သည်။ အော်ဒါအသစ်များအတွက် ဝန်ဆောင်မှုသက်တမ်း လိုအပ်ပြီး မှတ်တမ်းများကို ကြည့်နိုင်ပါသည်။",
  monthlyPlan: "လစဉ်အစီအစဉ်",
  monthlyPrice: "တစ်လ ၃၀,၀၀၀ ကျပ်",
  trialLabel: "၁၄ ရက် အခမဲ့အစမ်းသုံးကာလ",
  trialPromise: "ဆိုင်တစ်ဆိုင်။ အစပြုခြင်းအသစ်တစ်ခု။",
  trialNote: "ဆိုင်ဖန်တီးရန် ငွေပေးချေဖို့ မလိုအပ်ပါ။",
  ownerAccount: "ဆိုင်ပိုင်ရှင်အကောင့်",
  online: "အင်တာနက်ချိတ်ဆက်ထားသည်",
  disconnected: "ဆိုင်နှင့် ချိတ်ဆက်မှု ပြတ်တောက်နေပါသည်။ ပြန်ချိတ်ဆက်နေပါသည်…",
  offline: "အင်တာနက် ပြတ်နေပါသည်။ ဆက်လုပ်ရန် ပြန်ချိတ်ဆက်ပါ။",
  workspace: "လုပ်ငန်းစာမျက်နှာ",
  account: "အကောင့်",
  retry: "ပြန်ကြိုးစားမည်",
  errorTitle: "ဤစာမျက်နှာကို မဖွင့်နိုင်ပါ။",
  homeTagline: "မီနူးတစ်ခု။ စားပွဲအားလုံးအတွက်။",
  homeIntro: "ကဖေးနှင့် စားသောက်ဆိုင်များအတွက် QR မီနူးနှင့် ကောင်တာ POS။",
  validationError: "ဖြည့်ထားသော အချက်အလက်များကို စစ်ပြီး ပြန်ကြိုးစားပါ။",
  ownerRequired: "ဆိုင်ပိုင်ရှင်သာ ဆိုင်ဖန်တီးနိုင်ပါသည်။",
}

export const messages = { en, my }
export type MessageKey = keyof typeof en
export function formError(
  message: string | undefined,
  copy: Record<MessageKey, string>
) {
  return message && Object.hasOwn(copy, message)
    ? copy[message as MessageKey]
    : copy.validationError
}
export function parseLanguage(value?: string): Language {
  return value === "my" ? "my" : "en"
}
