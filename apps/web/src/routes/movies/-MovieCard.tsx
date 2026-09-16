import { memo, useState, useCallback } from "react"
import { IconUiStar, IconUiMoreHorizontal, IconMediaPlay, IconUiListPlus } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useResponsive } from "@/hooks/use-responsive"
import { Vaul, VaulContent } from "@/components/vaul"
import { getMediumResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { useAppStore } from "@/lib/store"
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
    const { data: serverSettings } = useGetSettings()
    const hideAudienceScore = !!serverSettings?.platform?.hideAudienceScore
    const [drawerOpen, setDrawerOpen] = useState(false)
    const movie = entry.media
    const mediaId = entry.mediaId
    const posterImage = movie?.posterImage
    const idMal = movie?.idMal
    const format = movie?.format

    // Lore information for canonical titles and badges
    const lore = getMovieLore(entry)
    const rawTitle = getEntryTitle(entry) || lore?.title || "Película"
    const title = cleanMovieTitle(rawTitle)

    const handleQuickQueue = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
                useAppStore.getState().addToQueue({
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
            <div
                className="group relative cursor-pointer flex flex-col transition-all duration-300 transform-gpu"
                onClick={handleCardClick}
                onMouseEnter={() => onHoverCard(entry as (Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }))}
                onMouseLeave={() => onHoverCard(null)}
            >
                {/* Poster Wrap with Ki glow on hover */}
                <div 
                    className={cn(
                        "relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-container border transition-all duration-300 ease-out transform-gpu group-hover:-translate-y-1",
                        !hasLocalFiles && !isMobile && "opacity-60",
                    )}
                    style={{
                        borderColor: "var(--glass-border-side)",
                        boxShadow: "var(--shadow-glass)",
                    }}
                >
                    <DeferredImage
                        src={posterUrl}
                        alt={title}
                        className="w-full h-full object-cover transform-gpu transition-transform duration-500 group-hover:scale-[1.03]"
                        showSkeleton={false}
                        fallback={
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
                                style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${eraAccent} 15%, transparent), var(--bg-primary))` }}
                            >
                                <span className="font-display text-lg tracking-widest text-white/80 line-clamp-3 leading-tight">
                                    {title}
                                </span>
                            </div>
                        }
                    />

                    {/* Gradient Overlay for bottom contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Analog glare and top highlight texture */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glass-border-top),transparent)] z-10 pointer-events-none" />

                    {/* Top Left: Ki Score & Canon Badge */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1 z-20 pointer-events-none">
                        {(movie.score ?? 0) > 0 && !hideAudienceScore && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-scrim/90 border border-brand-accent/30 text-brand-accent font-mono text-caption font-bold shadow-md">
                                <IconUiStar size={9} fill="currentColor" className="stroke-none" />
                                <span>{(movie.score! / 10).toFixed(1)}</span>
                            </div>
                        )}
                        {isCanon && (
                            <span className="hidden group-hover:inline-flex px-1.5 py-0.5 rounded bg-brand-success/20 border border-brand-success/30 text-brand-success font-mono text-[9px] font-bold uppercase tracking-wider">
                                Canon
                            </span>
                        )}
                    </div>

                    {/* Top Right: Status badges & Mobile Menu */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 z-20">
                        {isMobile && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawerOpen(true)
                                }}
                                className="p-1.5 rounded-full bg-surface-container-high/90 border border-white/15 text-white/80 active:scale-95 transition-all mb-1"
                                aria-label="Más opciones"
                            >
                                <IconUiMoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {isCompleted && (
                            <div className="px-1.5 py-0.5 rounded bg-brand-success/90 text-badge text-on-surface font-mono font-bold uppercase tracking-wider shadow-sm">
                                visto
                            </div>
                        )}
                        {!isCompleted && hasProgress && (
                            <div className="px-1.5 py-0.5 rounded bg-brand-secondary/90 text-badge text-on-secondary font-mono font-bold uppercase tracking-wider shadow-sm">
                                {progressPercent}%
                            </div>
                        )}
                        {!hasLocalFiles && (
                            <div className="px-1.5 py-0.5 rounded bg-surface-container/95 text-badge text-on-surface-variant shadow-sm border border-outline-variant/10 font-mono font-semibold">
                                NO LOCAL
                            </div>
                        )}
                    </div>

                    {/* Desktop Hover Quick Action Overlay */}
                    {!isMobile && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                            <div className="flex items-center gap-2.5 pointer-events-auto transform-gpu translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleCardClick()
                                    }}
                                    className="w-10 h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-[0_2px_12px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                    title="Ver Película"
                                >
                                    <IconMediaPlay className="w-4 h-4 fill-current ml-0.5" />
                                </button>
                                {hasLocalFiles && (
                                    <button
                                        onClick={handleQuickQueue}
                                        className="w-10 h-10 rounded-full bg-zinc-950/85 text-white border border-white/20 border-t-white/40 border-b-white/10 flex items-center justify-center shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_20px_rgba(0,0,0,0.8)] backdrop-blur-md hover:bg-zinc-900 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                        title="Añadir a la cola"
                                    >
                                        <IconUiListPlus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Progress bar at bottom of poster */}
                    {hasProgress && (
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50 z-20">
                            <div
                                className="h-full transition-all duration-300"
                                style={{ width: `${progressPercent}%`, backgroundColor: eraAccent }}
                            />
                        </div>
                    )}
                </div>

                {/* Title / Info block */}
                <div className="mt-3 space-y-1 px-1">
                    <div className="h-9 min-h-[36px] flex flex-col justify-start">
                        <h3 className="font-sans text-xs font-bold text-on-surface line-clamp-2 uppercase group-hover:text-white transition-colors duration-200 leading-snug">
                            {title}
                        </h3>
                    </div>
                    <div className="flex items-center justify-between text-caption font-mono text-on-surface-variant uppercase tracking-wider">
                        <span>AÑO {movie.year || "----"}</span>
                        {(movie.runtime ?? 0) > 0 && <span className="text-on-surface-variant">{movie.runtime} MIN</span>}
                    </div>
                </div>
            </div>

            {/* Mobile Drawer (Vaul) */}
            {isMobile && (
                <Vaul open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <VaulContent className="bg-surface-container-high/95 backdrop-blur-overlay-xl border-t border-outline-variant/10 p-5 pb-8 flex flex-col focus:outline-none">
                        <div className="flex gap-4 mb-4">
                            <img
                                src={posterUrl}
                                alt={title}
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
