import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit"
import type { Language } from "./i18n"

const ui = createSlice({
  name: "ui",
  initialState: { language: "en" as Language },
  reducers: {
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload
    },
  },
})
export const { setLanguage } = ui.actions
export function makeUiStore(language: Language) {
  return configureStore({
    reducer: { ui: ui.reducer },
    preloadedState: { ui: { language } },
  })
}
export type UiState = ReturnType<ReturnType<typeof makeUiStore>["getState"]>
