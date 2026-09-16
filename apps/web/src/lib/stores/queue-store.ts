import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"
import { useUIStore } from "./ui-store"

export interface PlaylistItem {
    id: string | number
    title: string
    subtitle?: string
    playableUrl: string
    thumbnail?: string
    mediaId: number
    episodeNumber?: number
    malId?: number | null
    mediaFormat?: string | null
}

export type QueueRepeatMode = "off" | "all" | "one"

export interface QueueState {
    playlistQueue: PlaylistItem[]
    currentQueueIndex: number
    activeQueuePlayItem: PlaylistItem | null
    queueRepeatMode: QueueRepeatMode
    addToQueue: (item: PlaylistItem) => void
    removeFromQueue: (index: number) => void
    clearQueue: () => void
    setCurrentQueueIndex: (index: number) => void
    setActiveQueuePlayItem: (item: PlaylistItem | null) => void
    playNext: (item: PlaylistItem) => void
    shuffleQueue: () => void
    playPrevious: () => void
    moveQueueItem: (fromIndex: number, toIndex: number) => void
    setQueueRepeatMode: (mode: QueueRepeatMode) => void
}

export const useQueueStore = create<QueueState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    playlistQueue: [],
                    currentQueueIndex: -1,
                    activeQueuePlayItem: null,
                    queueRepeatMode: "off" as QueueRepeatMode,
                    addToQueue: (item) => {
                        useUIStore.getState().setGlobalQueueOpen(true)
                        set((state) => {
                            const exists = state.playlistQueue.some(i => i.id === item.id && i.episodeNumber === item.episodeNumber);
                            if (exists) return {};
                            return {
                                playlistQueue: [...state.playlistQueue, item],
                            };
                        })
                    },
                    removeFromQueue: (index) => set((state) => {
                        const nextQueue = state.playlistQueue.filter((_, i) => i !== index);
                        let nextIndex = state.currentQueueIndex;
                        let nextPlayItem: PlaylistItem | null = state.activeQueuePlayItem;

                        if (index === state.currentQueueIndex) {
                            nextIndex = -1;
                            nextPlayItem = null;
                        } else if (index < state.currentQueueIndex) {
                            nextIndex = state.currentQueueIndex - 1;
                            nextPlayItem = nextQueue[nextIndex] || null;
                        }
                        if (nextQueue.length === 0) {
                            nextIndex = -1;
                            nextPlayItem = null;
                        }

                        return {
                            playlistQueue: nextQueue,
                            currentQueueIndex: nextIndex,
                            activeQueuePlayItem: nextPlayItem
                        };
                    }),
                    clearQueue: () => set({ playlistQueue: [], currentQueueIndex: -1, activeQueuePlayItem: null }),
                    setCurrentQueueIndex: (index) => set((state) => {
                        const item = state.playlistQueue[index] || null;
                        return { currentQueueIndex: index, activeQueuePlayItem: item };
                    }),
                    setActiveQueuePlayItem: (item) => set((state) => {
                        if (!item) {
                            return { activeQueuePlayItem: null, currentQueueIndex: -1 };
                        }
                        const idx = state.playlistQueue.findIndex(i => i.id === item.id && i.episodeNumber === item.episodeNumber);
                        return { activeQueuePlayItem: item, currentQueueIndex: idx };
                    }),
                    playNext: (item) => set((state) => {
                        const nextQueue = [...state.playlistQueue];
                        const existingIdx = nextQueue.findIndex(i => i.id === item.id && i.episodeNumber === item.episodeNumber);
                        if (existingIdx !== -1) {
                            nextQueue.splice(existingIdx, 1);
                        }
                        const insertIdx = state.currentQueueIndex + 1;
                        nextQueue.splice(insertIdx, 0, item);
                        return { playlistQueue: nextQueue };
                    }),
                    shuffleQueue: () => set((state) => {
                        if (state.playlistQueue.length <= 1) return {}
                        const activeItem = state.activeQueuePlayItem ?? (state.currentQueueIndex >= 0 ? state.playlistQueue[state.currentQueueIndex] : null)
                        const activeId = activeItem?.id
                        const activeEp = activeItem?.episodeNumber
                        const arr = [...state.playlistQueue]
                        for (let i = arr.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1))
                            const tmp = arr[i]
                            arr[i] = arr[j]
                            arr[j] = tmp
                        }
                        let newIndex = state.currentQueueIndex
                        if (activeId != null) {
                            const found = arr.findIndex(it => it.id === activeId && it.episodeNumber === activeEp)
                            newIndex = found !== -1 ? found : -1
                        }
                        const newActive = newIndex !== -1 ? arr[newIndex] : null
                        return { playlistQueue: arr, currentQueueIndex: newIndex, activeQueuePlayItem: newActive }
                    }),
                    playPrevious: () => set((state) => {
                        if (state.playlistQueue.length === 0) return {}
                        if (state.currentQueueIndex > 0) {
                            const prevIdx = state.currentQueueIndex - 1
                            return { currentQueueIndex: prevIdx, activeQueuePlayItem: state.playlistQueue[prevIdx] ?? null }
                        }
                        if (state.queueRepeatMode === "all" && state.playlistQueue.length > 0) {
                            const lastIdx = state.playlistQueue.length - 1
                            return { currentQueueIndex: lastIdx, activeQueuePlayItem: state.playlistQueue[lastIdx] }
                        }
                        return {}
                    }),
                    moveQueueItem: (fromIndex, toIndex) => set((state) => {
                        const len = state.playlistQueue.length
                        if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len || fromIndex === toIndex) return {}
                        const next = [...state.playlistQueue]
                        const [moved] = next.splice(fromIndex, 1)
                        next.splice(toIndex, 0, moved)
                        let nextIdx = state.currentQueueIndex
                        let nextActive = state.activeQueuePlayItem
                        if (state.currentQueueIndex === fromIndex) {
                            nextIdx = toIndex
                        } else if (fromIndex < state.currentQueueIndex && toIndex >= state.currentQueueIndex) {
                            nextIdx = state.currentQueueIndex - 1
                        } else if (fromIndex > state.currentQueueIndex && toIndex <= state.currentQueueIndex) {
                            nextIdx = state.currentQueueIndex + 1
                        }
                        if (nextIdx !== -1) nextActive = next[nextIdx] ?? null
                        return { playlistQueue: next, currentQueueIndex: nextIdx, activeQueuePlayItem: nextActive }
                    }),
                    setQueueRepeatMode: (mode) => set({ queueRepeatMode: mode }),
                }),
                {
                    name: "kamehouse-queue-settings",
                    partialize: (state) => ({
                        playlistQueue: Array.isArray(state.playlistQueue) ? state.playlistQueue.slice(0, 50) : [],
                        currentQueueIndex: typeof state.currentQueueIndex === 'number' ? Math.min(state.currentQueueIndex, 49) : -1,
                        queueRepeatMode: state.queueRepeatMode,
                    }),
                }
            )
        )
    )
)