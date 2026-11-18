export const __isTauriDesktop__ = typeof window !== "undefined" && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__ || window.__isTauriDesktop__)
export const __isDesktop__ = __isTauriDesktop__ || import.meta.env.KAMEHOUSE_PUBLIC_PLATFORM === "desktop"

