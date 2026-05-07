/**
 * ContinueWatchingCarousel
 *
 * Shows a horizontally-scrollable row of anime poster cards for which the
 * user has an in-progress watch history entry (currentTime > 0, < 90% done).
 * Consumes `useGetContinuityWatchHistory` and `useGetLibraryCollection`.
 */

import { useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { AnimePosterCard } from "@/components/shared/anime-poster-card"
import type { Continuity_WatchHistoryItem } from "@/api/generated/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInProgress(item: Continuity_WatchHistoryItem): boolean {
    if (!item.duration || item.duration === 0) return false
    const pct = item.currentTime / item.duration
    // Show if between 2% (started) and 90% (not fully watched)
    return pct >= 0.02 && pct < 0.90
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContinueWatchingCarousel() {
    const navigate = useNavigate()
    const { data: history } = useGetContinuityWatchHistory()
    const { data: collection } = useGetLibraryCollection()

    // Build a lookup map: mediaId → LibraryCollectionEntry
    const entryMap = useMemo(() => {
        const map = new Map<number, { title: string; posterUrl: string; subtitle?: string; totalEpisodes?: number; localEpisodes?: number }>()
        if (!collection?.lists) return map
        collection.lists.forEach(list => {
            list.entries?.forEach(entry => {
                if (!entry.media) return
                const m = entry.media
                map.set(entry.mediaId, {
                    title: m.titleEnglish || m.titleRomaji || m.titleOriginal || "Sin título",
                    posterUrl: m.posterImage || "",
                    subtitle: m.genres?.[0] ?? m.format ?? undefined,
                    totalEpisodes: m.totalEpisodes ?? undefined,
                    localEpisodes: entry.libraryData?.allFilesLocked !== undefined
                        ? undefined
                        : undefined,
                })
            })
        })
        return map
    }, [collection])

    // Filter & sort history entries
    const inProgress = useMemo(() => {
        if (!history) return []
        return Object.values(history)
            .filter(isInProgress)
            .sort((a, b) => {
                // Most recently updated first
                const ta = a.timeUpdated ? new Date(a.timeUpdated).getTime() : 0
                const tb = b.timeUpdated ? new Date(b.timeUpdated).getTime() : 0
                return tb - ta
            })
            .slice(0, 20)
    }, [history])

    if (!inProgress.length) return null

    return (
        <section className="pt-10 pb-2">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-5 px-6 md:px-14">
                <div className="w-1 h-5 bg-brand-orange rounded-full" />
                <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-brand-orange fill-brand-orange" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-white">
                        Continuar Viendo
                    </h2>
                </div>
                <span className="text-[9px] text-zinc-600 font-mono font-bold uppercase tracking-widest ml-1">
                    {inProgress.length} título{inProgress.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Horizontal Scroll Row */}
            <div className="overflow-x-auto no-scrollbar px-6 md:px-14">
                <div className="flex gap-3 w-max">
                    {inProgress.map(item => {
                        const meta = entryMap.get(item.mediaId)
                        if (!meta) return null
                        return (
                            <div
                                key={`${item.mediaId}-${item.episodeNumber}`}
                                className="w-[130px] shrink-0"
                            >
                                <AnimePosterCard
                                    mediaId={item.mediaId}
                                    title={meta.title}
                                    posterUrl={meta.posterUrl}
                                    subtitle={meta.subtitle}
                                    totalEpisodes={meta.totalEpisodes}
                                    watchHistoryItem={item}
                                    onClick={() =>
                                        navigate({
                                            to: "/series/$seriesId",
                                            params: { seriesId: item.mediaId.toString() },
                                        })
                                    }
                                />
                                {/* Episode label below card */}
                                <p className="mt-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate">
                                    EP {item.episodeNumber}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Divider */}
            <div className="mt-8 mx-6 md:mx-14 border-t border-white/5" />
        </section>
    )
}
