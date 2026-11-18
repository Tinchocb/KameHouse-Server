import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useIsClassicMode, useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
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
import { getMediumResImage, getLowResImage, localImage, prewarmImages } from "@/lib/helpers/images"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { HeroContent } from "@/components/ui/spotlight/hero-content"
import { HeroBackdrop } from "@/components/ui/spotlight/hero-backdrop"
import { useQueueStore } from "@/lib/store"
import {
    useMotionTier,
    heroContainerVariants,
    heroItemVariants,
    heroBackdropFadeVariants,
    heroBackdropSubtleVariants,
} from "@/components/ui/kinetics"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { MoreActionsMenu, PrimaryPlayButton, ResumeProgress, RoundAction } from "@/components/media-detail/detail-actions"
import { getMovieLore, getEntryTitle, getLoreDescription, createShuffledIndices, getMovieProgress } from "./movies-utils"
import { getMovieHeroArt, heroArtFromUrl, DEFAULT_MOVIE_FOCAL, POSTER_FOCAL } from "@/lib/config/hero-art"
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { HeroCarouselDots } from "@/components/ui/spotlight/hero-carousel-dots"

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
    const allowCinematicMotion = motionTier === "full"

    // Identificador estable de la colección para detectar cambios reales de era o filtro
    const topFeaturedIds = useMemo(() => topFeatured.map((m, idx) => m.mediaId ?? idx).join(","), [topFeatured])

    // Precarga en reposo de las portadas del carrusel para transiciones instantáneas
    React.useEffect(() => {
        if (!topFeatured.length) return
        const urls = topFeatured.slice(0, 8).map(m => {
            const art = getMovieHeroArt({
                mediaId: m.mediaId,
                tmdbId: m.media?.tmdbId,
                bannerImage: m.media?.bannerImage,
                posterImage: m.media?.posterImage,
            })
            return art?.src ?? m.media?.bannerImage ?? null
        }).filter(Boolean)
        prewarmImages(urls)
    }, [topFeatured])

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
    }, [topFeatured.length, featuredIndex, setShuffleQueue, setFeaturedIndex])

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
    const isMinimalist = useIsMinimalistMode()
    const currentEraLabel = ERAS.find(e => e.id === currentEraId)?.title ?? "Dragon Ball"

    // Progreso: misma regla que la tarjeta y los filtros (getMovieProgress).
    const watchItem = currentMovie?.mediaId ? watchHistory?.[currentMovie.mediaId] : null
    const { isCompleted, hasProgress, progressPercent } = getMovieProgress(currentMovie, watchItem)
    const watchDuration = watchItem?.duration || 0
    const remainingMinutes = hasProgress && watchDuration > 0
        ? Math.max(1, Math.round((watchDuration - (watchItem?.currentTime || 0)) / 60))
        : null
    const hasLocalFiles = (currentMovie?.libraryData?.mainFileCount || 0) > 0

    // Argumentos en variable: React Compiler no admite ?. dentro de la prueba de un ??.
    const heroArtInput = {
        mediaId: currentMovie?.mediaId,
        tmdbId: displayMedia?.tmdbId,
        bannerImage: displayMedia?.bannerImage,
        posterImage: displayMedia?.posterImage,
    }
    const heroArtFromMedia = getMovieHeroArt(heroArtInput)
    const heroArt = heroArtFromMedia ?? (displayMedia?.bannerImage ? heroArtFromUrl(displayMedia.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)
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

    const handleAddToQueue = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentMovie?.mediaId) return
        // Promesa en vez de try/catch: el compilador de React no optimiza componentes con try.
        void fetchAnimeEntry(String(currentMovie.mediaId)).then((fullEntry) => {
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
        }).catch((err) => {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        })
    }

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
            {!isMinimalist && !isClassic && (
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
                                    filter: "blur(48px) saturate(140%)",
                                    maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                                    WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                                }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Sin orbe de era: el color llega solo por el tinte de fondo de arriba. */}
                </div>
            )}

            {/* 1. Filtro de era: riel fijo (portal), solo cuando hay películas en la biblioteca */}
            {libraryHasMovies && (
                <SpotlightEraNav
                    activeEraId={activeEraId}
                    categorizedData={categorizedData}
                    onSelectEra={onSelectEra}
                    onHoverSound={onHoverSound}
                    showAllOption
                />
            )}

            {/* 2. Escenario del hero */}
            <div className="relative z-10 w-full">
                <LoadSwap
                    loading={isLoading && !currentMovie}
                    skeleton={
                        // Misma caja que el escenario real: sin salto al llegar los datos.
                        <Skeleton
                            className={cn("w-full relative rounded-hero", HERO_STAGE_CLASS)}
                            role="status"
                            aria-label="Cargando películas destacadas"
                        />
                    }
                >
                    {!currentMovie ? (
                        <div
                            className={cn(
                                "w-full relative flex items-center justify-center p-6",
                                libraryHasMovies
                                    ? "rounded-hero overflow-hidden min-h-[320px] sm:min-h-[360px] md:min-h-[400px] border border-[var(--neutral-separator)] shadow-hero bg-bg-primary transition-colors duration-700"
                                    : "py-10"
                            )}
                            style={libraryHasMovies ? {
                                borderColor: isClassic ? "var(--neutral-separator)" : `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                            } : undefined}
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
                                        data-intent="primary"
                                        data-size="lg"
                                        className={cn(
                                            ButtonAnatomy.root({ intent: "primary", size: "lg" }),
                                            "transition-[transform,background-color,border-color,color,box-shadow,filter] duration-fast ease-out-strong motion-safe:active:scale-[0.97]"
                                        )}
                                    >
                                        Ir a Ajustes
                                    </Link>
                                )}
                            />
                        </div>
                    ) : (
                        <div
                            className={`w-full relative rounded-hero overflow-hidden ${HERO_STAGE_CLASS} flex flex-col justify-end border border-[var(--neutral-separator)] shadow-hero bg-bg-primary transition-colors duration-700`}
                            style={{
                                borderColor: isClassic ? "var(--neutral-separator)" : `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                            }}
                        >
                        {/* Arte a sangre con fundido cinematográfico */}
                        <AnimatePresence mode="sync">
                            <m.div
                                key={currentMovie.mediaId + "_visual"}
                                variants={allowCinematicMotion ? heroBackdropFadeVariants : heroBackdropSubtleVariants}
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
                        <div className="relative z-hero-content flex flex-col justify-end p-5 sm:p-6 md:p-8 space-y-2.5 w-full pointer-events-none">
                            <div className="grid w-full max-w-sm sm:max-w-md lg:max-w-hero-content">
                                <AnimatePresence mode="sync" initial={false}>
                                    <HeroContent
                                        key={currentMovie.mediaId + "_content"}
                                        variants={allowCinematicMotion ? heroContainerVariants : undefined}
                                        initial={allowCinematicMotion ? "hidden" : { opacity: 0 }}
                                        animate={allowCinematicMotion ? "visible" : { opacity: 1, transition: { duration: 0.35, ease: "easeInOut" } }}
                                        exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeInOut" } }}
                                        className="flex flex-col space-y-2.5 text-left w-full pointer-events-auto"
                                        style={{
                                            "--spotlight-title-hover": isClassic ? "var(--label-1)" : (currentColors?.accent ?? "var(--brand-accent)"),
                                        } as React.CSSProperties}
                                    >
                                        <m.h1
                                            variants={heroItemVariants}
                                            className="hero-title font-display font-extrabold text-hero-title tracking-tight leading-[1.04] text-white select-none text-balance line-clamp-2 text-edge-glow"
                                        >
                                            <span
                                                role="link"
                                                tabIndex={0}
                                                aria-label={`Ver ${movieTitle}`}
                                                onClick={() => {
                                                    if (currentMovie.mediaId != null) {
                                                        handleMovieClick(currentMovie.mediaId)
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault()
                                                        if (currentMovie.mediaId != null) {
                                                            handleMovieClick(currentMovie.mediaId)
                                                        }
                                                    }
                                                }}
                                                className="cursor-pointer hover:text-[var(--spotlight-title-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                            >
                                                {movieTitle}
                                            </span>
                                        </m.h1>

                                        {plainDescription && (
                                            <m.p
                                                variants={heroItemVariants}
                                                className="hero-synopsis text-on-surface/90 text-xs sm:text-sm font-normal max-w-xl leading-relaxed select-none line-clamp-3 text-pretty drop-shadow"
                                            >
                                                {plainDescription}
                                            </m.p>
                                        )}

                                        {hasProgress && (
                                            <div className="w-full max-w-sm pointer-events-none pt-0.5">
                                                <ResumeProgress percent={progressPercent} label={`${progressPercent} % visto`} />
                                            </div>
                                        )}
                                    </HeroContent>
                                </AnimatePresence>
                            </div>

                            {/* Fila de acciones y dots unificada */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full pointer-events-auto">
                                <div className="hero-actions flex flex-wrap items-center gap-3">
                                    <PrimaryPlayButton
                                        className="spotlight-play-cta"
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

                                {/* Puntos del carrusel */}
                                <div className="pointer-events-auto ml-auto">
                                    <HeroCarouselDots
                                        count={topFeatured.length}
                                        activeIndex={featuredIndex}
                                        onSelect={handleSelectSlide}
                                        getLabel={(i) => `Ir a película ${i + 1} de ${topFeatured.length}`}
                                        accentColor={isClassic ? "var(--label-1)" : currentColors?.accent}
                                        getAccentColor={isClassic ? () => "var(--label-1)" : (i) => ERA_COLOR_MAP[topFeatured[i]?.eraId ?? currentEraId]?.accent}
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
                    </div>
                    )}
                </LoadSwap>
            </div>
        </section>
    )
}
