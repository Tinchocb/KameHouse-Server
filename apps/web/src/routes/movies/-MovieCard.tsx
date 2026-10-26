import { memo, useState, useCallback, useMemo, useId } from "react"
import { IconUiMoreHorizontal, IconMediaPlay, IconUiListPlus, IconUiCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { Button, IconButton } from "@/components/ui/button"
import { MoviePosterCard } from "@/components/ui/movie-poster-card"
import { useResponsive } from "@/hooks/use-responsive"
import { Vaul, VaulContent, VaulDescription } from "@/components/vaul"
import { getMediumResImage, localImage } from "@/lib/helpers/images"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { useQueueStore } from "@/lib/store"
import { usePrefetchAnimeEntry } from "@/hooks/use-prefetch-anime-entry"
import { getMovieLore, getEntryTitle, getMovieSynopsis, getMovieProgress } from "./-components/movies-utils"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import type { Anime_LibraryCollectionEntry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"

export type EraTab = "all" | "Dragon Ball" | "Dragon Ball Z" | "Dragon Ball Super" | "Dragon Ball GT" | "Especiales y OVAs"

const ERA_TABS: { value: EraTab; label: string; shortLabel: string; color: string; glow: string }[] = [
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


/** Etiqueta sobre el póster: micro-vidrio de 8px (tokens blur.css) con borde superior especular. */
function PosterChip({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1 rounded-full border border-white/15 border-t-white/30 bg-black/50 px-2.5 py-0.5 text-2xs font-semibold shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]",
            "[[data-flat=true]_&]:bg-black/85 [[data-flat=true]_&]:backdrop-filter-none",
            className
        )}>
            {children}
        </span>
    )
}

