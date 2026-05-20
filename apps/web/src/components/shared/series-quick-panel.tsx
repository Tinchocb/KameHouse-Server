/**
 * SeriesQuickPanel — Slide-up sheet that previews a series without leaving the current page.
 *
 * Usage:
 *   <SeriesQuickPanel seriesId={id} open={isOpen} onClose={() => setOpen(false)} onNavigate={() => navigate(...)} />
 *
 * Features:
 * - Loads entry data lazily only when `open=true`
 * - Compact episode list with progress bar, watched state, and play button
 * - Saga selector if the series has sagas configured
 * - Backdrop/poster hero area with play CTA
 * - Smooth spring animation via Framer Motion
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Play, ChevronRight, Star, Check, Lock } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { Anime_Episode, Anime_LocalFile } from "@/api/generated/types"
import { resolveSeriesSagas } from "@/lib/config/dragonball.config"
import { DeferredImage } from "@/components/shared/deferred-image"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SeriesQuickPanelProps {
    seriesId: number | string | null
    open: boolean
    onClose: () => void
    /** Navigate to the full detail page */
    onNavigate: (seriesId: string) => void
    /** Called when the user hits Play from the panel */
    onPlay?: (seriesId: string) => void
}

// ─── Helper: parse genres from various API shapes ────────────────────────────

