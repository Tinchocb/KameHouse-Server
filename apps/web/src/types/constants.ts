export const __isElectronDesktop__ = import.meta.env.SEA_PUBLIC_DESKTOP === "electron"
export const __isDesktop__ = import.meta.env.SEA_PUBLIC_PLATFORM === "desktop" || __isElectronDesktop__
// Platform detection for Smart TV browsers (Tizen, webOS, etc.)
const __isTizenTV__ = typeof navigator !== "undefined" && /Tizen/.test(navigator.userAgent)
const __isWebOS__ = typeof navigator !== "undefined" && /WebOS/.test(navigator.userAgent)
const __isSmartTV__ = __isTizenTV__ || __isWebOS__ || typeof navigator !== "undefined" && /SmartTV/.test(navigator.userAgent)
export const __isTV__ = __isSmartTV__ || __isElectronDesktop__ // TV mode for both Smart TV and Electron (can be connected to TV)
