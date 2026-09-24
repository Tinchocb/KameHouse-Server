export const __isTauriDesktop__ = typeof window !== "undefined" && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__ || window.__isTauriDesktop__)
export const __isDesktop__ = __isTauriDesktop__ || import.meta.env.SEA_PUBLIC_PLATFORM === "desktop"

// Platform detection for Smart TV browsers (Tizen, webOS, etc.)
const __isTizenTV__ = typeof navigator !== "undefined" && /Tizen/.test(navigator.userAgent)
const __isWebOS__ = typeof navigator !== "undefined" && /WebOS/.test(navigator.userAgent)
export const __isTV__ = __isTizenTV__ || __isWebOS__ || (typeof navigator !== "undefined" && /SmartTV/.test(navigator.userAgent))

