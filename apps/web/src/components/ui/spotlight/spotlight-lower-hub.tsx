import * as React from "react"
import { m, useReducedMotion } from "framer-motion"
import { IconNavigationLayers, IconNavigationFilm } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { SpotlightSagaCard } from "./spotlight-saga-card"
import { SpotlightMovieCard } from "./spotlight-movie-card"
import { resolveSagaDynamicThumbnail } from "../media-spotlight-helpers"
import type { SwimlaneItem } from "@/components/ui/swimlane"

type LowerHubTab = "sagas" | "movies"

export interface SpotlightLowerHubProps {
    activeEraId: EraId
    colors: typeof ERA_COLOR_MAP[EraId]
    activeEraSagas: SagaDefinition[]
    activeEraMovies: SwimlaneItem[]
    activeSeries: SwimlaneItem | null
    activeEraSeriesId: number
    activeAnimeEntry?: import("@/api/generated/types").Anime_Entry
    serverBase: string
    onNavigateSaga: (seriesId: number, sagaId: string) => void
    onNavigateMovie: (item: SwimlaneItem) => void
    onHoverSound: () => void
}

export const SpotlightLowerHub = React.memo(function SpotlightLowerHub({
    activeEraId,
    colors,
    activeEraSagas,
    activeEraMovies,
    activeSeries,
    activeEraSeriesId,
    activeAnimeEntry,
    serverBase,
    onNavigateSaga,
    onNavigateMovie,
    onHoverSound,
}: SpotlightLowerHubProps) {
    const reduceMotion = useReducedMotion()
    const tabIndicatorSpring = useSpringPreset("tabIndicator")
    const tabContentSpring = useSpringPreset("tabContent")
    const hasSagas = activeEraSagas.length > 0
    const hasMovies = activeEraMovies.length > 0
    const [activeTab, setActiveTab] = React.useState<LowerHubTab>(hasSagas ? "sagas" : "movies")

    // Al cambiar de era, volver al tab con contenido (sagas primero, como antes).
    React.useEffect(() => {
        setActiveTab(hasSagas ? "sagas" : "movies")
    }, [activeEraId, hasSagas])
    // Precomputar miniaturas dinámicas para evitar filtrar cientos de episodios
    // en cada render individual dentro del bucle de activeEraSagas.map
    const sagaThumbnails = React.useMemo(() => {
        if (!activeEraSagas || activeEraSagas.length === 0) return {} as Record<string, string | null>
        const fallbackUrl = activeSeries?.backdropUrl || activeSeries?.image
        const episodes = activeAnimeEntry?.episodes
        const map: Record<string, string | null> = {}
        for (const saga of activeEraSagas) {
            map[saga.id] = resolveSagaDynamicThumbnail({
                saga,
                episodes,
                serverBase,
                fallbackUrl,
            })
        }
        return map
    }, [activeEraSagas, activeAnimeEntry?.episodes, serverBase, activeSeries?.backdropUrl, activeSeries?.image])

    // Sin sagas ni películas de la era no se muestra nada.
    if (!hasSagas && !hasMovies) return null

    const showSwitch = hasSagas && hasMovies

    return (
        <div
            className="relative z-10 text-left space-y-4 pt-1 w-full"
            // Acento de la era activa para iconos de pestaña.
            style={{
                "--spotlight-title-hover": colors.ambientGlow1,
            } as React.CSSProperties}
        >
            <SectionBar
                variant="minimal"
                label={activeTab === "sagas" ? "Sagas & Arcos" : "Películas de la Era"}
                icon={activeTab === "sagas" ? IconNavigationLayers : IconNavigationFilm}
                className="p-0 md:p-0"
                badge={
                    <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
                        {activeTab === "sagas" ? `${activeEraSagas.length} arcos` : `${activeEraMovies.length} películas`}
                    </span>
                }
            >
                {/* Switch Sagas / Películas (segmented control canónico) si ambos están disponibles */}
                {showSwitch && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-1 pt-1">
                        <div
                            role="tablist"
                            aria-label="Contenido de la era"
                            className="flex items-center gap-1 bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10 p-1.5 rounded-full backdrop-blur-overlay-xl"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "sagas"}
                                onClick={() => setActiveTab("sagas")}
                                onMouseEnter={onHoverSound}
                                className={cn(
                                    "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer select-none active:scale-95",
                                    activeTab === "sagas" ? "text-zinc-950 font-bold" : "text-on-surface-variant hover:text-on-surface",
                                )}
                            >
                                {activeTab === "sagas" && (
                                    reduceMotion ? (
                                        <div className="absolute inset-0 bg-white/95 rounded-full" />
                                    ) : (
                                        <m.div
                                            layoutId="spotlight-lower-hub-indicator"
                                            className="absolute inset-0 bg-white/95 rounded-full"
                                            transition={tabIndicatorSpring}
                                        />
                                    )
                                )}
                                <span className="relative z-10 flex items-center gap-2 font-mono font-bold uppercase tracking-wider">
                                    <IconNavigationLayers size={14} />
                                    <span>Sagas & Arcos ({activeEraSagas.length})</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "movies"}
                                onClick={() => setActiveTab("movies")}
                                onMouseEnter={onHoverSound}
                                className={cn(
                                    "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer select-none active:scale-95",
                                    activeTab === "movies" ? "text-zinc-950 font-bold" : "text-on-surface-variant hover:text-on-surface",
                                )}
                            >
                                {activeTab === "movies" && (
                                    reduceMotion ? (
                                        <div className="absolute inset-0 bg-white/95 rounded-full" />
                                    ) : (
                                        <m.div
                                            layoutId="spotlight-lower-hub-indicator"
                                            className="absolute inset-0 bg-white/95 rounded-full"
                                            transition={tabIndicatorSpring}
                                        />
                                    )
                                )}
                                <span className="relative z-10 flex items-center gap-2 font-mono font-bold uppercase tracking-wider">
                                    <IconNavigationFilm size={14} />
                                    <span>Películas ({activeEraMovies.length})</span>
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Grid de Sagas */}
                {activeTab === "sagas" && hasSagas && (
                    <m.div
                        key={`sagas-${activeEraId}`}
                        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={tabContentSpring}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1 pb-4 w-full"
                    >
                        {activeEraSagas.map((saga, idx) => (
                            <SpotlightSagaCard
                                key={saga.id}
                                saga={saga}
                                index={idx}
                                thumbnailUrl={sagaThumbnails[saga.id] ?? null}
                                seriesId={activeEraSeriesId}
                                colors={colors}
                                onNavigateSaga={onNavigateSaga}
                                onHover={onHoverSound}
                            />
                        ))}
                    </m.div>
                )}

                {/* Grid de Películas de la era */}
                {activeTab === "movies" && hasMovies && (
                    <m.div
                        key={`movies-${activeEraId}`}
                        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={tabContentSpring}
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 pt-1 pb-4 w-full"
                    >
                        {activeEraMovies.map((movie, idx) => (
                            <SpotlightMovieCard
                                key={movie.id}
                                movie={movie}
                                index={idx + 1}
                                colors={colors}
                                onNavigate={onNavigateMovie}
                                onHover={onHoverSound}
                            />
                        ))}
                    </m.div>
                )}
            </SectionBar>
        </div>
    )
})
