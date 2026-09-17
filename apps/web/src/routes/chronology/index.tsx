import { createFileRoute, Link } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import {
    IconTimeClock,
    IconNavigationChevronLeft,
    IconNavigationChevronRight,
    IconMediaPlay,
    IconMediaPause,
    IconUiLock,
    IconStatusSparkles,
    IconStatusZap,
    IconStatusSkull,
    IconStatusGem,
    IconStatusRadar,
    IconMediaClapperboard,
    IconUiEye,
    IconUiEyeOff,
    IconUiCheckCircle,
    IconTimeCalendar,
    IconBadgesChevronRight,
} from "@/components/ui/icons"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { DRAGON_BALL_STORY_SPANS, type StorySpan } from "@/lib/config/dragonball_story_spans"
import {
    getMoviesForSpan,
    getGokuAgeForSpan,
    getUniverseLoreForSpan,
} from "@/lib/config/dragonball_chronology_enrichment"
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

function shortSagaName(sagaName: string) {
    return sagaName.replace("Saga del ", "").replace("Saga de ", "").replace("Saga ", "")
}

function CanonPill({ span }: { span: StorySpan }) {
    if (span.seriesId === "gt") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/50 bg-zinc-800/50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <span aria-hidden className="text-sm leading-none">◇</span> Línea alternativa
            </span>
        )
    }
    if (span.hasFiller) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <span aria-hidden className="text-[10px] leading-none">◆</span> Relleno · {span.fillerEpisodes.length} EP
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-success/30 bg-brand-success/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-success">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-success" /> Canon
        </span>
    )
}

/* Índice temporal compacto: salta a cada capítulo con scroll */
function ChapterIndex({
    items,
    activeId,
    unlockedIdx,
    showSpoilers,
    autoPlaying,
    onJump,
    onToggleAuto,
    onGoCurrent,
}: {
    items: PageItem[]
    activeId: string | null
    unlockedIdx: number
    showSpoilers: boolean
    autoPlaying: boolean
    onJump: (id: string) => void
    onToggleAuto: () => void
    onGoCurrent: () => void
}) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const c = scrollRef.current
        if (!c || !activeId) return
        const el = c.querySelector<HTMLElement>(`[data-index-id="${activeId}"]`)
        if (!el) return
        c.scrollTo({ left: Math.max(0, el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2), behavior: "smooth" })
    }, [activeId])

    return (
        <div className="sectionbar-strong overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
                        <IconTimeClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-mono text-xs font-black uppercase tracking-widest text-white">Línea temporal</p>
                        <p className="truncate text-[11px] font-medium text-on-surface-variant">Año 749 · Montaña Paoz — Año 784+ · Torneo Final</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={onGoCurrent}
                        className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-zinc-950/60 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-zinc-200 transition-colors hover:bg-white/10 active:scale-95"
                    >
                        <IconStatusRadar className="h-3.5 w-3.5" />
                        Mi arco
                    </button>
                    <button
                        type="button"
                        onClick={onToggleAuto}
                        className={cn(
                            "flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-colors active:scale-95",
                            autoPlaying
                                ? "border-brand-accent bg-brand-accent text-zinc-950 shadow-[0_4px_18px_rgba(245,158,11,0.35)]"
                                : "border-white/15 bg-zinc-950/60 text-zinc-200 hover:bg-white/10"
                        )}
                    >
                        {autoPlaying ? <IconMediaPause className="h-3.5 w-3.5 fill-current" /> : <IconMediaPlay className="h-3.5 w-3.5 fill-current" />}
                        {autoPlaying ? "Pausar" : "Relato auto"}
                    </button>
                </div>
            </div>
            <div ref={scrollRef} className="no-scrollbar flex snap-x items-stretch gap-1 overflow-x-auto px-4 pb-3 pt-4 sm:px-6">
                {items.map((it) => {
                    const locked = !showSpoilers && it.globalIdx - 1 > unlockedIdx
                    const isActive = it.span.id === activeId
                    return (
                        <button
                            key={it.span.id}
                            data-index-id={it.span.id}
                            type="button"
                            disabled={locked}
                            onClick={() => onJump(it.span.id)}
                            aria-pressed={isActive}
                            aria-label={`Capítulo ${it.globalIdx}: ${it.span.sagaName} · ${it.span.inUniverseYears}`}
                            className={cn(
                                "group flex min-h-[64px] min-w-[96px] max-w-[112px] flex-1 snap-start flex-col items-center gap-1 rounded-2xl border px-2 py-2 transition-all active:scale-95",
                                isActive
                                    ? "border-white/50 bg-white/[0.07]"
                                    : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]",
                                locked ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                            )}
                            style={isActive ? { boxShadow: `0 0 20px color-mix(in srgb, ${it.accent} 25%, transparent)` } : undefined}
                        >
                            <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.accent }} aria-hidden />
                                <span className="font-mono text-[10px] font-black tabular-nums text-zinc-400">CAP {String(it.globalIdx).padStart(2, "0")}</span>
                            </span>
                            <span className={cn("font-mono text-[10px] font-bold uppercase tabular-nums tracking-wider", isActive ? "text-white" : "text-zinc-500")}>
                                {locked ? <IconUiLock className="mx-auto h-3 w-3" /> : it.span.inUniverseYears.replace("Año ", "")}
                            </span>
                            <span className={cn("line-clamp-2 text-center text-[11px] font-semibold leading-tight text-balance", isActive ? "text-white" : "text-zinc-400")}>
                                {locked ? "Bloqueado" : shortSagaName(it.span.sagaName)}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function LoreChips({ items, accent }: { items: string[]; accent: string }) {
    if (items.length === 0) return <p className="text-[11px] text-zinc-500">Sin registros de este arco.</p>
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((t, i) => (
                <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium leading-snug text-zinc-200"
                >
                    <span className="mr-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                    {t}
                </span>
            ))}
        </div>
    )
}

