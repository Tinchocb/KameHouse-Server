import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useIsClassicMode } from "@/lib/theme/use-classic-mode"
import { getFormatLabel } from "@/lib/helpers/media"
import { useState, useCallback, useMemo } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { m, AnimatePresence } from "framer-motion"
import { ButtonAnatomy } from "@/components/ui/button"
import { IconUiCheck, IconUiListPlus } from "@/components/ui/icons";
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics/icon-swap"
import { LoadSwap } from "@/components/ui/kinetics/load-swap"
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { cleanMovieTitle } from "../-MovieCard"
import type { MovieEntry } from "../index"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { SpotlightEraNav } from "@/components/ui/spotlight/spotlight-era-nav"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { useHeroBackdrop } from "@/hooks/use-hero"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getMediumResImage, getLowResImage, localImage } from "@/lib/helpers/images"
import { HeroBackdrop } from "@/components/ui/spotlight/hero-backdrop"
import { useQueueStore } from "@/lib/store"
import {
    useMotionTier,
    heroContainerVariants,
    heroItemVariants,
    heroFadeOnlyVariants,
    heroBackdropFadeVariants,
} from "@/components/ui/kinetics"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { MoreActionsMenu, PrimaryPlayButton, ResumeProgress, RoundAction } from "@/components/media-detail/detail-actions"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { getMovieLore, getEntryTitle, getLoreDescription, createShuffledIndices, getMovieProgress } from "./movies-utils"
import { getMovieHeroArt, heroArtFromUrl, DEFAULT_MOVIE_FOCAL, POSTER_FOCAL } from "@/lib/config/hero-art"
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { HeroCarouselDots } from "@/components/ui/spotlight/hero-carousel-dots"
import { HeroMetaLine } from "@/components/ui/spotlight/hero-meta-line"

interface MoviesHeroProps {
    topFeatured: MovieEntry[]
    debouncedMovie: MovieEntry | null
    handleMovieClick: (mediaId: number) => void
    watchHistory?: Continuity_WatchHistory
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId | "all") => void
    onHoverSound: () => void
    isLoading?: boolean
    /** false = la biblioteca no tiene ninguna película (distinto de "esta era no tiene"). */
    libraryHasMovies?: boolean
}

