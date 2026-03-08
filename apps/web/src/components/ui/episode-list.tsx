/**
 * EpisodeList — Saga/Season navigation + episode grid for the Media Details page.
 *
 * ─── Component hierarchy ──────────────────────────────────────────────────────
 *
 *  <EpisodeList>
 *    ├─ <SagaTabs>          horizontal pill tabs, one per Saga
 *    └─ <EpisodeGrid>       responsive episode cards for the active Saga
 *         └─ <EpisodeCard>  thumbnail + number + title + synopsis + runtime
 *
 * ─── Data contract ────────────────────────────────────────────────────────────
 *
 *  interface Saga     { id, title, episodes[] }
 *  interface Episode  { id, number, title, synopsis, durationMin, thumbnailUrl? }
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 * • Strictly dark-mode zinc palette — no orange.
 * • Stremio/Netflix-style horizontal list of episode rows.
 * • Active saga: white pill underline (same active style as the sidebar).
 * • Hover row: bg-zinc-800/70, subtle scale on thumbnail.
 * • Thumbnail fallback: zinc placeholder with episode number.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { FaPlay } from "react-icons/fa"
import { BsClock } from "react-icons/bs"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Episode {
    /** Unique identifier (used as React key and for callbacks). */
    id: string | number
    /** 1-based episode number within the saga. */
    number: number
    /** Display title, e.g. "The Arrival". */
    title: string
    /** Short synopsis — clamped to 2 lines in the UI. */
    synopsis?: string
    /** Runtime in minutes, e.g. 24. */
    durationMin?: number
    /**
     * Absolute URL of the episode thumbnail/still frame.
     * Falls back to a zinc placeholder with the episode number when absent or broken.
     */
    thumbnailUrl?: string
    /**
     * Optional: air date string, e.g. "2024-01-13".
     * Displayed as subtitle next to the runtime when present.
     */
    airDate?: string
    /** True when the user has fully watched this episode. */
    watched?: boolean
}

export interface Saga {
    /** Unique identifier used as a React key and tab value. */
    id: string | number
    /**
     * Display name, e.g. "Saga del Agente del Miedo" or "Temporada 1".
     */
    title: string
    episodes: Episode[]
}

export interface EpisodeListProps {
    sagas: Saga[]
    /**
     * Optional: id of the saga that should be shown on first render.
     * Defaults to the first saga.
     */
    defaultSagaId?: string | number
    /**
     * Called when the user clicks the play button on an episode card.
     */
    onPlayEpisode?: (episode: Episode, saga: Saga) => void
    /** Extra classes for the root container. */
    className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// EpisodeThumbnail — image with zinc fallback
// ─────────────────────────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
    url?: string
    episodeNumber: number
    title: string
}

function EpisodeThumbnail({ url, episodeNumber, title }: EpisodeThumbnailProps) {
    const [broken, setBroken] = React.useState(false)
    const showFallback = !url || broken

    return (
        <div
            className={cn(
                "relative shrink-0 overflow-hidden rounded-lg",
                // 16:9 with a fixed width so the list items are uniform
                "w-[148px] h-[84px] md:w-[180px] md:h-[102px]",
                "bg-zinc-800",
            )}
        >
            {showFallback ? (
                // ── Zinc placeholder ──
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-zinc-500 text-xl font-black tabular-nums select-none">
                        {episodeNumber}
                    </span>
                </div>
            ) : (
                <img
                    src={url}
                    alt={title}
                    loading="lazy"
                    draggable={false}
                    onError={() => setBroken(true)}
                    className={cn(
                        "w-full h-full object-cover select-none",
                        "transition-transform duration-300 ease-out",
                        "group-hover:scale-105",
                    )}
                />
            )}

            {/*
             * Subtle dark vignette on the thumbnail so the number badge
             * is always readable regardless of the image content.
             */}
            {!showFallback && (
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            )}

            {/* Play icon — appears on row hover */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-200",
                )}
            >
                <div
                    className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        "bg-white/90 backdrop-blur-sm",
                        "shadow-lg shadow-black/40",
                        "scale-75 group-hover:scale-100",
                        "transition-transform duration-200 delay-50",
                    )}
                >
                    <FaPlay className="w-2.5 h-2.5 text-zinc-950 ml-0.5" />
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// EpisodeCard — single row in the list
// ─────────────────────────────────────────────────────────────────────────────

interface EpisodeCardProps {
    episode: Episode
    saga: Saga
    onPlay?: (episode: Episode, saga: Saga) => void
}

