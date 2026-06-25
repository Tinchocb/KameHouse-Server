import { create } from "zustand"

export type { IntelligentEntry } from "@/api/types/intelligence.types"

interface IntelligenceStore {
    currentBackdropUrl: string | null
    pendingUrl: string | null
    setBackdropUrl: (url: string | null) => void
}

let hoverTimer: ReturnType<typeof setTimeout> | null = null

export const useIntelligenceStore = create<IntelligenceStore>((set) => ({
    currentBackdropUrl: null,
    pendingUrl: null,
    setBackdropUrl: (url) => {
        if (hoverTimer) clearTimeout(hoverTimer)
        if (url === null) {
            hoverTimer = setTimeout(() => set({ currentBackdropUrl: null }), 300)
        } else {
            hoverTimer = setTimeout(() => set({ currentBackdropUrl: url }), 150)
        }
    },
}))
