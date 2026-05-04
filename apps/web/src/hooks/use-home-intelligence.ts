import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { create } from "zustand"
import { buildSeaQuery } from "@/api/client/requests"
import type {
    CuratedHomeResponse,
    ContinueWatchingEntry,
} from "@/api/types/intelligence.types"

export type {
    ContentTag,
    EpisodeIntelligence,
    IntelligentEntry,
    CuratedSwimlane,
    CuratedHomeResponse,
    ContinueWatchingEntry,
} from "@/api/types/intelligence.types"

export function useHomeIntelligence(): UseQueryResult<CuratedHomeResponse, Error> {
    return useQuery({
        queryKey: ["home", "curated"],
        queryFn: async () => {
            const result = await buildSeaQuery<CuratedHomeResponse>({
                endpoint: "/api/v1/home/curated",
                method: "GET",
            });
            return result ?? { swimlanes: [] };
        },
        staleTime: 1000 * 60 * 5, // 5 min
    })
}

export function useContinueWatching(): UseQueryResult<ContinueWatchingEntry[], Error> {
    return useQuery({
        queryKey: ["home", "continue-watching"],
        queryFn: async () => {
            const result = await buildSeaQuery<ContinueWatchingEntry[]>({
                endpoint: "/api/v1/home/continue-watching",
                method: "GET",
            });
            return result ?? [];
        },
        staleTime: 1000 * 60 * 2, // 2 min
    })
}

// ─── Global backdrop store ────────────────────────────────────────────────────

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
        // 150 ms debounce — prevents flickering during fast mouse movements
        if (hoverTimer) clearTimeout(hoverTimer)
        if (url === null) {
            // Clear immediately when leaving entire swimlane
            hoverTimer = setTimeout(() => set({ currentBackdropUrl: null }), 300)
        } else {
            hoverTimer = setTimeout(() => set({ currentBackdropUrl: url }), 150)
        }
    },
}))
