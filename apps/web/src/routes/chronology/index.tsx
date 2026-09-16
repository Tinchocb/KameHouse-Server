import { createFileRoute, Link } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconTimeClock, IconNavigationChevronLeft, IconMediaPause, IconMediaPlay, IconNavigationChevronRight, IconUiLock, IconStatusSparkles, IconStatusRadar, IconMediaClapperboard, IconUiEye, IconUiEyeOff } from "@/components/ui/icons";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { DRAGON_BALL_STORY_SPANS, type StorySpan } from "@/lib/config/dragonball_story_spans"
import { getMoviesForSpan, getGokuAgeForSpan } from "@/lib/config/dragonball_chronology_enrichment"
import type { StageCollectionEntry } from "@/lib/config/dragonball_stages"
import {
    getSpanProgress,
    type SpanProgress,
    type SpanStill,
} from "@/components/chronology/CinematicChronologyTimeline"
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"
import { DeferredImage } from "@/components/shared/deferred-image"
import { ERA_ORDER, SERIES_LABEL, ERA_BACKDROP, getSeriesAccent } from "@/lib/chronology/design"
import { useChronologyData } from "./-data"

export const Route = createFileRoute("/chronology/")({
    component: ChronologyPage,
    errorComponent: AppErrorBoundary,
})

interface PageItem {
    span: StorySpan
    entry: StageCollectionEntry | undefined
    progress: SpanProgress
    art: SpanStill
    backdrop: string
    globalIdx: number
    accent: string
}

