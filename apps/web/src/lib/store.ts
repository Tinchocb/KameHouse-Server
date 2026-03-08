import { create } from "zustand"
import { persist } from "zustand/middleware"

interface ProgressState {
    watchedEpisodes: string[] // Array of episode IDs
    markWatched: (episodeId: string) => void
    unmarkWatched: (episodeId: string) => void
    isWatched: (episodeId: string) => boolean
}

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            watchedEpisodes: [],
            markWatched: (episodeId) =>
                set((state) => ({
                    watchedEpisodes: state.watchedEpisodes.includes(episodeId)
                        ? state.watchedEpisodes
                        : [...state.watchedEpisodes, episodeId],
                })),
            unmarkWatched: (episodeId) =>
                set((state) => ({
                    watchedEpisodes: state.watchedEpisodes.filter((id) => id !== episodeId),
                })),
            isWatched: (episodeId) => get().watchedEpisodes.includes(episodeId),
        }),
        {
            name: "kamehouse-minimal-progress", // Key in localStorage
        }
    )
)