function EpisodeCard({ episode, saga, onPlay }: EpisodeCardProps) {
    return (
        <li>
            <div
                role="button"
                tabIndex={0}
                aria-label={`Reproducir episodio ${episode.number}: ${episode.title}`}
                onClick={() => onPlay?.(episode, saga)}
                onKeyDown={(e) => e.key === "Enter" && onPlay?.(episode, saga)}
                className={cn(
                    "group flex items-start gap-4 p-3 rounded-xl cursor-pointer",
                    "hover:bg-zinc-800/70 active:bg-zinc-800",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                )}
            >
                {/* Thumbnail */}
                <EpisodeThumbnail
                    url={episode.thumbnailUrl}
                    episodeNumber={episode.number}
                    title={episode.title}
                />

                {/* Text content */}
                <div className="flex flex-col gap-1 min-w-0 flex-1 pt-0.5">
                    {/* Episode number + title */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-zinc-500 text-xs font-black tabular-nums shrink-0">
                            {episode.number}.
                        </span>
                        <h3 className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-1 group-hover:text-white transition-colors">
                            {episode.title}
                        </h3>
                    </div>

                    {/* Synopsis */}
                    {episode.synopsis && (
                        <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2 md:line-clamp-3">
                            {episode.synopsis}
                        </p>
                    )}

                    {/* Runtime + air date */}
                    {(episode.durationMin !== undefined || episode.airDate) && (
                        <div className="flex items-center gap-2 mt-0.5">
                            {episode.durationMin !== undefined && (
                                <span className="flex items-center gap-1 text-zinc-500 text-xs font-medium">
                                    <BsClock className="w-2.5 h-2.5" />
                                    {episode.durationMin}m
                                </span>
                            )}
                            {episode.airDate && episode.durationMin !== undefined && (
                                <span className="text-zinc-700 text-[10px]">·</span>
                            )}
                            {episode.airDate && (
                                <span className="text-zinc-600 text-xs">
                                    {episode.airDate}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Watched pill */}
                    {episode.watched && (
                        <span className="inline-flex items-center mt-1 self-start px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-white/10 text-zinc-400">
                            Visto
                        </span>
                    )}
                </div>
            </div>
        </li>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// SagaTabs — horizontal saga selector
// ─────────────────────────────────────────────────────────────────────────────

interface SagaTabsProps {
    sagas: Saga[]
    activeSagaId: string | number
    onSelect: (id: string | number) => void
}

function SagaTabs({ sagas, activeSagaId, onSelect }: SagaTabsProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    return (
        <div
            ref={scrollRef}
            role="tablist"
            aria-label="Seleccionar Saga"
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1"
        >
            {sagas.map((saga) => {
                const isActive = saga.id === activeSagaId
                return (
                    <button
                        key={saga.id}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        onClick={() => onSelect(saga.id)}
                        className={cn(
                            "relative shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap",
                            "transition-all duration-200 ease-out",
                            isActive
                                ? "text-white bg-zinc-800"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                        )}
                    >
                        {/* White underline pill for active tab */}
                        {isActive && (
                            <span
                                aria-hidden
                                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-white"
                            />
                        )}
                        {saga.title}
                        {/* Episode count badge */}
                        <span
                            className={cn(
                                "ml-1.5 text-[10px] font-bold tabular-nums",
                                isActive ? "text-zinc-400" : "text-zinc-600",
                            )}
                        >
                            {saga.episodes.length}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// EpisodeList — main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EpisodeList
 *
 * Displays a horizontal saga-tab bar and a vertical list of episode cards for
 * the currently selected saga. Designed for the Media Details page.
 *
 * @example
 * ```tsx
 * <EpisodeList
 *   sagas={animeData.sagas}
 *   onPlayEpisode={(ep, saga) => openPlayer(ep, saga)}
 * />
 * ```
 */
export function EpisodeList({
    sagas,
    defaultSagaId,
    onPlayEpisode,
    className,
}: EpisodeListProps) {
    const [activeSagaId, setActiveSagaId] = React.useState<string | number>(
        defaultSagaId ?? sagas[0]?.id ?? "",
    )

    const activeSaga = sagas.find((s) => s.id === activeSagaId) ?? sagas[0]

    if (!sagas.length) {
        return (
            <div className={cn("flex items-center justify-center py-16 text-zinc-600 text-sm", className)}>
                No hay episodios disponibles.
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {/* ── Saga tabs ───────────────────────────────────── */}
            {sagas.length > 1 && (
                <SagaTabs
                    sagas={sagas}
                    activeSagaId={activeSagaId}
                    onSelect={setActiveSagaId}
                />
            )}

            {/* ── Section header ──────────────────────────────── */}
            <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                    {activeSaga?.title}
                </h2>
                <span className="text-zinc-600 text-xs font-medium">
                    {activeSaga?.episodes.length ?? 0} episodios
                </span>
            </div>

            {/* ── Episode list ────────────────────────────────── */}
            <ul className="flex flex-col gap-1" role="list" aria-label={`Episodios de ${activeSaga?.title}`}>
                {activeSaga?.episodes.map((episode) => (
                    <EpisodeCard
                        key={episode.id}
                        episode={episode}
                        saga={activeSaga}
                        onPlay={onPlayEpisode}
                    />
                ))}
            </ul>
        </div>
    )
}