function LoreChapter({
    item,
    isEven,
    isActive,
    mediaId,
    movies,
    chapterRef,
}: {
    item: PageItem
    isEven: boolean
    isActive: boolean
    mediaId?: number
    movies: ReturnType<typeof getMoviesForSpan>
    chapterRef: (el: HTMLElement | null) => void
}) {
    const { span, progress, art, accent } = item
    const reduceMotion = useReducedMotion()
    const gokuAge = getGokuAgeForSpan(span.id)
    const lore = getUniverseLoreForSpan(span.id)
    const threat = span.worldStateAtStart?.threatLevel ?? span.dominantVibe ?? "—"
    const balls = span.worldStateAtStart?.dragonBallsStatus ?? "—"
    const villains = span.worldStateAtStart?.activeVillains ?? []
    const cs = span.worldStateAtStart?.characterStatus
    const targetEp = progress.isStarted && !progress.isComplete ? span.startEpisode + progress.watched : span.recommendedStartEpisode
    const ctaLabel = progress.isComplete ? "Rever saga" : progress.isStarted ? `Continuar EP ${targetEp}` : `Comenzar EP ${targetEp}`

    return (
        <article
            id={`cap-${span.id}`}
            data-span-id={span.id}
            ref={chapterRef}
            aria-label={`Capítulo ${item.globalIdx}: ${span.title}`}
            className="relative scroll-mt-36 pl-14 md:scroll-mt-32 md:pl-0 lg:scroll-mt-28"
        >
            {/* Nudo de la línea temporal */}
            <span aria-hidden className="absolute left-[17px] top-8 flex flex-col items-center md:left-1/2 md:top-10 md:-translate-x-1/2">
                <span
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 bg-zinc-950 font-mono text-xs font-black tabular-nums"
                    style={{
                        borderColor: isActive ? accent : progress.isComplete ? "hsl(var(--brand-success))" : "rgba(255,255,255,0.18)",
                        color: isActive ? accent : progress.isComplete ? "hsl(var(--brand-success))" : "#e4e4e7",
                        boxShadow: isActive ? `0 0 24px color-mix(in srgb, ${accent} 45%, transparent)` : undefined,
                    }}
                >
                    {progress.isComplete && !isActive ? <IconUiCheckCircle className="h-4 w-4" /> : String(item.globalIdx).padStart(2, "0")}
                </span>
                <span
                    className="mt-1.5 whitespace-nowrap rounded-full border border-white/10 bg-zinc-950/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tabular-nums tracking-wider text-zinc-300"
                >
                    {span.inUniverseYears}
                </span>
            </span>

            <div className={cn("md:grid md:grid-cols-2 md:gap-10", !isEven && "md:[&>*]:col-start-2")}>
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={reduceMotion ? { duration: 0.15 } : { duration: 0.45, ease: "easeOut" }}
                    className="sectionbar-strong overflow-hidden"
                    style={isActive ? { boxShadow: `0 0 32px color-mix(in srgb, ${accent} 18%, transparent)` } : undefined}
                >
                    {/* Portada del capítulo */}
                    <div className="relative aspect-[16/9] overflow-hidden">
                        <DeferredImage src={art.src} alt={span.title} className="absolute inset-0" imgClassName="object-cover" fallback={<div className="absolute inset-0 bg-zinc-900" />} />
                        <div className="scrim-hero-bottom pointer-events-none absolute inset-0" aria-hidden />
                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                            <span className="badge font-mono font-black uppercase tracking-[0.2em]" style={{ backgroundColor: `color-mix(in srgb, ${accent} 22%, rgba(0,0,0,0.6))`, borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`, color: "#fff" }}>
                                Cap {String(item.globalIdx).padStart(2, "0")} · {SERIES_LABEL[span.seriesId]}
                            </span>
                        </div>
                        {mediaId ? (
                            <Link
                                to="/series/$seriesId"
                                params={{ seriesId: String(mediaId) }}
                                search={{ tab: "episodes", saga: span.sagaId, autoplay: String(targetEp) } as never}
                                preload="intent"
                                aria-label={`${ctaLabel}: ${span.title}`}
                                className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-on-primary shadow-brand-primary transition-transform hover:scale-105 active:scale-95"
                            >
                                <IconMediaPlay className="ml-0.5 h-6 w-6 fill-current" />
                            </Link>
                        ) : null}
                        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                            <span className="badge badge-muted backdrop-blur-overlay-md tabular-nums">EP {span.startEpisode}–{span.endEpisode} · {progress.total} EP</span>
                            <span className="badge badge-subtle backdrop-blur-overlay-md tabular-nums">{progress.percent}% visto</span>
                        </div>
                    </div>
                    <div className="px-1 pt-2">
                        <WatchProgressBar percent={progress.percent} color={accent} variant="panel" />
                    </div>

                    <div className="space-y-5 p-5 sm:p-7">
                        {/* Cabecera narrativa */}
                        <div className="space-y-2.5">
                            <p className="font-mono text-[11px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                                {span.sagaName} · {span.inUniverseYears}
                            </p>
                            <h2 className="font-display text-2xl font-black uppercase leading-tight tracking-wide text-white text-balance sm:text-3xl">
                                {span.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <CanonPill span={span} />
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                                    <IconTimeCalendar className="h-3 w-3 text-brand-accent" />
                                    {threat}
                                </span>
                            </div>
                        </div>

                        {/* Voz del narrador */}
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                            <p className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-brand-accent">
                                <IconStatusSparkles className="h-3 w-3" /> La voz del narrador
                            </p>
                            <p className="border-l-2 pl-3 text-[13px] italic leading-relaxed text-zinc-400" style={{ borderColor: accent }}>
                                Anteriormente… {span.previouslyOn}
                            </p>
                            <p className="text-sm leading-relaxed text-zinc-200">{span.detailedPlot}</p>
                        </div>

                        {/* En 10 segundos */}
                        <div className="space-y-2">
                            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">Entiéndelo en 10 segundos</p>
                            <ul className="space-y-1.5">
                                {span.quickCatchUpKeys.slice(0, 3).map((k, i) => (
                                    <li key={i} className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[13px] font-medium leading-snug text-zinc-200">
                                        <IconBadgesChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" />
                                        {k}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Scouter del mundo */}
                        <div className="space-y-2">
                            <p className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                                <IconStatusRadar className="h-3 w-3 text-brand-accent" /> Scouter del mundo
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Goku · {gokuAge.physical}</p>
                                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">{gokuAge.notes ?? cs?.goku ?? "—"}</p>
                                </div>
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Esferas del dragón</p>
                                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">{balls}</p>
                                </div>
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 sm:col-span-2">
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Villanos activos</p>
                                    <p className="mt-1 text-xs font-bold leading-relaxed text-red-300">{villains.length > 0 ? villains.join(" · ") : "—"}</p>
                                </div>
                            </div>
                            {cs && (
                                <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    {[
                                        ["Goku", cs.goku],
                                        ["Vegeta", cs.vegeta],
                                        ["Gohan", cs.gohan],
                                        ["Piccolo", cs.piccolo],
                                        ["Aliados", cs.allies],
                                    ]
                                        .filter(([, v]) => !!v)
                                        .map(([k, v]) => (
                                            <p key={k} className="text-[12px] leading-relaxed text-zinc-300">
                                                <span className="mr-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-zinc-500">{k}</span>
                                                {v}
                                            </p>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Lore del universo */}
                        <div className="space-y-2">
                            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">Crónica del universo</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        <IconStatusSparkles className="h-3 w-3 text-emerald-300" /> Debuts ({lore.debuts.length})
                                    </p>
                                    <LoreChips items={lore.debuts} accent={accent} />
                                </div>
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        <IconStatusZap className="h-3 w-3 text-amber-300" /> Transformaciones ({lore.transformations.length})
                                    </p>
                                    <LoreChips items={lore.transformations} accent={accent} />
                                </div>
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        <IconStatusSkull className="h-3 w-3 text-red-300" /> Muertes ({lore.deaths.length})
                                    </p>
                                    <LoreChips items={lore.deaths} accent={accent} />
                                </div>
                                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        <IconStatusGem className="h-3 w-3 text-cyan-300" /> Deseos ({lore.wishes.length})
                                    </p>
                                    <LoreChips items={lore.wishes} accent={accent} />
                                </div>
                            </div>
                        </div>

                        {/* Hitos */}
                        {span.milestones.length > 0 && (
                            <div className="space-y-2">
                                <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                                    Momentos cumbre · {span.milestones.length}
                                </p>
                                <ol className="relative space-y-0 border-l border-white/10 pl-0">
                                    {span.milestones.map((ms, i) => (
                                        <li key={`${ms.episode}-${i}`} className="relative flex gap-3 py-2 pl-5">
                                            <span aria-hidden className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: accent }} />
                                            <div className="min-w-0 flex-1">
                                                <p className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-white/15 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-brand-accent">
                                                        EP {ms.episode}
                                                    </span>
                                                    <span className="truncate text-[13px] font-bold text-white">{ms.title}</span>
                                                </p>
                                                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{ms.description}</p>
                                            </div>
                                            {mediaId ? (
                                                <Link
                                                    to="/series/$seriesId"
                                                    params={{ seriesId: String(mediaId) }}
                                                    search={{ tab: "episodes", saga: span.sagaId, autoplay: String(ms.episode) } as never}
                                                    preload="intent"
                                                    aria-label={`Ver episodio ${ms.episode}: ${ms.title}`}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12] active:scale-95"
                                                >
                                                    <IconMediaPlay className="ml-0.5 h-4 w-4 fill-current" />
                                                </Link>
                                            ) : null}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Películas concurrentes */}
                        {movies.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                                    <IconMediaClapperboard className="h-3 w-3" /> Películas de esta época ({movies.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {movies.map((m) => (
                                        <Link
                                            key={m.id || m.title}
                                            to="/movies"
                                            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            {m.title}
                                            <span className="font-mono text-[10px] text-zinc-500">{m.canonStatus}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA */}
                        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                            {mediaId ? (
                                <Link
                                    to="/series/$seriesId"
                                    params={{ seriesId: String(mediaId) }}
                                    search={{ tab: "episodes", saga: span.sagaId, autoplay: String(targetEp) } as never}
                                    preload="intent"
                                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-brand-primary transition-transform hover:scale-[1.02] active:scale-95"
                                >
                                    <IconMediaPlay className="h-4 w-4 fill-current" />
                                    {ctaLabel}
                                </Link>
                            ) : (
                                <span className="badge badge-muted min-h-[44px] !py-2">No en biblioteca</span>
                            )}
                            {mediaId ? (
                                <Link
                                    to="/series/$seriesId"
                                    params={{ seriesId: String(mediaId) }}
                                    search={{ tab: "episodes", saga: span.sagaId } as never}
                                    preload="intent"
                                    className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/15"
                                >
                                    Ver saga completa
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </motion.div>
            </div>
        </article>
    )
}

function LockedChapter({
    item,
    prevTitle,
    onGoCurrent,
    chapterRef,
}: {
    item: PageItem
    prevTitle: string
    onGoCurrent: () => void
    chapterRef: (el: HTMLElement | null) => void
}) {
    const { span, accent } = item
    return (
        <article id={`cap-${span.id}`} data-span-id={span.id} ref={chapterRef} className="relative scroll-mt-36 pl-14 md:scroll-mt-32 md:pl-0">
            <span aria-hidden className="absolute left-[17px] top-8 flex flex-col items-center md:left-1/2 md:top-10 md:-translate-x-1/2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/15 bg-zinc-950 text-zinc-400">
                    <IconUiLock className="h-4 w-4" />
                </span>
                <span className="mt-1.5 whitespace-nowrap rounded-full border border-white/10 bg-zinc-950/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tabular-nums tracking-wider text-zinc-500">
                    ???
                </span>
            </span>
            <div className="md:grid md:grid-cols-2 md:gap-10">
                <div className="sectionbar-strong overflow-hidden">
                    <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
                        <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, color: accent }}
                        >
                            <IconUiLock className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="font-mono text-[11px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                                Capítulo {String(item.globalIdx).padStart(2, "0")} · Historia sellada
                            </p>
                            <h2 className="mt-1 font-display text-xl font-black uppercase leading-tight tracking-wide text-white text-balance">{span.sagaName}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                                Este capítulo está más allá de tu progreso. Completa <span className="font-bold text-white">{prevTitle}</span> para revelar el relato — o activa Spoilers arriba.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onGoCurrent}
                            className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 transition-transform hover:scale-[1.03] active:scale-95"
                        >
                            <IconMediaPlay className="h-3.5 w-3.5 fill-current" />
                            Mi arco actual
                        </button>
                    </div>
                </div>
            </div>
        </article>
    )
}

function ChronologyPage() {
    const [eraSel, setEraSel] = useState<string>("all")
    const [showSpoilers, setShowSpoilers] = useState(false)
    const [autoPlaying, setAutoPlaying] = useState(false)
    const [activeId, setActiveId] = useState<string | null>(null)
    const reduceMotion = useReducedMotion()
    const chapterEls = useRef(new Map<string, HTMLElement>())

    const { tmdbMap, stills } = useChronologyData()

    const bundle = useMemo(() => {
        const pageItems: PageItem[] = DRAGON_BALL_STORY_SPANS.map((span, idx) => {
            const entry = tmdbMap.get(span.tmdbId)
            const backdrop = ERA_BACKDROP[span.seriesId] ?? "/backdrops/dbz.webp"
            const still = stills.get(span.id)
            const art: SpanStill = still ?? { src: backdrop, isEpisode: false, downloaded: !!entry?.mediaId }
            return { span, entry, progress: getSpanProgress(entry, span), art, backdrop, globalIdx: idx + 1, accent: getSeriesAccent(span.seriesId) }
        })
        let watchedAccum = 0
        let totalAccum = 0
        let unlocked = 0
        const seriesIds = new Set<string>()
        pageItems.forEach((it, i) => {
            watchedAccum += it.progress.watched
            totalAccum += it.progress.total
            if (it.progress.isStarted) unlocked = i
            seriesIds.add(it.span.seriesId)
        })
        const eras = ERA_ORDER.filter((id) => seriesIds.has(id)).map((id) => ({ id, label: SERIES_LABEL[id] ?? id }))
        const currentSpanId =
            pageItems.find((i) => i.progress.isStarted && !i.progress.isComplete)?.span.id ??
            pageItems.find((i) => !i.progress.isComplete)?.span.id ??
            pageItems[0]?.span.id ??
            null
        return {
            items: pageItems,
            presentEras: eras,
            currentId: currentSpanId,
            unlockedIdx: unlocked,
            totals: { watched: watchedAccum, total: totalAccum, percent: totalAccum > 0 ? Math.round((watchedAccum / totalAccum) * 100) : 0 },
        }
    }, [tmdbMap, stills])

    const { items, presentEras, currentId, unlockedIdx, totals } = bundle
    const visibleItems = useMemo(() => (eraSel === "all" ? items : items.filter((i) => i.span.seriesId === eraSel)), [items, eraSel])
    const moviesById = useMemo(() => {
        const m = new Map<string, ReturnType<typeof getMoviesForSpan>>()
        for (const it of visibleItems) m.set(it.span.id, getMoviesForSpan(it.span))
        return m
    }, [visibleItems])
    const mediaById = useMemo(() => {
        const m = new Map<string, number | undefined>()
        for (const it of visibleItems) m.set(it.span.id, tmdbMap.get(it.span.tmdbId)?.mediaId)
        return m
    }, [visibleItems, tmdbMap])

    const scrollToId = useCallback(
        (id: string) => {
            const el = chapterEls.current.get(id)
            if (!el) return
            el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
            setActiveId(id)
        },
        [reduceMotion]
    )

    const goTo = useCallback(
        (delta: number) => {
            const anchor = activeId ?? currentId ?? visibleItems[0]?.span.id
            const idx = visibleItems.findIndex((i) => i.span.id === anchor)
            const next = Math.max(0, Math.min(visibleItems.length - 1, (idx < 0 ? 0 : idx) + delta))
            const target = visibleItems[next]
            if (!target) return
            if (!showSpoilers && target.globalIdx - 1 > unlockedIdx) return
            scrollToId(target.span.id)
        },
        [activeId, currentId, visibleItems, showSpoilers, unlockedIdx, scrollToId]
    )

    /* Scroll-spy: el capítulo visible manda en el índice */
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        const id = (e.target as HTMLElement).dataset.spanId
                        if (id) setActiveId(id)
                    }
                }
            },
            { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
        )
        chapterEls.current.forEach((el) => obs.observe(el))
        return () => obs.disconnect()
    }, [visibleItems.length, eraSel])

    /* Teclado: arriba/abajo navegan capítulos */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault()
                setAutoPlaying(false)
                goTo(1)
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault()
                setAutoPlaying(false)
                goTo(-1)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [goTo])

    /* Relato automático: avanza y hace scroll solo */
    useEffect(() => {
        if (!autoPlaying) return
        const timer = setInterval(() => goTo(1), 9000)
        return () => clearInterval(timer)
    }, [autoPlaying, goTo])

    const setChapterRef = useCallback(
        (id: string) => (el: HTMLElement | null) => {
            if (el) chapterEls.current.set(id, el)
            else chapterEls.current.delete(id)
        },
        []
    )

    const goCurrent = useCallback(() => {
        if (currentId) {
            setAutoPlaying(false)
            scrollToId(currentId)
        }
    }, [currentId, scrollToId])

    return (
        <div className="relative z-10 min-h-screen overflow-x-hidden pb-24 text-on-surface selection:bg-brand-accent/30">
            <div className="page-container space-y-6 pt-4">
                <SectionBar
                    label="Cronología Canónica"
                    icon={IconTimeClock}
                    variant="minimal"
                    badge={<span className="badge badge-brand tabular-nums">{totals.watched}/{totals.total} EP · {totals.percent}%</span>}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setEraSel("all")}
                                className={cn(
                                    "min-h-[32px] cursor-pointer rounded-full px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all",
                                    eraSel === "all" ? "bg-white text-zinc-950 shadow-sm" : "bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                Toda la historia
                            </button>
                            {presentEras.map((e) => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => setEraSel(e.id)}
                                    className={cn(
                                        "min-h-[32px] cursor-pointer rounded-full px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all",
                                        eraSel === e.id ? "bg-white text-zinc-950 shadow-sm" : "bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    {e.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSpoilers((s) => !s)}
                            className={cn(
                                "flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-bold transition-colors",
                                showSpoilers ? "border-rose-500/30 bg-rose-500/15 text-rose-300" : "border-white/10 bg-white/[0.06] text-zinc-400 hover:text-zinc-200"
                            )}
                        >
                            {showSpoilers ? <IconUiEye className="h-3.5 w-3.5" /> : <IconUiEyeOff className="h-3.5 w-3.5" />}
                            {showSpoilers ? "Spoilers visibles" : "Ocultar spoilers"}
                        </button>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                        Lee la historia como un manga: cada capítulo conserva su año in-universe, la voz del narrador, el estado del mundo y los hitos que puedes ver directo en KameHouse.
                    </p>
                </SectionBar>

                <div className="sticky top-16 z-20 md:top-20">
                    <ChapterIndex
                        items={visibleItems}
                        activeId={activeId ?? currentId}
                        unlockedIdx={unlockedIdx}
                        showSpoilers={showSpoilers}
                        autoPlaying={autoPlaying}
                        onJump={(id) => {
                            setAutoPlaying(false)
                            scrollToId(id)
                        }}
                        onToggleAuto={() => setAutoPlaying((p) => !p)}
                        onGoCurrent={goCurrent}
                    />
                </div>

                {/* Línea temporal vertical */}
                <div className="relative">
                    <div aria-hidden className="absolute bottom-0 left-[39px] top-0 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent md:left-1/2" />
                    <div className="space-y-8 md:space-y-12">
                        {visibleItems.map((it, idx) => {
                            const locked = !showSpoilers && it.globalIdx - 1 > unlockedIdx
                            if (locked) {
                                return (
                                    <LockedChapter
                                        key={it.span.id}
                                        item={it}
                                        prevTitle={items[unlockedIdx]?.span.title ?? "el arco anterior"}
                                        onGoCurrent={goCurrent}
                                        chapterRef={setChapterRef(it.span.id)}
                                    />
                                )
                            }
                            return (
                                <LoreChapter
                                    key={it.span.id}
                                    item={it}
                                    isEven={idx % 2 === 0}
                                    isActive={(activeId ?? currentId) === it.span.id}
                                    mediaId={mediaById.get(it.span.id)}
                                    movies={moviesById.get(it.span.id) ?? []}
                                    chapterRef={setChapterRef(it.span.id)}
                                />
                            )
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                    <button
                        type="button"
                        onClick={() => goTo(-1)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                    >
                        <IconNavigationChevronLeft className="h-3.5 w-3.5" /> Capítulo anterior
                    </button>
                    <span className="hidden font-mono text-[11px] text-zinc-500 sm:inline">
                        Tip: ↑ ↓ navegan capítulos · {visibleItems.length} capítulos con lore completo
                    </span>
                    <button
                        type="button"
                        onClick={() => goTo(1)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                    >
                        Siguiente capítulo <IconNavigationChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    )
}