export const MovieCard = memo(function MovieCard({
    entry,
    era,
    eraId,
    watchHistoryItem,
    index,
    initial,
    isNew,
    onClick,
    onHoverCard,
}: {
    entry: Anime_LibraryCollectionEntry & { era?: EraTab; eraId?: EraId; startedAtTimestamp?: number }
    era: EraTab
    eraId?: EraId
    watchHistoryItem?: Continuity_WatchHistoryItem | null
    index?: number
    initial?: boolean | "hidden"
    /** Añadida a la biblioteca hace poco (ver `isNewlyAdded`). */
    isNew?: boolean
    onClick: (id: number) => void
    onHoverCard: (entry: (Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }) | null) => void
}) {
    const { isMobile } = useResponsive()
    const hideAudienceScore = useHideAudienceScore()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const drawerTitleId = useId()
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
    const title = useMemo(() => {
        const itemLore = getMovieLore(entry ?? undefined)
        const rawTitle = (entry ? getEntryTitle(entry) : "") || itemLore?.title || "Película"
        return cleanMovieTitle(rawTitle)
    }, [entry])
    const synopsis = getMovieSynopsis(movie?.description, lore)

    const { playSound } = useSound()
    const [justQueued, triggerJustQueued] = useTransientFlag(1400)

    const handleQuickQueue = useCallback(async (e: { stopPropagation: () => void }) => {
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
                }, { openSidebar: false })
                toast.success("Añadida a Mi Lista", {
                    description: title,
                })
                playSound("category", 0.35)
                triggerJustQueued()
            } else {
                toast.info("Esta película no tiene archivos locales para reproducir.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        }
    }, [mediaId, posterImage, idMal, format, title, playSound, triggerJustQueued])

    // Teclado: una sola parada de Tab por tarjeta (su botón principal). Las acciones
    // secundarias del hover (Ver película, Añadir a Mi Lista) llevan tabIndex=-1;
    // con el foco en la tarjeta: Enter abre la ficha y la tecla Q añade a Mi Lista.
    const handleCardKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== "q") return
        if (e.target !== e.currentTarget && !(e.target instanceof HTMLButtonElement && e.target.getAttribute("aria-label") === title)) return
        e.preventDefault()
        void handleQuickQueue(e)
    }, [handleQuickQueue, title])

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
    const { isCompleted, hasProgress, progressPercent } = getMovieProgress(entry, watchHistoryItem)
    // Mismo texto que el botón principal del hero: abre la ficha con el progreso a la vista.
    const openLabel = hasProgress ? "Continuar" : isCompleted ? "Ver de nuevo" : "Ver película"

    // Badges
    const isCanon = lore?.canonStatus?.includes("Canon") && !lore?.canonStatus?.includes("No")

    // Resolución media, servida desde la caché local del servidor (precalentada)
    const posterUrl = localImage(getMediumResImage(movie.posterImage || ""))

    const isSpecialFormat = format === "SPECIAL" || format === "OVA"
    const movieTypeLabel = isCanon ? "Película (Canon)" : isSpecialFormat ? (format === "OVA" ? "OVA" : "Especial") : "Película"
    const scoreVal = (movie.score ?? 0) > 0 && !hideAudienceScore ? ((movie.score ?? 0) / 10).toFixed(1) : undefined
    const runtimeText = (movie.runtime ?? 0) > 0 ? `${movie.runtime} min` : undefined

    return (
        <>
            {/* Tarjeta canónica compartida con Home: FUSIÓN A + B Full-Bleed 2:3 */}
            <MoviePosterCard
                image={posterUrl}
                title={title}
                index={index}
                initial={initial}
                sharedKey={mediaId != null ? `movies:${mediaId}` : undefined}
                showSkeleton={false}
                imageFallback={
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${eraAccent} 15%, transparent), var(--bg-primary))` }}
                    >
                        <span className="font-display text-lg text-white/90 line-clamp-3 leading-tight text-balance">
                            {title}
                        </span>
                    </div>
                }
                dimmed={!hasLocalFiles}
                borderColor={eraAccent ? `color-mix(in srgb, ${eraAccent} 20%, rgba(255,255,255,0.1))` : undefined}
                titleHoverColor={eraAccent}
                eraColor={eraAccent}
                eraLabel={eraLabel}
                year={movie.year}
                runtime={runtimeText}
                typeLabel={movieTypeLabel}
                score={scoreVal}
                isNew={isNew}
                isSpecial={isSpecialFormat}
                synopsis={synopsis}
                progressPercent={hasProgress ? progressPercent : undefined}
                progressColor={eraAccent}
                onClick={handleCardClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handlePrefetch}
                onKeyDown={handleCardKeyDown}
                actions={
                    !isMobile ? (
                        <div className="flex items-center gap-1.5 w-full">
                            <Button
                                type="button"
                                intent="primary"
                                size="xs"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleCardClick()
                                }}
                                className="flex-1 gap-1.5 shadow-[shadow:var(--shadow-play-cta)]"
                            >
                                <IconMediaPlay size={14} fill="currentColor" />
                                <span>{hasProgress ? "Continuar" : "Ver"}</span>
                            </Button>
                            {hasLocalFiles && (
                                <IconButton
                                    type="button"
                                    tabIndex={-1}
                                    intent="glass"
                                    size="sm"
                                    aria-label="Añadir a Mi Lista"
                                    title="Añadir a Mi Lista (tecla Q)"
                                    onClick={handleQuickQueue}
                                    icon={
                                        <IconSwap swapKey={justQueued ? "queued" : "queue"}>
                                            {justQueued
                                                ? <IconUiCheck className="w-4 h-4 text-status-success" strokeWidth={3} />
                                                : <IconUiListPlus className="w-4 h-4" />}
                                        </IconSwap>
                                    }
                                    className={cn(
                                        "shrink-0",
                                        justQueued && "text-status-success bg-status-success/20 border-status-success/40"
                                    )}
                                />
                            )}
                        </div>
                    ) : undefined
                }
                topRight={
                    <>
                        {isMobile && (
                            <IconButton
                                intent="glass"
                                aria-label="Más opciones"
                                icon={<IconUiMoreHorizontal className="w-4 h-4" />}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawerOpen(true)
                                }}
                                className="pointer-events-auto mb-1"
                            />
                        )}
                        {isCompleted && (
                            <PosterChip className="text-brand-success">
                                <IconUiCheck className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                                Visto
                            </PosterChip>
                        )}
                        {hasProgress && <PosterChip className="text-brand-secondary">Continuar</PosterChip>}
                        {!hasLocalFiles && <PosterChip className="text-white/90">Sin archivo local</PosterChip>}
                    </>
                }
            />

            {/* Mobile Drawer (Vaul) */}
            {isMobile && (
                <Vaul open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <VaulContent aria-labelledby={drawerTitleId} className="p-5 flex flex-col focus:outline-none">
                        <div className="flex gap-4 mb-4">
                            <img
                                src={posterUrl}
                                alt={title}
                                loading="lazy"
                                decoding="async"
                                className="w-20 aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                                <h3 id={drawerTitleId} className="font-display text-2xl text-on-surface truncate" title={title}>
                                    {title}
                                </h3>
                                <p className="text-label-sm font-semibold text-on-surface-variant mt-1">
                                    {eraLabel}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2 text-label-sm font-semibold text-on-surface-variant">
                                    {(movie.score ?? 0) > 0 && !hideAudienceScore && (
                                        <span className="text-brand-success font-bold">
                                            ★ {(movie.score / 10).toFixed(1)}
                                        </span>
                                    )}
                                    {(movie.year ?? 0) > 0 && <span className="text-on-surface-variant font-medium">{movie.year}</span>}
                                    <span className="border border-outline-variant/10 bg-surface-variant px-1.5 py-0.5 rounded text-on-surface-variant text-xs">
                                        Película
                                    </span>
                                </div>
                            </div>
                        </div>

                        {synopsis ? (
                            <VaulDescription asChild>
                                <p className="text-label-sm leading-relaxed text-on-surface-variant line-clamp-4 mb-6 text-pretty">
                                    {synopsis}
                                </p>
                            </VaulDescription>
                        ) : (
                            <VaulDescription className="sr-only">Opciones de reproducción de {title}.</VaulDescription>
                        )}

                        <div className="flex flex-col gap-3">
                            <Button
                                intent="primary"
                                size="lg"
                                className="w-full"
                                leftIcon={<IconMediaPlay className="w-4 h-4 fill-current" />}
                                onClick={() => {
                                    setDrawerOpen(false)
                                    handleCardClick()
                                }}
                            >
                                {hasProgress ? `Continuar · ${progressPercent} %` : openLabel}
                            </Button>

                            {hasLocalFiles && (
                                <Button
                                    intent="secondary"
                                    size="lg"
                                    className="w-full"
                                    leftIcon={<IconUiListPlus className="w-4 h-4" />}
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        setDrawerOpen(false)
                                        await handleQuickQueue(e)
                                    }}
                                >
                                    Añadir a Mi Lista
                                </Button>
                            )}

                            <Button intent="ghost" size="lg" className="w-full" onClick={() => setDrawerOpen(false)}>
                                Cerrar
                            </Button>
                        </div>
                    </VaulContent>
                </Vaul>
            )}
        </>
    )
})
MovieCard.displayName = "MovieCard"