function parseGenres(g: unknown): string[] {
    if (!g) return []
    if (Array.isArray(g)) return g as string[]
    if (typeof g === "string") {
        try {
            if (g.startsWith("[")) return JSON.parse(g)
            return JSON.parse(atob(g))
        } catch {
            return []
        }
    }
    return []
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PanelSkeleton() {
    return (
        <div className="flex flex-col h-full animate-pulse">
            <div className="h-[260px] bg-zinc-900/80 shrink-0" />
            <div className="flex flex-col gap-4 p-6">
                <div className="h-8 w-2/3 bg-zinc-800 rounded-lg" />
                <div className="h-4 w-1/2 bg-zinc-900 rounded-lg" />
                <div className="h-4 w-full bg-zinc-900 rounded-lg" />
                <div className="h-4 w-5/6 bg-zinc-900 rounded-lg" />
                <div className="mt-4 flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 h-14 bg-zinc-900/40 rounded-xl px-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="h-3 w-1/3 bg-zinc-800 rounded" />
                                <div className="h-2.5 w-2/3 bg-zinc-900 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Compact Episode Row ──────────────────────────────────────────────────────

const EpisodeRow = React.memo(function EpisodeRow({
    episode,
    localFile,
    isResumeTarget,
    onPlay,
    continuityProgress,
}: {
    episode: Anime_Episode
    localFile?: Anime_LocalFile
    isResumeTarget: boolean
    onPlay?: (lf: Anime_LocalFile, ep: Anime_Episode) => void
    continuityProgress?: number
}) {
    const epNum = episode.absoluteEpisodeNumber || episode.episodeNumber
    const hasFile = !!localFile
    const isWatched = episode.watched
    const thumb = episode.episodeMetadata?.image

    // Progress within this episode (0-100). Only shown for resume target.
    const epProgress = isResumeTarget && continuityProgress !== undefined
        ? Math.min(100, Math.max(0, continuityProgress))
        : null

    return (
        <div
            className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer",
                isResumeTarget
                    ? "bg-brand-orange/5 border-brand-orange/20 hover:bg-brand-orange/10"
                    : isWatched
                        ? "bg-zinc-950/20 border-white/[0.03] hover:border-white/10 opacity-60 hover:opacity-100"
                        : "bg-zinc-950/30 border-white/[0.04] hover:border-white/10 hover:bg-zinc-900/30",
                !hasFile && "opacity-40 pointer-events-none"
            )}
            onClick={() => {
                if (localFile && onPlay) onPlay(localFile, episode)
            }}
        >
            {/* Thumbnail / Status Icon */}
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative bg-zinc-900 border border-white/5">
                {thumb ? (
                    <DeferredImage
                        src={getHighResImage(thumb)}
                        alt={`Ep ${epNum}`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Play size={14} />
                    </div>
                )}
                {/* Watched badge */}
                {isWatched && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Check size={14} className="text-emerald-400" />
                    </div>
                )}
                {!hasFile && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Lock size={12} className="text-zinc-600" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[10px] font-black tracking-[0.2em] uppercase shrink-0",
                        isResumeTarget ? "text-brand-orange" : "text-zinc-600"
                    )}>
                        EP {epNum}
                    </span>
                    {isResumeTarget && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-brand-orange/70 bg-brand-orange/10 px-1.5 py-0.5 rounded">
                            CONTINUAR
                        </span>
                    )}
                </div>
                <span className="text-[12px] font-bold text-white/80 truncate leading-none">
                    {episode.episodeTitle || episode.displayTitle || `Episodio ${epNum}`}
                </span>
                {/* Progress bar for resume target */}
                {epProgress !== null && (
                    <div className="w-full h-[2px] bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="h-full bg-brand-orange rounded-full"
                            style={{ width: `${epProgress}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Play arrow */}
            <div className={cn(
                "shrink-0 transition-all duration-200",
                hasFile
                    ? "opacity-0 group-hover:opacity-100 text-brand-orange translate-x-1 group-hover:translate-x-0"
                    : "opacity-30 text-zinc-600"
            )}>
                <Play size={14} fill="currentColor" />
            </div>
        </div>
    )
})
EpisodeRow.displayName = "EpisodeRow"

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function SeriesQuickPanel({
    seriesId,
    open,
    onClose,
    onNavigate,
    onPlay,
}: SeriesQuickPanelProps) {
    const id = seriesId ? String(seriesId) : null

    const { data: entry, isLoading } = useGetAnimeEntry(open ? id : null)
    const { data: continuityData } = useGetContinuityWatchHistoryItem(open && id ? Number(id) : null)

    const scrollRef = React.useRef<HTMLDivElement>(null)

    // Lock body scroll while open
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => { document.body.style.overflow = "" }
    }, [open])

    // Scroll to top when switching series
    React.useEffect(() => {
        if (open && scrollRef.current) scrollRef.current.scrollTop = 0
    }, [seriesId, open])

    const sagas = React.useMemo(() =>
        entry?.media ? resolveSeriesSagas(entry.media) : [],
        [entry]
    )

    // Compute episodes the same way as the detail page
    const episodes = React.useMemo<Anime_Episode[]>(() => {
        if (!entry) return []
        if (entry.episodes && entry.episodes.length > 0) {
            return entry.episodes.filter(ep => ep && typeof ep.episodeNumber === "number")
        }
        if (entry.localFiles && entry.localFiles.length > 0) {
            const epMap = new Map<number, Anime_Episode>()
            entry.localFiles.forEach(lf => {
                const parsedEp = lf.parsedInfo?.episode || lf.metadata?.episode
                const epNum = Number(parsedEp)
                if (!epNum || isNaN(epNum)) return
                if (!epMap.has(epNum)) {
                    epMap.set(epNum, {
                        episodeNumber: epNum,
                        absoluteEpisodeNumber: epNum,
                        episodeTitle: lf.name,
                        displayTitle: lf.name,
                        watched: false,
                        type: "main",
                        progressNumber: epNum,
                        isDownloaded: true,
                        isInvalid: false,
                        episodeMetadata: { episodeNumber: epNum, image: entry.media?.posterImage || "" }
                    } as unknown as Anime_Episode)
                }
            })
            return Array.from(epMap.values()).sort((a, b) => a.episodeNumber - b.episodeNumber)
        }
        return []
    }, [entry])

    const getLocalFile = React.useCallback((ep: Anime_Episode): Anime_LocalFile | undefined => {
        if (ep.localFile) return ep.localFile
        return entry?.localFiles?.find(lf => {
            const lfEp = lf.metadata?.episode || lf.parsedInfo?.episode
            if (lfEp == null) return false
            return Number(lfEp) === ep.episodeNumber
        })
    }, [entry])

    // Find resume target
    const resumeEpNumber = continuityData?.item?.episodeNumber

    const media = entry?.media
    const title = media?.titleSpanish || media?.titleRomaji || media?.titleEnglish || "Sin título"
    const backdrop = getHighResImage(media?.bannerImage || media?.posterImage || "")
    const score = media?.score ? (media.score > 10 ? media.score / 10 : media.score).toFixed(1) : null
    const genres = parseGenres(media?.genres).slice(0, 3)
    const totalEps = media?.totalEpisodes || episodes.length
    const watchedEps = episodes.filter(e => e.watched).length

    const handlePlayEpisode = React.useCallback((lf: Anime_LocalFile, ep: Anime_Episode) => {
        onClose()
        onPlay?.(String(seriesId))
    }, [onClose, onPlay, seriesId])

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop Scrim */}
                    <motion.div
                        key="scrim"
                        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.aside
                        key="panel"
                        className="fixed bottom-0 left-0 right-0 z-[75] flex justify-center pointer-events-none"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 380, damping: 40, mass: 0.9 }}
                    >
                        <div
                            className={cn(
                                "pointer-events-auto w-full max-w-[860px] mx-auto",
                                "bg-[#0b0c11]/95 backdrop-blur-2xl",
                                "border border-white/[0.07] border-b-0 rounded-t-3xl shadow-[0_-20px_80px_rgba(0,0,0,0.85)]",
                                "flex flex-col overflow-hidden",
                                "max-h-[88vh]"
                            )}
                        >
                            {/* Drag Handle */}
                            <div
                                className="flex items-center justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
                                onClick={onClose}
                            >
                                <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                            </div>

                            {/* Scrollable Content */}
                            <div ref={scrollRef} className="flex flex-col overflow-y-auto no-scrollbar">

                                {isLoading ? (
                                    <PanelSkeleton />
                                ) : !entry || !media ? (
                                    <div className="flex items-center justify-center h-64 text-zinc-600 text-sm font-bold">
                                        Sin datos disponibles
                                    </div>
                                ) : (
                                    <>
                                        {/* ── Hero ── */}
                                        <div className="relative h-[220px] shrink-0 overflow-hidden">
                                            {/* Backdrop */}
                                            {backdrop && (
                                                <DeferredImage
                                                    src={backdrop}
                                                    alt={title}
                                                    className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c11] via-[#0b0c11]/40 to-transparent" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c11]/70 via-transparent to-transparent" />

                                            {/* Close Button */}
                                            <button
                                                onClick={onClose}
                                                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-black/80 transition-all"
                                            >
                                                <X size={16} />
                                            </button>

                                            {/* Hero Content */}
                                            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end gap-4">
                                                {/* Poster Thumbnail */}
                                                {media.posterImage && (
                                                    <div className="w-[70px] h-[100px] rounded-xl overflow-hidden border border-white/10 shadow-lg shrink-0 hidden sm:block">
                                                        <DeferredImage
                                                            src={getHighResImage(media.posterImage)}
                                                            alt={title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    {/* Genres */}
                                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                                        {genres.map(g => (
                                                            <span key={g} className="text-[8px] font-black uppercase tracking-widest text-brand-orange bg-brand-orange/10 border border-brand-orange/20 px-2 py-0.5 rounded">
                                                                {g}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Title */}
                                                    <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-bebas tracking-wide leading-none text-white uppercase line-clamp-1">
                                                        {title}
                                                    </h2>

                                                    {/* Meta strip */}
                                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                        {score && (
                                                            <div className="flex items-center gap-1 text-[10px] font-black text-amber-400">
                                                                <Star size={10} fill="currentColor" />
                                                                {score}
                                                            </div>
                                                        )}
                                                        {media.year && (
                                                            <span className="text-[10px] font-black text-zinc-400">{media.year}</span>
                                                        )}
                                                        <span className="text-[10px] font-black text-zinc-500">
                                                            {watchedEps}/{totalEps} eps
                                                        </span>

                                                        {/* Progress pill */}
                                                        {totalEps > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-brand-orange rounded-full transition-all duration-500"
                                                                        style={{ width: `${(watchedEps / totalEps) * 100}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[9px] text-zinc-600 font-bold">
                                                                    {Math.round((watchedEps / totalEps) * 100)}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Description ── */}
                                        {media.description && (
                                            <p className="text-xs text-zinc-400 leading-relaxed px-5 pt-4 pb-0 line-clamp-3 font-medium">
                                                {media.description.replace(/<[^>]*>/g, "")}
                                            </p>
                                        )}

                                        {/* ── CTA Buttons ── */}
                                        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                                            <button
                                                onClick={() => {
                                                    onClose()
                                                    onPlay?.(String(seriesId))
                                                }}
                                                className="flex items-center gap-2 bg-brand-orange text-white font-black text-[10px] uppercase tracking-[0.2em] px-5 py-2.5 rounded-full hover:bg-orange-500 hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_4px_20px_rgba(255,107,0,0.35)]"
                                            >
                                                <Play size={12} fill="currentColor" />
                                                Reproducir
                                            </button>

                                            <button
                                                onClick={() => {
                                                    onClose()
                                                    onNavigate(String(seriesId))
                                                }}
                                                className="flex items-center gap-2 border border-white/10 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-800/80 hover:border-white/20 font-black text-[10px] uppercase tracking-[0.2em] px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                                            >
                                                Ver Detalle
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>

                                        {/* ── Episode List ── */}
                                        {episodes.length > 0 && (
                                            <div className="flex flex-col gap-1 px-5 pt-3 pb-8">
                                                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-white/[0.04]">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
                                                        Episodios
                                                    </h3>
                                                    <span className="text-[9px] font-bold text-zinc-700">{episodes.length} disponibles</span>
                                                </div>

                                                {episodes.slice(0, 30).map(ep => {
                                                    const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                                                    const lf = getLocalFile(ep)
                                                    const isResume = epNum === resumeEpNumber
                                                    return (
                                                        <EpisodeRow
                                                            key={epNum}
                                                            episode={ep}
                                                            localFile={lf}
                                                            isResumeTarget={isResume}
                                                            onPlay={handlePlayEpisode}
                                                            continuityProgress={
                                                                isResume && continuityData?.item?.duration
                                                                    ? Math.round((continuityData.item.currentTime / continuityData.item.duration) * 100)
                                                                    : undefined
                                                            }
                                                        />
                                                    )
                                                })}

                                                {episodes.length > 30 && (
                                                    <button
                                                        onClick={() => {
                                                            onClose()
                                                            onNavigate(String(seriesId))
                                                        }}
                                                        className="mt-2 text-[10px] font-black text-zinc-500 hover:text-brand-orange uppercase tracking-[0.2em] transition-colors self-center flex items-center gap-1.5"
                                                    >
                                                        Ver todos los {episodes.length} episodios
                                                        <ChevronRight size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
