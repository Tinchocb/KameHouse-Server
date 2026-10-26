import * as React from "react"
import { m, AnimatePresence, type Variants } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationLayers, IconNavigationFilm } from "@/components/ui/icons";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control"
import { ElasticCounter, useMotionTier } from "@/components/ui/kinetics"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { SpotlightSagaCard } from "./spotlight-saga-card"
import { SpotlightMovieCard } from "./spotlight-movie-card"
import { resolveSagaDynamicThumbnail } from "../media-spotlight-helpers"
import type { SwimlaneItem } from "@/components/ui/swimlane"

type LowerHubTab = "sagas" | "movies"

/**
 * Grid del hub (tier full). El contenedor solo desliza en la dirección del
 * cambio (custom: -1/1 al cambiar era o pestaña, 0 en la primera aparición);
 * la cascada la ponen las cards con gridItemVariants, que ya traen su propio
 * delay acotado a min(i, 12) · 40ms, por eso no hace falta staggerChildren.
 */
const hubGridVariants: Variants = {
    hidden: (dir: number = 0) => ({ opacity: 0, x: dir * 16 }),
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            x: { type: "spring", stiffness: 280, damping: 28 },
            opacity: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
        },
    },
    exit: (dir: number = 0) => ({
        opacity: 0,
        x: dir * -16,
        transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
    }),
}

/** Primera aparición al entrar en pantalla (el hub suele quedar bajo el pliegue). */
const HUB_VIEWPORT = { once: true, margin: "-80px" } as const

/** subtle/off: sin desplazamiento ni cascada, solo fundido corto. */
const hubGridFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15, ease: "easeOut" },
} as const

interface SpotlightLowerHubProps {
    activeEraId: EraId
    /** Sentido del último cambio de era (1 adelante, -1 atrás). */
    direction?: number
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
    direction = 1,
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
    const hubId = React.useId()
    const panelId = `${hubId}-panel`
    const isFullMotion = useMotionTier() === "full"
    const hasSagas = activeEraSagas.length > 0
    const hasMovies = activeEraMovies.length > 0
    const [activeTab, setActiveTab] = React.useState<LowerHubTab>(hasSagas ? "sagas" : "movies")
    // Sentido del slide del grid: 0 en la primera aparición, luego el del último cambio.
    const [slideDir, setSlideDir] = React.useState(0)

    const hubOptions = React.useMemo<SegmentedOption<LowerHubTab>[]>(() => [
        {
            value: "sagas",
            id: `${hubId}-sagas`,
            panelId,
            label: "Sagas y arcos",
            icon: <IconNavigationLayers size={14} />,
            count: activeEraSagas.length,
        },
        {
            value: "movies",
            id: `${hubId}-movies`,
            panelId,
            label: "Películas",
            icon: <IconNavigationFilm size={14} />,
            count: activeEraMovies.length,
        },
    ], [hubId, panelId, activeEraSagas.length, activeEraMovies.length])

    // Al cambiar de era, volver al tab con contenido (sagas primero, como antes).
    // Se ajusta durante el render (no en un efecto): así el grid de la era nueva
    // monta ya con su pestaña, sin un frame intermedio con la pestaña vieja.
    const eraKey = `${activeEraId}:${hasSagas}`
    const [prevEraKey, setPrevEraKey] = React.useState(eraKey)
    if (prevEraKey !== eraKey) {
        setPrevEraKey(eraKey)
        setActiveTab(hasSagas ? "sagas" : "movies")
        if (!prevEraKey.startsWith(`${activeEraId}:`)) setSlideDir(direction >= 0 ? 1 : -1)
    }

    const selectTab = (tab: LowerHubTab) => {
        if (tab === activeTab) return
        // Películas está a la derecha de Sagas: el contenido entra desde ese lado.
        setSlideDir(tab === "movies" ? 1 : -1)
        setActiveTab(tab)
    }
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

