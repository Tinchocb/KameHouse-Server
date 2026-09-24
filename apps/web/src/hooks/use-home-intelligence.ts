import { create } from "zustand"

interface IntelligenceStore {
    currentBackdropUrl: string | null
    setBackdropUrl: (url: string | null, options?: { debounceMs?: number }) => void
}

let hoverTimer: ReturnType<typeof setTimeout> | null = null

export const useIntelligenceStore = create<IntelligenceStore>((set) => ({
    currentBackdropUrl: null,
    setBackdropUrl: (url, options) => {
        if (hoverTimer) {
            clearTimeout(hoverTimer)
            hoverTimer = null
        }
        if (!options?.debounceMs) {
            set({ currentBackdropUrl: url })
            return
        }
        if (url === null) {
            set({ currentBackdropUrl: null })
        } else {
            hoverTimer = setTimeout(() => {
                set({ currentBackdropUrl: url })
                hoverTimer = null
            }, options.debounceMs)
        }
    },
}))
