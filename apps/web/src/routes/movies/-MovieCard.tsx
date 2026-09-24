import { memo, useState, useCallback } from "react"
import { IconUiStar, IconUiMoreHorizontal, IconMediaPlay, IconUiListPlus } from "@/components/ui/icons";
import { MoviePosterCard } from "@/components/ui/movie-poster-card"
import { useResponsive } from "@/hooks/use-responsive"
import { Vaul, VaulContent } from "@/components/vaul"
import { getMediumResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { useQueueStore } from "@/lib/store"
import { usePrefetchAnimeEntry } from "@/hooks/use-prefetch-anime-entry"
import { getMovieLore, getEntryTitle, getLoreDescription } from "./-components/movies-utils"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import type { Anime_LibraryCollectionEntry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { toast } from "sonner"

export type EraTab = "all" | "Dragon Ball" | "Dragon Ball Z" | "Dragon Ball Super" | "Dragon Ball GT" | "Especiales y OVAs"

export const ERA_TABS: { value: EraTab; label: string; shortLabel: string; color: string; glow: string }[] = [
    { value: "all", label: "Todas", shortLabel: "Todas", color: "var(--era-dbz-hex)", glow: "hsl(var(--era-dbz-hsl) / 0.3)" },
    { value: "Dragon Ball", label: "Dragon Ball", shortLabel: "DB", color: "var(--era-db-hex)", glow: "hsl(var(--era-db-hsl) / 0.3)" },
    { value: "Dragon Ball Z", label: "Dragon Ball Z", shortLabel: "Z", color: "var(--era-dbz-hex)", glow: "hsl(var(--era-dbz-hsl) / 0.3)" },
    { value: "Dragon Ball GT", label: "Dragon Ball GT", shortLabel: "GT", color: "var(--era-dbgt-hex)", glow: "hsl(var(--era-dbgt-hsl) / 0.3)" },
    { value: "Dragon Ball Super", label: "Dragon Ball Super", shortLabel: "Super", color: "var(--era-dbs-hex)", glow: "hsl(var(--era-dbs-hsl) / 0.3)" },
    { value: "Especiales y OVAs", label: "Especiales y OVAs", shortLabel: "Esp/OVAs", color: "var(--era-daima-hex)", glow: "hsl(var(--era-daima-hsl) / 0.3)" },
]

export function cleanMovieTitle(title?: string): string {
    if (!title) return "Película"
    const stripped = title.replace(/^(dragon\s*ball(\s*z|\s*gt|\s*super|\s*kai)?)\s*[:\-–—]\s*/i, "").trim()
    if (stripped.length > 0 && stripped.toLowerCase() !== title.toLowerCase()) {
        return stripped
    }
    return title.trim() || "Película"
}


export const MovieCard = memo(function MovieCard({
    entry,
    era,
    eraId,
    watchHistoryItem,
    onClick,
    onHoverCard,
}: {
    entry: Anime_LibraryCollectionEntry & { era?: EraTab; eraId?: EraId; startedAtTimestamp?: number }
    era: EraTab
    eraId?: EraId
    watchHistoryItem?: Continuity_WatchHistoryItem | null
    onClick: (id: number) => void
    onHoverCard: (entry: (Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }) | null) => void
}) {
    const { isMobile } = useResponsive()
    const hideAudienceScore = useHideAudienceScore()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const movie = entry?.media
    const mediaId = entry?.mediaId
    const posterImage = movie?.posterImage
    const idMal = movie?.idMal
    const format = movie?.format

    const handlePrefetch = usePrefetchAnimeEntry(mediaId)

    const handleMouseEnter = useCallback(() => {
        handlePrefetch()
        onHoverCard(entry as (Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }))
    }, [handlePrefetch, onHoverCard, entry])

    const handleMouseLeave = useCallback(() => {
        onHoverCard(null)
    }, [onHoverCard])

    // Lore information for canonical titles and badges
    const lore = getMovieLore(entry ?? undefined)
    const rawTitle = (entry ? getEntryTitle(entry) : "") || lore?.title || "Película"
    const title = cleanMovieTitle(rawTitle)

    const handleQuickQueue = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
                useQueueStore.getState().addToQueue({
                    id: mediaId,
                    title: title,
                    playableUrl: localFile.path,
                    thumbnail: getMediumResImage(posterImage || ""),
                    mediaId: mediaId,
                    episodeNumber: Number(epNum),
                    malId: idMal ?? null,
                    mediaFormat: format ?? "MOVIE"
                })
                toast.success("Añadida a la cola de reproducción", {
                    description: title,
                })
            } else {
                toast.info("No hay archivos locales disponibles para esta película.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a la cola")
        }
    }, [mediaId, posterImage, idMal, format, title])

    const handleCardClick = useCallback(() => {
        if (mediaId) {
            onClick(mediaId)
        }
    }, [onClick, mediaId])

    if (!movie || !mediaId) return null

    const eraConfig = ERA_TABS.find(t => t.value === era) || ERA_TABS[0]
    // Nueva lógica: color canónico de Home cuando hay eraId, fallback legacy.
    const resolvedEraId: EraId | null = eraId ?? (entry as { eraId?: EraId }).eraId ?? null
    const eraAccent = resolvedEraId ? ERA_COLOR_MAP[resolvedEraId].accent : eraConfig.color
    const eraLabel = resolvedEraId ? (ERAS.find(e => e.id === resolvedEraId)?.title ?? eraConfig.label) : eraConfig.label
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const isCompleted = movie.watched || (entry.listData?.progress || 0) >= (movie.totalEpisodes || 1)

    const progressTime = watchHistoryItem?.currentTime || 0
    const totalDuration = watchHistoryItem?.duration || 0
    const hasProgress = !isCompleted && progressTime > 30 && totalDuration > 0 && progressTime < totalDuration
    const progressPercent = hasProgress ? Math.min(100, Math.round((progressTime / totalDuration) * 100)) : 0

    // Badges
    const isCanon = lore?.canonStatus?.includes("Canon") && !lore?.canonStatus?.includes("No")

    // Use medium resolution images for grid/card performance
    const posterUrl = getMediumResImage(movie.posterImage || "")

    return (
        <>
            {/* Tarjeta canónica compartida con Home: misma caja aspect-[2/3] rounded-2xl con título en overlay */}
            <MoviePosterCard
                image={posterUrl}
                title={title}
                showSkeleton={false}
                imageFallback={
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${eraAccent} 15%, transparent), var(--bg-primary))` }}
                    >
                        <span className="font-display text-lg tracking-widest text-white/80 line-clamp-3 leading-tight">
                            {title}
                        </span>
                    </div>
                }
                dimmed={!hasLocalFiles && !isMobile}
                borderColor={eraAccent ? `color-mix(in srgb, ${eraAccent} 20%, rgba(255,255,255,0.1))` : undefined}
                titleHoverColor={eraAccent}
                progressPercent={hasProgress ? progressPercent : undefined}
                progressColor={eraAccent}
                onClick={handleCardClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handlePrefetch}
                bottomMeta={
                    <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-wider">
                        <span>AÑO {movie.year || "----"}</span>
                        {(movie.runtime ?? 0) > 0 && (
                            <>
                                <span className="text-white/50">•</span>
                                <span>{movie.runtime} MIN</span>
                            </>
                        )}
                    </div>
                }
                topLeft={
                    <>
                        {(movie.score ?? 0) > 0 && movie.score != null && !hideAudienceScore && (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/65 border border-white/20 text-brand-accent font-mono text-2xs font-extrabold tracking-wider uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                <IconUiStar size={10} fill="currentColor" className="stroke-none" />
                                <span>{(movie.score / 10).toFixed(1)}</span>
                            </div>
                        )}
                        {isCanon && (
                            <span className="hidden group-hover:inline-flex px-2.5 py-0.5 rounded-full bg-black/65 border border-white/20 text-brand-success font-mono text-2xs font-extrabold tracking-wider uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                Canon
                            </span>
                        )}
                    </>
                }
                topRight={
                    <>
                        {isMobile && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawerOpen(true)
                                }}
                                className="pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/65 border border-white/20 text-white/90 active:scale-95 transition-[transform,background-color,border-color] duration-base ease-smooth-out mb-1 shadow-elevation-1 cursor-pointer"
                                aria-label="Más opciones"
                            >
                                <IconUiMoreHorizontal className="w-4 h-4" />
                            </button>
                        )}
                        {isCompleted && (
                            <div className="px-2.5 py-0.5 rounded-full bg-black/65 border border-white/20 text-brand-success font-mono text-2xs font-extrabold tracking-wider uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                visto
                            </div>
                        )}
                        {!isCompleted && hasProgress && (
                            <div className="px-2.5 py-0.5 rounded-full bg-black/65 border border-white/20 text-brand-secondary font-mono text-2xs font-extrabold tracking-wider uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                {progressPercent}%
                            </div>
                        )}
                        {!hasLocalFiles && (
                            <div className="px-2.5 py-0.5 rounded-full bg-black/65 border border-white/20 text-white/60 font-mono text-2xs font-extrabold tracking-wider uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                NO LOCAL
                            </div>
                        )}
                    </>
                }
                centerOverlay={
                    !isMobile ? (
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleCardClick()
                                }}
                                className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-black ring-1 ring-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,1)] hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                                aria-label="Ver Película"
                                title="Ver Película"
                            >
                                <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                            </button>
                            {hasLocalFiles && (
                                <button
                                    onClick={handleQuickQueue}
                                    className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-950/70 backdrop-blur-md text-white ring-1 ring-white/30 border border-white/10 shadow-[shadow:0_2px_12px_rgba(0,0,0,0.5),var(--glass-highlight-md)] hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                                    aria-label="Añadir a la cola"
                                    title="Añadir a la cola"
                                >
                                    <IconUiListPlus className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : undefined
                }
            />

            {/* Mobile Drawer (Vaul) */}
            {isMobile && (
                <Vaul open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <VaulContent className="bg-surface-container-high/95 backdrop-blur-overlay-xl border-t border-outline-variant/10 p-5 pb-8 flex flex-col focus:outline-none">
                        <div className="flex gap-4 mb-4">
                            <img
                                src={posterUrl}
                                alt={title}
                                loading="lazy"
                                decoding="async"
                                className="w-20 aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-display text-2xl text-on-surface uppercase tracking-wide truncate">
                                    {title}
                                </h3>
                                <p className="text-label-sm font-black uppercase tracking-widest text-on-surface-variant mt-1">
                                    {eraLabel}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                                    {(movie.score ?? 0) > 0 && !hideAudienceScore && (
                                        <span className="text-brand-success font-extrabold">
                                            {movie.score}% COINCIDENCIA
                                        </span>
                                    )}
                                    {(movie.year ?? 0) > 0 && <span className="text-on-surface-variant font-medium">{movie.year}</span>}
                                    <span className="border border-outline-variant/10 bg-surface-variant px-1.5 py-0.5 rounded text-on-surface-variant text-xs">
                                        PELÍCULA
                                    </span>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const loreDesc = getLoreDescription(lore)
                            const isDescriptionEnglish = movie.description && /^(the|after|when|with|in\s+the|during|a\s+|goku\b)/i.test(movie.description.trim())
                            const displayDesc = (!movie.description || isDescriptionEnglish)
                                ? (loreDesc || movie.description)
                                : movie.description
                            return displayDesc ? (
                                <p className="text-label-sm leading-relaxed text-on-surface-variant line-clamp-4 mb-6">
                                    {stripHtml(displayDesc)}
                                </p>
                            ) : null
                        })()}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setDrawerOpen(false)
                                    handleCardClick()
                                }}
                                className="w-full py-3 bg-brand-accent text-on-primary font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <IconMediaPlay className="w-4 h-4 fill-current" />
                                <span>Ver Detalles</span>
                            </button>

                            {hasLocalFiles && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        setDrawerOpen(false)
                                        await handleQuickQueue(e)
                                    }}
                                    className="w-full py-3 border border-outline-variant/30 text-on-surface font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                                >
                                    <IconUiListPlus className="w-4 h-4" />
                                    <span>Añadir a la cola</span>
                                </button>
                            )}

                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="w-full py-3 border border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-xs rounded-xl active:scale-95 transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </VaulContent>
                </Vaul>
            )}
        </>
    )
})
MovieCard.displayName = "MovieCard"