export function MoviesHero({
    topFeatured,
    debouncedMovie,
    handleMovieClick,
    watchHistory,
    activeEraId,
    categorizedData,
    onSelectEra,
    onHoverSound,
    isLoading = false,
    libraryHasMovies = true,
}: MoviesHeroProps) {
    const navigate = useNavigate()
    const [featuredIndex, setFeaturedIndex] = useState(0)
    const [, setShuffleQueue] = useState<number[]>([])
    const [isHeroHovered, setIsHeroHovered] = useState(false)
    const motionTier = useMotionTier()
    const hideAudienceScore = useHideAudienceScore()
    const allowCinematicMotion = motionTier === "full"

    // Identificador estable de la colección para detectar cambios reales de era o filtro
    const topFeaturedIds = useMemo(() => topFeatured.map((m, idx) => m.mediaId ?? idx).join(","), [topFeatured])

    // Entrada aleatoria y nueva cola shuffle al cambiar de era / colección de películas
    const [prevFeaturedIds, setPrevFeaturedIds] = useState(topFeaturedIds)
    if (topFeaturedIds !== prevFeaturedIds) {
        setPrevFeaturedIds(topFeaturedIds)
        const len = topFeatured.length
        if (len <= 1) {
            setFeaturedIndex(0)
            setShuffleQueue([])
        } else {
            const queue = createShuffledIndices(len)
            const initialIdx = queue.shift() ?? 0
            setShuffleQueue(queue)
            setFeaturedIndex(initialIdx)
        }
    }

    // Avance aleatorio sin repetición (cola shuffle). Lo dispara la barra de
    // progreso de los dots al llenarse; con reduced-motion no hay rotación.
    const advanceShuffle = useCallback(() => {
        setShuffleQueue((currentQueue) => {
            const len = topFeatured.length
            if (len <= 1) {
                setFeaturedIndex(0)
                return []
            }

            let queue = [...currentQueue]
            if (queue.length === 0) {
                queue = createShuffledIndices(len, featuredIndex)
            }

            let nextIdx = queue.shift() ?? 0
            if (nextIdx === featuredIndex && len > 1) {
                if (queue.length === 0) {
                    queue = createShuffledIndices(len, featuredIndex)
                }
                nextIdx = queue.shift() ?? 0
            }

            setFeaturedIndex(nextIdx)
            return queue
        })
    }, [topFeatured.length, featuredIndex])

    const handleSelectSlide = useCallback((index: number) => {
        setFeaturedIndex(index)
    }, [])

    const defaultFeatured = topFeatured[featuredIndex] ?? topFeatured[0] ?? null
    const currentMovie = debouncedMovie ?? defaultFeatured
    const displayMedia = currentMovie?.media
    // Color de era canónico (paridad Home): ERA_COLOR_MAP por EraId.
    // Si el filtro es "all", el halo sigue a la película visible.
    const currentEraId: EraId = currentMovie?.eraId ?? (activeEraId !== "all" ? activeEraId : "dbz")
    const currentColors = ERA_COLOR_MAP[currentEraId]
    // Neutro: el color de saga queda solo en el punto de la era (identidad); filete, brillo y aura van en gris.
    const isClassic = useIsClassicMode()
    const currentEraLabel = ERAS.find(e => e.id === currentEraId)?.title ?? "Dragon Ball"

    // Progreso: misma regla que la tarjeta y los filtros (getMovieProgress).
    const watchItem = currentMovie?.mediaId ? watchHistory?.[currentMovie.mediaId] : null
    const { isCompleted, hasProgress, progressPercent } = getMovieProgress(currentMovie, watchItem)
    const watchDuration = watchItem?.duration || 0
    const remainingMinutes = hasProgress && watchDuration > 0
        ? Math.max(1, Math.round((watchDuration - (watchItem?.currentTime || 0)) / 60))
        : null
    // El runtime de la ficha viene en 0 en muchas películas: se completa con la duración del historial.
    const runtimeMinutes = (displayMedia?.runtime ?? 0) > 0
        ? displayMedia?.runtime ?? 0
        : watchDuration > 0 ? Math.round(watchDuration / 60) : 0
    const hasLocalFiles = (currentMovie?.libraryData?.mainFileCount || 0) > 0

    const heroArt = getMovieHeroArt({
        mediaId: currentMovie?.mediaId,
        tmdbId: displayMedia?.tmdbId,
        bannerImage: displayMedia?.bannerImage,
        posterImage: displayMedia?.posterImage,
    }) ?? (displayMedia?.bannerImage ? heroArtFromUrl(displayMedia.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)
    const backdropSrc = heroArt?.src ?? null
    const posterSrc = displayMedia?.posterImage ?? null
    // Si no hay backdrop horizontal ni banner, usamos poster como fallback visual seguro
    const visualArt = heroArt ?? (posterSrc ? heroArtFromUrl(posterSrc, { focal: POSTER_FOCAL, subject: "center", aspect: 2 / 3, safeTop: 100 }) : null)
    // Global solo con banner 16:9 widescreen auténtico (nunca la portada vertical)
    const bannerSrc = backdropSrc
    useHeroBackdrop(bannerSrc)

    const lore = useMemo(() => getMovieLore(currentMovie), [currentMovie])

    const plainDescription = useMemo(() => {
        const loreSynopsis = getLoreDescription(lore)
        const rawDesc = displayMedia?.description
        const isDescriptionEnglish = rawDesc && /^(the|after|when|with|in\s+the|during|a\s+|goku\b)/i.test(rawDesc.trim())
        if (!rawDesc || isDescriptionEnglish) {
            return stripHtml(loreSynopsis || rawDesc || "") || null
        }
        return stripHtml(rawDesc) || stripHtml(loreSynopsis || "") || null
    }, [displayMedia?.description, lore])

    const movieTitle = useMemo(() => {
        if (!currentMovie) return ""
        const raw = getEntryTitle(currentMovie) || lore?.title || "Película"
        return cleanMovieTitle(raw)
    }, [currentMovie, lore])

    // El botón confirma en el lugar (lista → ✓) además del toast.
    const [justQueued, flashQueued] = useTransientFlag(1600)

    const handleAddToQueue = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentMovie?.mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(currentMovie.mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                useQueueStore.getState().addToQueue({
                    id: currentMovie.mediaId,
                    title: movieTitle,
                    playableUrl: localFile.path,
                    thumbnail: getMediumResImage(displayMedia?.posterImage || ""),
                    mediaId: currentMovie.mediaId,
                    episodeNumber: 1,
                    malId: displayMedia?.idMal ?? null,
                    mediaFormat: displayMedia?.format ?? "MOVIE",
                })
                flashQueued()
                toast.success("Añadida a Mi Lista", {
                    description: movieTitle,
                })
            } else {
                toast.info("Esta película no tiene archivos locales para reproducir.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        }
    }

    // Metadatos en una línea: formato (solo si no es "Película") · año · min · era · valoración · estado.
    const formatLabel = getFormatLabel(displayMedia?.format, "Película")
    const score = displayMedia?.score ?? 0
    const rating = !hideAudienceScore && score > 0 ? (score / 10).toFixed(1) : null
    const metaItems: React.ReactNode[] = [
        formatLabel !== "Película" ? formatLabel : null,
        displayMedia?.year ? String(displayMedia.year) : null,
        runtimeMinutes > 0 ? `${runtimeMinutes} min` : null,
        rating ? <span key="rating">★ {rating}</span> : null,
        isCompleted ? (
            <span key="seen" className="inline-flex items-center gap-1 text-status-success font-semibold">
                <IconUiCheck className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> Visto
            </span>
        ) : null,
    ].filter(Boolean)

    const moreItems = [
        { label: "Ver en la Cronología", onSelect: () => { void navigate({ to: "/chronology", search: { era: currentEraId } }) } },
        ...(activeEraId === "all"
            ? [{ label: `Ver las películas de ${currentEraLabel}`, onSelect: () => onSelectEra(currentEraId) }]
            : []),
    ]

    return (
        <section
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
            aria-label="Película destacada"
            className="relative w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-nav pb-8 select-none flex flex-col justify-start space-y-4"
        >
            {/* Ambient Aura Background */}
            <div className={HERO_AURA_CLASS}>
                {/* AnimatePresence (sync): fundido cruzado entre auras, sin bache de luz.
                    Solo opacidad (sin scale sobre la capa con blur); 0.32 es el único valor
                    destino. 0.5 s = --duration-very-slow, curva --ease-smooth-out. */}
                <AnimatePresence initial={false}>
                    {backdropSrc && currentMovie && (
                        <m.div
                            key={currentMovie.mediaId + "_outer_aura"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.32 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute -inset-16 pointer-events-none overflow-hidden"
                            style={{
                                backgroundImage: `url(${localImage(getLowResImage(backdropSrc))})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center 20%",
                                filter: isClassic ? "blur(48px) saturate(15%)" : "blur(48px) saturate(140%)",
                                maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                                WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Sin orbe de era: el color llega solo por el tinte de fondo de arriba. */}
            </div>

            {/* 1. Filtro de era: riel fijo (portal), no ocupa una franja del flujo */}
            <SpotlightEraNav
                activeEraId={activeEraId}
                categorizedData={categorizedData}
                onSelectEra={onSelectEra}
                onHoverSound={onHoverSound}
                showAllOption
            />

            {/* 2. Escenario del hero */}
            <div className="relative z-10 w-full">
                <LoadSwap
                    loading={isLoading && !currentMovie}
                    skeleton={
                        // Misma caja que el escenario real: sin salto al llegar los datos.
                        <div
                            className={cn("w-full relative rounded-hero overflow-hidden border border-outline-variant bg-bg-primary animate-pulse", HERO_STAGE_CLASS)}
                            role="status"
                            aria-label="Cargando películas destacadas"
                        />
                    }
                >
                    {!currentMovie ? (
                        <div
                            className="w-full relative rounded-hero overflow-hidden min-h-[320px] sm:min-h-[360px] md:min-h-[400px] flex items-center justify-center border border-outline-variant shadow-hero bg-bg-primary transition-colors duration-700 p-6"
                            style={{
                                borderColor: isClassic ? "var(--neutral-separator)" : `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                            }}
                        >
                            <EmptyState
                                headingLevel="h2"
                                title={libraryHasMovies ? "No hay películas en esta era" : "Tu biblioteca no tiene películas todavía"}
                                message={libraryHasMovies
                                    ? `No hay películas de ${currentEraLabel} en tu biblioteca. Prueba con otra era.`
                                    : "Añade las carpetas con tus películas en Ajustes y escanea la biblioteca para verlas aquí."}
                                action={libraryHasMovies ? undefined : (
                                    <Link
                                        to="/settings"
                                        search={{ tab: "library" }}
                                        className={ButtonAnatomy.root({ intent: "primary", size: "lg" })}
                                    >
                                        Ir a Ajustes
                                    </Link>
                                )}
                            />
                        </div>
                    ) : (
                        <div
                            className={`w-full relative rounded-hero overflow-hidden ${HERO_STAGE_CLASS} flex flex-col justify-end border border-outline-variant shadow-hero bg-bg-primary transition-colors duration-700`}
                            style={{
                                borderColor: isClassic ? "var(--neutral-separator)" : `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                            }}
                        >
                        {/* Arte a sangre con fundido cinematográfico */}
                        <AnimatePresence mode="popLayout">
                            <m.div
                                key={currentMovie.mediaId + "_visual"}
                                variants={heroBackdropFadeVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-hero-base"
                            >
                                {visualArt && (
                                    <>
                                        {/* 1. Base negra cinematográfica: evita wash plano si la imagen tarda/falla */}
                                         <div className="absolute inset-0 w-full h-full bg-black pointer-events-none" />
                                          {/* 2. Capa nítida: encuadre por punto focal + safeTop y halo líquido en la esquina del platter */}
                                          <HeroBackdrop
                                              art={visualArt}
                                              alt={movieTitle}
                                              scrims
                                              imgClassName="hero-image-filter"
                                          />
                                    </>
                                )}

                            </m.div>
                        </AnimatePresence>

                        {/* Contenido Cinematográfico Natural: flota directamente con respiro y jerarquía */}
                        <div className="relative z-hero-content flex flex-wrap items-end justify-between p-6 sm:p-8 md:p-10 lg:p-12 gap-6 w-full pointer-events-none">
                            <div className="flex flex-col gap-3.5 w-full max-w-2xl pointer-events-auto text-left">
                                <AnimatePresence mode="wait" initial={false}>
                                    <m.div
                                        key={currentMovie.mediaId + "_content"}
                                        variants={allowCinematicMotion ? heroContainerVariants : undefined}
                                        initial={allowCinematicMotion ? "hidden" : { opacity: 0 }}
                                        animate={allowCinematicMotion ? "visible" : { opacity: 1, transition: { duration: 0.25 } }}
                                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                        className="flex flex-col gap-3 transform-gpu will-change-transform text-left w-full"
                                    >
                                        {/* Eyebrow Pill de la Era */}
                                        <m.div variants={heroFadeOnlyVariants} className="flex items-center gap-2">
                                            <span
                                                className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border backdrop-blur-md"
                                                style={{
                                                    backgroundColor: `color-mix(in srgb, ${currentColors.accent} 18%, transparent)`,
                                                    borderColor: `color-mix(in srgb, ${currentColors.accent} 35%, transparent)`,
                                                    color: currentColors.accent,
                                                }}
                                            >
                                                {currentEraLabel}
                                            </span>
                                            {displayMedia?.year ? (
                                                <span className="hidden sm:inline text-xs text-white/70 font-medium [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                                                    · {displayMedia.year}
                                                </span>
                                            ) : null}
                                        </m.div>

                                        <m.h1
                                            variants={heroItemVariants}
                                            className="font-display font-extrabold text-hero-title tracking-tight leading-[1.04] text-white select-none text-balance line-clamp-2 text-edge-glow"
                                        >
                                            {movieTitle}
                                        </m.h1>

                                        {/* Metadatos en una línea */}
                                        <HeroMetaLine items={metaItems} variants={heroFadeOnlyVariants} />

                                        {plainDescription && (
                                            <m.p
                                                variants={heroItemVariants}
                                                className="text-on-surface/90 text-xs sm:text-sm md:text-base leading-relaxed font-normal select-none line-clamp-3 text-pretty max-w-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                                            >
                                                {plainDescription}
                                            </m.p>
                                        )}
                                    </m.div>
                                </AnimatePresence>

                                {/* Acción principal + acciones redondas */}
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <PrimaryPlayButton
                                        label={hasProgress ? "Continuar" : isCompleted ? "Ver de nuevo" : "Ver película"}
                                        detail={remainingMinutes ? `quedan ${remainingMinutes} min` : null}
                                        onClick={() => {
                                            if (currentMovie.mediaId == null) return
                                            handleMovieClick(currentMovie.mediaId)
                                        }}
                                    />

                                    {/* Secundarias sobre imagen: `glass` (ghost/outline no se leen sobre pósters claros). */}
                                    {hasLocalFiles && (
                                        <RoundAction
                                            label={justQueued ? "Añadida a Mi Lista" : "Añadir a Mi Lista"}
                                            onClick={handleAddToQueue}
                                            icon={
                                                <IconSwap swapKey={justQueued ? "queued" : "add"}>
                                                    {justQueued ? <IconUiCheck className="h-5 w-5" /> : <IconUiListPlus className="h-5 w-5" />}
                                                </IconSwap>
                                            }
                                        />
                                    )}
                                    <MoreActionsMenu items={moreItems} />
                                </div>

                                {hasProgress && (
                                    <div className="w-full max-w-sm pointer-events-none">
                                        <ResumeProgress percent={progressPercent} label={`${progressPercent} % visto`} />
                                    </div>
                                )}
                            </div>

                            {/* Puntos del carrusel (compartidos con Inicio) */}
                            <div className="pointer-events-auto ml-auto">
                                <HeroCarouselDots
                                    count={topFeatured.length}
                                    activeIndex={featuredIndex}
                                    onSelect={handleSelectSlide}
                                    getLabel={(i) => `Ir a película ${i + 1} de ${topFeatured.length}`}
                                    accentColor={currentColors?.accent}
                                    getAccentColor={(i) => ERA_COLOR_MAP[topFeatured[i]?.eraId ?? currentEraId]?.accent}
                                    getPeekTitle={(i) => {
                                        const entry = topFeatured[i]
                                        if (!entry) return undefined
                                        return cleanMovieTitle(getEntryTitle(entry) || getMovieLore(entry)?.title || "Película")
                                    }}
                                    paused={isHeroHovered || !!debouncedMovie}
                                    showProgress={allowCinematicMotion}
                                    onCycleComplete={advanceShuffle}
                                />
                            </div>
                        </div>
                    </div>
                    )}
                </LoadSwap>
            </div>
        </section>
    )
}