function Scrubber({
    items,
    selectedId,
    currentId,
    unlockedIdx,
    showSpoilers,
    autoPlaying,
    onSelect,
    onPrev,
    onNext,
    onToggleAuto,
}: {
    items: PageItem[]
    selectedId: string
    currentId: string | null
    unlockedIdx: number
    showSpoilers: boolean
    autoPlaying: boolean
    onSelect: (id: string) => void
    onPrev: () => void
    onNext: () => void
    onToggleAuto: () => void
}) {
    const reduceMotion = useReducedMotion()
    const selectedIdx = items.findIndex((i) => i.span.id === selectedId)
    const pct = items.length > 1 ? (selectedIdx / (items.length - 1)) * 100 : 0
    const scrollRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const dragging = useRef(false)
    const startX = useRef(0)
    const startScrollLeft = useRef(0)

    useEffect(() => {
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-span-id="${selectedId}"]`)
        el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" })
    }, [selectedId, reduceMotion])

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        const c = scrollRef.current
        if (!c) return
        dragging.current = true
        startX.current = e.clientX
        startScrollLeft.current = c.scrollLeft
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return
        const c = scrollRef.current
        if (!c) return
        const dx = e.clientX - startX.current
        c.scrollLeft = startScrollLeft.current - dx
    }, [])

    const onPointerUp = useCallback(() => {
        dragging.current = false
    }, [])

    const onTrackClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const r = trackRef.current?.getBoundingClientRect()
            if (!r) return
            const x = e.clientX - r.left
            const ratio = Math.max(0, Math.min(1, x / r.width))
            const rawIdx = Math.round(ratio * (items.length - 1))
            const maxAllowed = showSpoilers ? items.length - 1 : unlockedIdx
            const idx = Math.max(0, Math.min(rawIdx, maxAllowed))
            onSelect(items[idx].span.id)
        },
        [items, onSelect, showSpoilers, unlockedIdx]
    )
    return (
        <div className="sectionbar-strong overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent shrink-0">
                        <IconTimeClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-white font-mono">Línea temporal</p>
                        <p className="text-[11px] font-medium text-on-surface-variant truncate">Año 749 · Montaña Paoz — Año 784+ · Torneo Final</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onPrev}
                        aria-label="Arco anterior"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/60 border border-white/15 text-on-surface hover:bg-white/10 hover:text-white active:scale-95 transition-colors cursor-pointer"
                    >
                        <IconNavigationChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onToggleAuto}
                        className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-colors min-h-[36px]",
                            autoPlaying ? "bg-brand-accent text-zinc-950 border-brand-accent shadow-[0_4px_18px_rgba(245,158,11,0.35)]" : "bg-zinc-950/60 text-zinc-200 border-white/15 hover:bg-white/10"
                        )}
                    >
                        {autoPlaying ? <IconMediaPause className="h-3.5 w-3.5 fill-current" /> : <IconMediaPlay className="h-3.5 w-3.5 fill-current" />}
                        {autoPlaying ? "Pausar" : "Auto-play"}
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        aria-label="Arco siguiente"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/60 border border-white/15 text-on-surface hover:bg-white/10 hover:text-white active:scale-95 transition-colors cursor-pointer"
                    >
                        <IconNavigationChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 pt-5 pb-3">
                <div className="relative">
                    <div
                        ref={trackRef}
                        onClick={onTrackClick}
                        role="slider"
                        aria-valuemin={0}
                        aria-valuemax={items.length - 1}
                        aria-valuenow={selectedIdx}
                        aria-label="Línea temporal por arco"
                        className="absolute left-0 right-0 top-[18px] h-2 rounded-full bg-white/[0.06] border border-white/5 overflow-hidden cursor-pointer touch-manipulation"
                    >
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${items[selectedIdx]?.accent ?? "#f59e0b"}, #fff)` }}
                            animate={{ width: `${pct}%` }}
                            transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 30 }}
                        />
                    </div>
                    {autoPlaying && (
                        <div className="absolute left-0 right-0 top-[18px] h-2 rounded-full overflow-hidden pointer-events-none">
                            <motion.div
                                key={selectedId}
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 6, ease: "linear" }}
                                className="h-full bg-white/30"
                            />
                        </div>
                    )}
                    <div
                        ref={scrollRef}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                        className="no-scrollbar relative flex items-start gap-1 overflow-x-auto pb-2 pt-1 snap-x cursor-grab active:cursor-grabbing select-none touch-pan-x"
                    >
                        {items.map((it, idx) => {
                            const isSelected = it.span.id === selectedId
                            const isLocked = !showSpoilers && idx > unlockedIdx
                            const isCurrent = it.span.id === currentId
                            return (
                                <button
                                    key={it.span.id}
                                    data-span-id={it.span.id}
                                    type="button"
                                    onClick={() => !isLocked && onSelect(it.span.id)}
                                    disabled={isLocked}
                                    aria-pressed={isSelected}
                                    aria-label={`${it.span.sagaName}: ${it.span.title} · ${it.span.inUniverseYears}`}
                                    className={cn("group flex flex-col items-center gap-2 min-w-[72px] sm:min-w-[84px] snap-start cursor-pointer disabled:cursor-not-allowed min-h-[44px] py-1", isLocked && "opacity-45")}
                                >
                                    <span className="relative flex flex-col items-center">
                                        <span
                                            className={cn(
                                                "flex h-[36px] w-[36px] items-center justify-center rounded-full border-2 bg-zinc-950 transition-all",
                                                isSelected ? "scale-110 shadow-[0_0_18px_rgba(255,255,255,0.35)]" : "group-hover:scale-105"
                                            )}
                                            style={{
                                                borderColor: isSelected ? it.accent : "rgba(255,255,255,0.18)",
                                                backgroundColor: isSelected ? `color-mix(in srgb, ${it.accent} 18%, #09090b)` : "rgba(9,9,11,0.9)",
                                                color: isSelected ? it.accent : "rgba(255,255,255,0.7)",
                                            }}
                                        >
                                            {isLocked ? <IconUiLock className="h-3.5 w-3.5" /> : isSelected ? <IconStatusSparkles className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.accent }} />}
                                            {isCurrent && !isSelected && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full animate-ping opacity-60" style={{ backgroundColor: it.accent }} />}
                                        </span>
                                        {isSelected && <span className="absolute -bottom-1 h-1 w-1 rounded-full" style={{ backgroundColor: it.accent }} aria-hidden />}
                                    </span>
                                    <span className="flex flex-col items-center max-w-[84px]">
                                        <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider truncate w-full text-center", isSelected ? "text-white" : "text-zinc-400")}>{it.span.inUniverseYears.replace("Año ", "")}</span>
                                        <span className={cn("text-[11px] font-semibold leading-tight line-clamp-2 text-center text-balance", isSelected ? "text-white" : "text-zinc-500")}>{it.span.sagaName.replace("Saga del ", "").replace("Saga de ", "")}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-zinc-500">{items[0]?.span.inUniverseYears}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 tabular-nums">
                        {selectedIdx + 1} / {items.length} · {items[selectedIdx]?.span.inUniverseYears}
                    </span>
                    <span className="text-zinc-500">{items[items.length - 1]?.span.inUniverseYears}</span>
                </div>
            </div>
        </div>
    )
}

function StoryCanvas({
    item,
    progress,
    accent,
    movies,
    mediaId,
    isCurrent,
    tmdbMap,
}: {
    item: PageItem
    progress: SpanProgress
    accent: string
    movies: ReturnType<typeof getMoviesForSpan>
    mediaId?: number
    isCurrent: boolean
    tmdbMap: Map<number, StageCollectionEntry>
}) {
    const reduceMotion = useReducedMotion()
    const gokuAge = getGokuAgeForSpan(item.span.id)
    const threat = item.span.worldStateAtStart?.threatLevel ?? "—"
    const balls = item.span.worldStateAtStart?.dragonBallsStatus ?? "—"
    const villains = item.span.worldStateAtStart?.activeVillains ?? []
    const charStatus = item.span.worldStateAtStart?.characterStatus
    const targetEp = progress.isStarted && !progress.isComplete ? item.span.startEpisode + progress.watched : item.span.recommendedStartEpisode
    const ctaLabel = progress.isComplete ? "Rever" : progress.isStarted ? `Continuar EP ${targetEp}` : `Comenzar EP ${targetEp}`

    return (
        <motion.div
            key={item.span.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={reduceMotion ? { duration: 0.22 } : { type: "spring", stiffness: 280, damping: 28 }}
            className="sectionbar-strong overflow-hidden"
        >
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 scale-110 opacity-[0.18] blur-2xl">
                    <DeferredImage src={item.art.src} alt="" className="absolute inset-0" imgClassName="object-cover" fallback={<div />} />
                </div>
                <div className="absolute -top-[30%] left-[15%] h-[70%] w-[55%] rounded-full" style={{ background: `radial-gradient(ellipse, color-mix(in srgb, ${accent} 38%, transparent) 0%, transparent 70%)` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-zinc-950/15" />
            </div>

            <div className="relative grid gap-0 lg:grid-cols-[1.05fr_1.15fr]">
                <div className="relative aspect-video overflow-hidden lg:aspect-auto lg:min-h-[420px]">
                    <DeferredImage src={item.art.src} alt={item.span.title} className="absolute inset-0" imgClassName="object-cover" fallback={<div className="absolute inset-0 bg-zinc-900" />} />
                    <div className="scrim-hero-bottom pointer-events-none absolute inset-0" />
                    {mediaId ? (
                        <Link
                            to="/series/$seriesId"
                            params={{ seriesId: String(mediaId) }}
                            search={{ tab: "episodes", saga: item.span.sagaId, autoplay: String(targetEp) } as never}
                            aria-label={`${ctaLabel}: ${item.span.title}`}
                            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-on-primary shadow-brand-primary transition-transform hover:scale-105 active:scale-95"
                        >
                            <IconMediaPlay className="ml-0.5 h-6 w-6 fill-current" />
                        </Link>
                    ) : null}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                        <span className="badge badge-muted backdrop-blur-overlay-md tabular-nums">EP {item.span.startEpisode}–{item.span.endEpisode} · {progress.total} EP</span>
                        {isCurrent && <span className="badge backdrop-blur-overlay-md" style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`, color: accent }}>Arco actual</span>}
                    </div>
                </div>

                <div className="relative flex min-w-0 flex-col gap-4 p-5 sm:p-7">
                    <div>
                        <p className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant">{item.span.sagaName} · {item.span.inUniverseYears}</p>
                        <h2 className="text-edge-glow mt-1.5 font-display text-2xl font-black uppercase leading-tight tracking-wide text-white text-balance sm:text-3xl">{item.span.title}</h2>
                        <p className="mt-1.5 font-mono text-[11px] uppercase tabular-nums tracking-widest text-on-surface-variant">{item.span.dominantVibe}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {item.span.quickCatchUpKeys.slice(0, 3).map((k) => (
                            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold leading-tight text-zinc-200">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} aria-hidden />
                                {k}
                            </span>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm leading-relaxed text-on-surface-variant">{item.span.previouslyOn}</p>
                        <p className="text-[13px] font-medium leading-relaxed text-zinc-100/90 line-clamp-4 sm:line-clamp-none">{item.span.detailedPlot}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-950/45 backdrop-blur-overlay-md p-3.5 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] border border-white/10 text-zinc-300">
                                <IconStatusRadar className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Scouter del mundo</p>
                            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border" style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`, color: accent }}>{threat}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Goku</p>
                                <p className="mt-1 font-semibold text-white leading-tight">{gokuAge.physical}</p>
                                <p className="text-[11px] text-zinc-400 line-clamp-2">{gokuAge.notes ?? charStatus?.goku ?? "—"}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Esferas</p>
                                <p className="mt-1 font-medium leading-snug text-zinc-200 line-clamp-3">{balls}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Villanos activos</p>
                                <p className="mt-1 font-medium text-zinc-200">{villains.slice(0, 3).join(" · ") || "—"}</p>
                                {charStatus && (
                                    <p className="mt-1 text-[11px] text-zinc-400 truncate">Aliados: {charStatus.allies ?? "—"} · Vegeta: {charStatus.vegeta} · Gohan: {charStatus.gohan}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <WatchProgressBar percent={progress.percent} variant="compact" color={accent} className="flex-1" />
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">{progress.watched}/{progress.total} · {progress.percent}%</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {mediaId ? (
                            <Link
                                to="/series/$seriesId"
                                params={{ seriesId: String(mediaId) }}
                                search={{ tab: "episodes", saga: item.span.sagaId, autoplay: String(targetEp) } as never}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-accent text-zinc-950 text-xs font-black uppercase tracking-wider shadow-brand-primary hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
                            >
                                <IconMediaPlay className="h-3.5 w-3.5 fill-current" />
                                {ctaLabel}
                            </Link>
                        ) : (
                            <span className="badge badge-muted min-h-[44px] !py-2"><IconMediaPlay className="h-3 w-3" /> No en biblioteca</span>
                        )}
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500"><IconTimeClock className="h-3 w-3" /> Usa ← → para viajar</span>
                    </div>
                </div>
            </div>

            <div className="relative border-t border-white/10 p-4 sm:p-6 space-y-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2.5">Hitos cinemáticos · salto directo al player</p>
                    {item.span.milestones.length === 0 ? (
                        <p className="text-sm text-on-surface-variant">Sin hitos registrados.</p>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {item.span.milestones.slice(0, 4).map((m) => (
                                <div key={m.episode} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 group hover:bg-white/[0.06] transition-colors">
                                    <span className="badge shrink-0 font-mono mt-0.5" style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`, color: accent }}>EP {m.episode}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold leading-tight text-white truncate">{m.title}</p>
                                        <p className="text-xs text-zinc-400 line-clamp-2">{m.description}</p>
                                    </div>
                                    {mediaId && (
                                        <Link
                                            to="/series/$seriesId"
                                            params={{ seriesId: String(mediaId) }}
                                            search={{ tab: "episodes", saga: item.span.sagaId, autoplay: String(m.episode) } as never}
                                            aria-label={`Ver EP ${m.episode}: ${m.title}`}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-100 active:scale-95 transition-transform"
                                        >
                                            <IconMediaPlay className="ml-0.5 h-3.5 w-3.5 fill-current" />
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] border border-white/10 text-zinc-300"><IconMediaClapperboard className="h-3.5 w-3.5" /></span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Películas en este lapso</p>
                        <span className="ml-auto text-[11px] font-mono text-zinc-500">{movies.length ? `${movies.length} título(s)` : "—"}</span>
                    </div>
                    {movies.length === 0 ? (
                        <p className="text-xs text-zinc-500">Sin películas vinculadas cronológicamente a este arco.</p>
                    ) : (
                        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                            {movies.map((m) => {
                                const movieMediaId = m.tmdbId ? tmdbMap.get(m.tmdbId)?.mediaId : undefined
                                return (
                                    <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 min-w-[220px] shrink-0">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, color: accent }}>
                                            <IconMediaClapperboard className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[12px] font-semibold text-white">{m.title}</p>
                                            <p className="truncate text-[11px] text-zinc-400">{movieMediaId ? "Disponible" : "No disponible"} · {m.canonStatus}</p>
                                        </div>
                                        {movieMediaId && (
                                            <Link to="/series/$seriesId" params={{ seriesId: String(movieMediaId) }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-100 active:scale-95 transition-all">
                                                <IconMediaPlay className="ml-0.5 h-3.5 w-3.5 fill-current" />
                                            </Link>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function LockedHero({
    span,
    accent,
    prevTitle,
    onGoCurrent,
}: {
    span: StorySpan
    accent: string
    prevTitle: string
    onGoCurrent: () => void
}) {
    return (
        <SectionBar label="Arco bloqueado" icon={IconUiLock} variant="strong">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-1">
                <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                        color: accent,
                    }}
                >
                    <IconUiLock className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                        {span.sagaName} · {span.inUniverseYears}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-wide text-white text-balance">{span.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                        Este relato está más allá de tu progreso. Completa <span className="font-bold text-white">{prevTitle}</span> para desbloquearlo — o activa Spoilers arriba.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onGoCurrent}
                    className="flex shrink-0 items-center gap-2 px-5 py-2.5 rounded-full bg-white/95 text-zinc-950 text-xs font-black uppercase tracking-wider cursor-pointer transition-transform hover:scale-[1.03] active:scale-95"
                >
                    <IconMediaPlay className="h-3.5 w-3.5 fill-current" />
                    Mi arco actual
                </button>
            </div>
        </SectionBar>
    )
}

function ChronologyPage() {
    const [eraSel, setEraSel] = useState<string>("all")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showSpoilers, setShowSpoilers] = useState(false)
    const [autoPlaying, setAutoPlaying] = useState(false)
    const reduceMotion = useReducedMotion()
    const containerRef = useRef<HTMLDivElement>(null)

    const { tmdbMap, stills } = useChronologyData()

    const items = useMemo<PageItem[]>(() => {
        return DRAGON_BALL_STORY_SPANS.map((span, idx) => {
            const entry = tmdbMap.get(span.tmdbId)
            const backdrop = ERA_BACKDROP[span.seriesId] ?? "/backdrops/dbz.jpg"
            const still = stills.get(span.id)
            const art: SpanStill = still ?? {
                src: backdrop,
                isEpisode: false,
                downloaded: !!entry?.mediaId,
            }
            return {
                span,
                entry,
                progress: getSpanProgress(entry, span),
                art,
                backdrop,
                globalIdx: idx + 1,
                accent: getSeriesAccent(span.seriesId),
            }
        })
    }, [tmdbMap, stills])

    const byId = useMemo(() => new Map(items.map((i) => [i.span.id, i])), [items])

    const presentEras = useMemo(() => {
        const ids = new Set(items.map((i) => i.span.seriesId))
        return ERA_ORDER.filter((id) => ids.has(id)).map((id) => ({ id, label: SERIES_LABEL[id] ?? id }))
    }, [items])

    const currentId = useMemo(() => {
        return (
            items.find((i) => i.progress.isStarted && !i.progress.isComplete)?.span.id ??
            items.find((i) => !i.progress.isComplete)?.span.id ??
            items[0]?.span.id ??
            null
        )
    }, [items])

    const unlockedIdx = useMemo(() => {
        let idx = 0
        items.forEach((it, i) => {
            if (it.progress.isStarted) idx = i
        })
        return idx
    }, [items])

    const selectedItem =
        (selectedId ? byId.get(selectedId) : undefined) ??
        (currentId ? byId.get(currentId) : undefined) ??
        items[0]

    const selectedMovies = useMemo(() => (selectedItem ? getMoviesForSpan(selectedItem.span) : []), [selectedItem])
    const selectedMediaId = selectedItem ? tmdbMap.get(selectedItem.span.tmdbId)?.mediaId : undefined
    const selectedIdx = selectedItem ? items.findIndex((i) => i.span.id === selectedItem.span.id) : -1
    const isSelectedLocked = !showSpoilers && selectedIdx > unlockedIdx

    const totals = useMemo(() => {
        const watched = items.reduce((a, i) => a + i.progress.watched, 0)
        const total = items.reduce((a, i) => a + i.progress.total, 0)
        return { watched, total, percent: total > 0 ? Math.round((watched / total) * 100) : 0 }
    }, [items])

    const rails = useMemo(() => {
        const list = eraSel === "all" ? presentEras.map((e) => e.id) : [eraSel]
        return list
            .map((seriesId) => {
                const eraItems = items.filter((i) => i.span.seriesId === seriesId)
                if (eraItems.length === 0) return null
                const watchedEps = eraItems.reduce((a, i) => a + i.progress.watched, 0)
                const totalEps = eraItems.reduce((a, i) => a + i.progress.total, 0)
                const percent = totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0
                return { seriesId, eraItems, watchedEps, totalEps, percent, accent: getSeriesAccent(seriesId) }
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
    }, [items, eraSel, presentEras])

    const goTo = useCallback(
        (delta: number) => {
            if (!selectedItem) return
            const idx = items.findIndex((i) => i.span.id === selectedItem.span.id)
            const next = Math.max(0, Math.min(items.length - 1, idx + delta))
            if (!showSpoilers && next > unlockedIdx) return
            setSelectedId(items[next].span.id)
        },
        [items, selectedItem, showSpoilers, unlockedIdx]
    )

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault()
                goTo(-1)
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                goTo(1)
            } else if (e.code === "Space") {
                const tag = (document.activeElement as HTMLElement | null)?.tagName
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return
                e.preventDefault()
                setAutoPlaying((v) => !v)
            }
        }
        el.addEventListener("keydown", onKey)
        return () => el.removeEventListener("keydown", onKey)
    }, [goTo])

    useEffect(() => {
        if (!autoPlaying || !selectedItem) return
        if (reduceMotion) return
        const nextIdx = items.findIndex((i) => i.span.id === selectedItem.span.id) + 1
        if (nextIdx >= items.length) {
            setAutoPlaying(false)
            return
        }
        if (!showSpoilers && nextIdx > unlockedIdx) {
            setAutoPlaying(false)
            return
        }
        const t = window.setTimeout(() => setSelectedId(items[nextIdx].span.id), 6000)
        return () => window.clearTimeout(t)
    }, [autoPlaying, selectedItem, items, showSpoilers, unlockedIdx, reduceMotion])

    return (
        <div ref={containerRef} tabIndex={-1} className="min-h-screen text-on-surface overflow-x-hidden selection:bg-brand-accent/30 relative z-10 bg-transparent outline-none">
            <div className="page-container space-y-6 pt-6 pb-16">
                <SectionBar
                    label="Modo Historia"
                    icon={IconTimeClock}
                    variant="minimal"
                    badge={
                        <span className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
                                {totals.watched}/{totals.total} EP · {totals.percent}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowSpoilers((v) => !v)}
                                aria-pressed={showSpoilers}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border cursor-pointer transition-colors",
                                    showSpoilers ? "bg-brand-accent/15 text-brand-accent border-brand-accent/30" : "bg-[var(--glass-bg)] text-on-surface-variant border-[var(--glass-border-side)] hover:text-on-surface"
                                )}
                            >
                                {showSpoilers ? <IconUiEye className="w-3 h-3" /> : <IconUiEyeOff className="w-3 h-3" />}
                                <span className="hidden sm:inline">{showSpoilers ? "Spoilers" : "Sin spoilers"}</span>
                            </button>
                        </span>
                    }
                >
                    <div
                        className="sectionbar-minimal flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5"
                        role="tablist"
                        aria-label="Filtrar por era"
                    >
                        {[{ id: "all", label: "Todas" }, ...presentEras].map((era) => {
                            const isSelected = eraSel === era.id
                            return (
                                <button
                                    key={era.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    onClick={() => setEraSel(era.id)}
                                    className={cn(
                                        "relative min-h-[44px] shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors",
                                        isSelected ? "text-zinc-950" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                                    )}
                                >
                                    {isSelected && (
                                        <motion.span
                                            layoutId="chrono-page-era-pill"
                                            transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 480, damping: 34 }}
                                            className="absolute inset-0 rounded-full bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]"
                                            aria-hidden
                                        />
                                    )}
                                    <span className="relative z-10">{era.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </SectionBar>

                <Scrubber
                    items={items}
                    selectedId={selectedItem?.span.id ?? items[0].span.id}
                    currentId={currentId}
                    unlockedIdx={unlockedIdx}
                    showSpoilers={showSpoilers}
                    autoPlaying={autoPlaying}
                    onSelect={setSelectedId}
                    onPrev={() => goTo(-1)}
                    onNext={() => goTo(1)}
                    onToggleAuto={() => setAutoPlaying((v) => !v)}
                />

                <AnimatePresence mode="wait">
                    {selectedItem &&
                        (isSelectedLocked ? (
                            <LockedHero
                                key={`locked-${selectedItem.span.id}`}
                                span={selectedItem.span}
                                accent={selectedItem.accent}
                                prevTitle={items[unlockedIdx]?.span.title ?? "el arco anterior"}
                                onGoCurrent={() => {
                                    if (currentId) setSelectedId(currentId)
                                }}
                            />
                        ) : (
                            <StoryCanvas
                                key={selectedItem.span.id}
                                item={selectedItem}
                                progress={selectedItem.progress}
                                accent={selectedItem.accent}
                                movies={selectedMovies}
                                mediaId={selectedMediaId}
                                isCurrent={selectedItem.span.id === currentId}
                                tmdbMap={tmdbMap}
                            />
                        ))}
                </AnimatePresence>

                <div className="flex items-center justify-between gap-2 px-1">
                    <button
                        type="button"
                        onClick={() => goTo(-1)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white active:scale-95 transition-colors cursor-pointer"
                    >
                        <IconNavigationChevronLeft className="h-3.5 w-3.5" /> Anterior saga
                    </button>
                    <span className="hidden sm:inline text-[11px] font-mono text-zinc-500">
                        Tip: ← → navega · Espacio auto-play · {selectedIdx + 1} / {items.length}
                    </span>
                    <button
                        type="button"
                        onClick={() => goTo(1)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white active:scale-95 transition-colors cursor-pointer"
                    >
                        Siguiente saga <IconNavigationChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="space-y-7">
                    {rails.map((rail) => (
                        <section key={rail.seriesId} aria-label={SERIES_LABEL[rail.seriesId]}>
                            <div className="mb-3 flex items-center gap-2.5 px-1">
                                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: rail.accent }} />
                                <h3 className="font-mono text-xs font-black uppercase tracking-[0.2em] text-on-surface">{SERIES_LABEL[rail.seriesId]}</h3>
                                <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
                                    {rail.watchedEps}/{rail.totalEps} · {rail.percent}%
                                </span>
                                <span className="h-px flex-1 bg-white/10" aria-hidden />
                            </div>
                            <div className="no-scrollbar -mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
                                {rail.eraItems.map(({ span, progress, art, backdrop, globalIdx, accent }) => {
                                    const isSelected = selectedItem?.span.id === span.id
                                    const locked = !showSpoilers && globalIdx - 1 > unlockedIdx
                                    return (
                                        <div key={span.id} className="w-60 shrink-0 snap-start sm:w-64">
                                            <button
                                                type="button"
                                                onClick={() => !locked && setSelectedId(span.id)}
                                                disabled={locked}
                                                aria-pressed={isSelected}
                                                className={cn(
                                                    "group relative block aspect-video w-full overflow-hidden rounded-2xl border bg-zinc-950/60 text-left transition-all active:scale-[0.98] disabled:opacity-60",
                                                    isSelected ? "border-white/50" : "border-white/10 hover:border-white/30",
                                                    locked ? "cursor-not-allowed" : "cursor-pointer"
                                                )}
                                                style={isSelected ? { boxShadow: `0 0 24px color-mix(in srgb, ${accent} 30%, transparent)` } : undefined}
                                            >
                                                <span className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-[1.03]">
                                                    <DeferredImage src={art.src} alt={span.title} className="absolute inset-0" imgClassName="object-cover" fallback={<div className="absolute inset-0 bg-zinc-900" />} />
                                                </span>
                                                <span className="scrim-hero-bottom pointer-events-none absolute inset-0" aria-hidden />
                                                <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 border border-white/15 backdrop-blur">
                                                    <span className="font-mono text-[10px] font-black text-white">{progress.percent}%</span>
                                                </span>
                                                <span className="badge badge-muted absolute bottom-2 left-2 backdrop-blur-overlay-md tabular-nums">EP {span.startEpisode}–{span.endEpisode}</span>
                                                {locked && (
                                                    <span className="absolute inset-0 flex items-start justify-end p-2 bg-zinc-950/45 backdrop-blur-[1.5px] rounded-2xl">
                                                        <span className="badge backdrop-blur-overlay-md">
                                                            <IconUiLock className="h-3 w-3" /> Bloqueado
                                                        </span>
                                                    </span>
                                                )}
                                            </button>
                                            <button type="button" onClick={() => !locked && setSelectedId(span.id)} disabled={locked} className="mt-2 block w-full text-left disabled:cursor-not-allowed">
                                                <p className="truncate text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{span.sagaName}</p>
                                                <p className={cn("mt-0.5 text-sm font-semibold leading-snug line-clamp-2", isSelected ? "text-white" : "text-zinc-200")}>{span.title}</p>
                                                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-on-surface-variant">{progress.isComplete ? "Visto" : progress.isStarted ? `${progress.percent}% visto` : "Pendiente"}</p>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    )
}