    // Labels (no objetos) en full: así las cards heredan hidden/visible y hacen
    // la cascada con su gridItemVariants; en subtle/off el objeto corta la herencia.
    const gridMotion = isFullMotion
        ? {
              custom: slideDir,
              variants: hubGridVariants,
              initial: "hidden",
              whileInView: "visible",
              exit: "exit",
              viewport: HUB_VIEWPORT,
          }
        : hubGridFade

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
                label={activeTab === "sagas" ? "Sagas y arcos" : "Películas de la era"}
                icon={activeTab === "sagas" ? IconNavigationLayers : IconNavigationFilm}
                className="p-0 md:p-0"
                badge={
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-[var(--neutral-elev-1)] text-on-surface-variant border border-[var(--neutral-separator)]">
                        <ElasticCounter
                            value={activeTab === "sagas" ? activeEraSagas.length : activeEraMovies.length}
                            className="font-bold"
                        />{" "}
                        {activeTab === "sagas"
                            ? (activeEraSagas.length === 1 ? "arco" : "arcos")
                            : (activeEraMovies.length === 1 ? "película" : "películas")}
                    </span>
                }
            >
                {/* Switch Sagas / Películas (segmented control canónico) si ambos están disponibles */}
                {showSwitch && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-1 pt-1">
                        <SegmentedControl<LowerHubTab>
                            aria-label="Contenido de la era"
                            layoutId="spotlight-lower-hub-indicator"
                            semantics="tablist"
                            tone="neutral"
                            surface="glass"
                            value={activeTab}
                            onChange={selectTab}
                            onOptionHover={onHoverSound}
                            options={hubOptions}
                        />
                    </div>
                )}

                {/* popLayout: el grid saliente sale del flujo y el entrante ocupa su
                    lugar en el mismo frame (sin hueco ni salto de altura entre eras).
                    El wrapper relative es el ancla del saliente y deja los márgenes
                    y bordes de SectionBar en él, no en los grids. */}
                <div
                    id={panelId}
                    role={showSwitch ? "tabpanel" : undefined}
                    aria-labelledby={showSwitch ? `${hubId}-${activeTab}` : undefined}
                    tabIndex={showSwitch ? 0 : undefined}
                    className="relative w-full"
                >
                    <AnimatePresence mode="popLayout" custom={slideDir}>
                        {activeTab === "sagas" && hasSagas && (
                            <m.div
                                key={`sagas-${activeEraId}`}
                                {...gridMotion}
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

                        {activeTab === "movies" && hasMovies && (
                            <m.div
                                key={`movies-${activeEraId}`}
                                {...gridMotion}
                                className={cn(
                                    "pt-1 pb-4 w-full",
                                    activeEraMovies.length <= 6
                                        ? "flex flex-col sm:flex-row gap-3.5 h-auto sm:h-[320px] md:h-[350px]"
                                        : "flex gap-3.5 overflow-x-auto no-scrollbar snap-x h-auto sm:h-[320px] md:h-[350px]"
                                )}
                            >
                                {activeEraMovies.map((movie, idx) => (
                                    <SpotlightMovieCard
                                        key={movie.id}
                                        movie={movie}
                                        index={idx + 1}
                                        colors={colors}
                                        onNavigate={onNavigateMovie}
                                        onHover={onHoverSound}
                                        className={cn(
                                            "push-slot",
                                            activeEraMovies.length <= 6
                                                ? "flex-1 sm:[@media(hover:hover)_and_(pointer:fine)]:hover:flex-[2.15] transition-[flex,transform] duration-300 ease-smooth-out h-full"
                                                : "w-[160px] md:w-[180px] shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:w-[310px] md:[@media(hover:hover)_and_(pointer:fine)]:hover:w-[340px] transition-[width,transform] duration-300 ease-smooth-out snap-start h-full"
                                        )}
                                    />
                                ))}
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </SectionBar>
        </div>
    )
})
