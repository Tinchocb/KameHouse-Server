import { memo, useCallback, useMemo } from "react"
import { IconMediaPlay, IconUiListPlus, IconUiCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { MoviePosterCard } from "@/components/ui/movie-poster-card"
import { getMediumResImage, localImage } from "@/lib/helpers/images"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { useIsClassicMode } from "@/lib/theme/use-classic-mode"
import { useQueueStore } from "@/lib/store"
import { usePrefetchAnimeEntry } from "@/hooks/use-prefetch-anime-entry"
import { getMovieLore, getEntryTitle, getMovieSynopsis, getMovieProgress } from "./-components/movies-utils"
import { ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import type { Anime_LibraryCollectionEntry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"

export type EraTab = "all" | "Dragon Ball" | "Dragon Ball Z" | "Dragon Ball Super" | "Dragon Ball GT" | "Especiales y OVAs"

const ERA_TABS: { value: EraTab; color: string }[] = [
    { value: "all", color: "var(--era-dbz-hex)" },
    { value: "Dragon Ball", color: "var(--era-db-hex)" },
    { value: "Dragon Ball Z", color: "var(--era-dbz-hex)" },
    { value: "Dragon Ball GT", color: "var(--era-dbgt-hex)" },
    { value: "Dragon Ball Super", color: "var(--era-dbs-hex)" },
    { value: "Especiales y OVAs", color: "var(--era-daima-hex)" },
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
            "poster-chip inline-flex items-center gap-1 rounded-full border border-white/15 border-t-white/30 bg-black/50 px-2.5 py-0.5 text-2xs font-semibold shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]",
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
    isWideDrawer = true,
    priority = false,
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
    /** Renderiza la tarjeta con cajón lateral amplio (grilla) o vertical 2:3 pura (estanterías horizontales). */
    isWideDrawer?: boolean
    /** Prioriza descarga y decodificación para carátulas visibles al entrar en pantalla. */
    priority?: boolean
    onClick: (id: number) => void
    onHoverCard: (entry: (Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }) | null) => void
}) {
    const hideAudienceScore = useHideAudienceScore()
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
    const lore = useMemo(() => getMovieLore(entry ?? undefined), [entry])
    const title = useMemo(() => {
        const rawTitle = (entry ? getEntryTitle(entry) : "") || lore?.title || "Película"
        return cleanMovieTitle(rawTitle)
    }, [entry, lore])
    const synopsis = useMemo(() => getMovieSynopsis(movie?.description, lore), [movie?.description, lore])

    const { playSound } = useSound()
    const [justQueued, triggerJustQueued] = useTransientFlag(1400)

    const handleQuickQueue = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        if (!mediaId) return
        // Promesa en vez de try/catch: el compilador de React no optimiza componentes con try.
        void fetchAnimeEntry(String(mediaId)).then((fullEntry) => {
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
        }).catch((err) => {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        })
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

    const isClassic = useIsClassicMode()

    if (!movie || !mediaId) return null
    const eraConfig = ERA_TABS.find(t => t.value === era) || ERA_TABS[0]
    // Nueva lógica: color canónico de Home cuando hay eraId, fallback legacy.
    const resolvedEraId: EraId | null = eraId ?? (entry as { eraId?: EraId }).eraId ?? null
    const eraAccent = resolvedEraId ? ERA_COLOR_MAP[resolvedEraId].accent : eraConfig.color
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const { isCompleted, hasProgress, progressPercent } = getMovieProgress(entry, watchHistoryItem)

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
                        style={{ background: isClassic ? "var(--neutral-elev-2)" : `linear-gradient(135deg, color-mix(in srgb, ${eraAccent} 15%, transparent), var(--bg-primary))` }}
                    >
                        <span className="font-display text-lg text-white/90 line-clamp-3 leading-tight text-balance">
                            {title}
                        </span>
                    </div>
                }
                dimmed={!hasLocalFiles}
                borderColor={isClassic ? "var(--neutral-separator)" : (eraAccent ? `color-mix(in srgb, ${eraAccent} 20%, rgba(255,255,255,0.1))` : undefined)}
                titleHoverColor={isClassic ? "var(--label-1)" : eraAccent}
                eraColor={isClassic ? "var(--label-2)" : eraAccent}
                year={movie.year}
                runtime={runtimeText}
                typeLabel={movieTypeLabel}
                score={scoreVal}
                isNew={isNew}
                isSpecial={isSpecialFormat}
                synopsis={synopsis}
                progressPercent={hasProgress ? progressPercent : undefined}
                progressColor={isClassic ? "var(--selected-bg)" : eraAccent}
                isWideDrawer={isWideDrawer}
                priority={priority}
                indexLabel={index !== undefined ? `#${String(index + 1).padStart(2, "0")}` : undefined}
                onClick={handleCardClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handlePrefetch}
                onKeyDown={handleCardKeyDown}
                ariaKeyShortcuts={hasLocalFiles ? "q" : undefined}
                actions={
                    <div className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="movie-card-cta relative h-8 px-3.5 rounded-full bg-white text-black font-extrabold text-xs tracking-tight shadow-[shadow:var(--shadow-play-cta)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-[transform,background-color] duration-quick ease-out-strong inline-flex flex-row flex-nowrap items-center justify-center gap-1.5 ring-1 ring-white/70 select-none whitespace-nowrap shrink-0"
                        >
                            <IconMediaPlay size={13} fill="currentColor" className="ml-0.5 text-black shrink-0" />
                            <span className="font-bold text-xs tracking-tight text-black leading-none select-none">
                                {hasProgress ? "Continuar" : "Reproducir"}
                            </span>
                        </span>
                        {hasLocalFiles && (
                            <IconButton
                                intent="secondary"
                                size="sm"
                                tabIndex={-1}
                                aria-label="Añadir a Mi Lista"
                                title="Añadir a Mi Lista (tecla Q)"
                                onClick={handleQuickQueue}
                                className={cn(
                                    "h-8 w-8 rounded-full border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] text-white shadow-[shadow:var(--double-bezel-control-shadow)] transition-[transform,border-color,background-color,color] duration-quick motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 motion-safe:active:scale-[0.97]",
                                    justQueued && "text-status-success bg-status-success/20 border-status-success/50"
                                )}
                                icon={
                                    <IconSwap subtle swapKey={justQueued ? "queued" : "queue"}>
                                        {justQueued
                                            ? <IconUiCheck className="w-4 h-4 text-status-success" strokeWidth={3} />
                                            : <IconUiListPlus className="w-4 h-4 text-white" />}
                                    </IconSwap>
                                }
                            />
                        )}
                    </div>
                }
                topRight={
                    <>
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
        </>
    )
})
MovieCard.displayName = "MovieCard"
