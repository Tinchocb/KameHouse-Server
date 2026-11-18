import React from "react"
import { cn } from "@/components/ui/core/styling"
import { CharacterCarousel } from "./character-carousel"
import { SagaSelector, stripFillerSuffix } from "./saga-selector"
import { PremiumEpisodeList } from "./premium-episode-list"
import { IconNavigationLayers } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
import type { SagaDTO, PremiumEpisode } from "@/api/types/series.types"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { Anime_Episode } from "@/api/generated/types"

interface SeriesEpisodesTabProps {
    sagas?: SagaDTO[]
    localSagas?: SagaDefinition[]
    sagasProgressMap?: Record<string, { watched: number; total: number; percent: number }>
    activeSagaId?: string
    activeSubSagaId?: string
    activeSaga?: SagaDTO
    activeSubSaga?: { startEp?: number; endEp?: number } | null
    episodeViewModels: PremiumEpisode[]
    isSagasSidebarCollapsed: boolean
    scrollElement: HTMLElement | null
    onSelectCharacter: (name: string) => void
    onOpenSagaPicker?: () => void
    onSelectSaga: (sagaId: string) => void
    onSelectSubSaga: (subSagaId: string) => void
    onToggleCollapseSidebar: () => void
    onPlayByNumber: (epNumber: number) => void
    onEpisodePreload?: (filePath: string) => void
    // New props for cinematic cards
    computedEpisodes?: Anime_Episode[]
    /** MediaId real de la serie para la cola (ver PremiumEpisodeList). */
    seriesMediaId?: number
}

export const SeriesEpisodesTab = React.memo(function SeriesEpisodesTab({
    sagas,
    localSagas,
    sagasProgressMap,
    activeSagaId,
    activeSubSagaId,
    activeSaga,
    activeSubSaga,
    episodeViewModels,
    isSagasSidebarCollapsed,
    scrollElement,
    onSelectCharacter,
    onOpenSagaPicker,
    onSelectSaga,
    onSelectSubSaga,
    onToggleCollapseSidebar,
    onPlayByNumber,
    onEpisodePreload,
    computedEpisodes = [],
    seriesMediaId,
}: SeriesEpisodesTabProps) {
    const isMinimalist = useIsMinimalistMode()
    const sagaSidebarRef = React.useRef<HTMLDivElement>(null)
    // SAGAS EN LA MITAD: sticky centrado vertical (50vh - h/2). El guard
    // max() evita top negativo cuando el panel es más alto que el viewport.
    const [stickyTopOffset, setStickyTopOffset] = React.useState("max(1.5rem, calc(50vh - 220px))")

    React.useEffect(() => {
        const el = sagaSidebarRef.current
        if (!el) return
        const updateOffset = () => {
            const h = el.offsetHeight
            if (h > 0) {
                setStickyTopOffset(`max(1.5rem, calc(50vh - ${Math.round(h / 2)}px))`)
            }
        }
        updateOffset()
        const ro = new ResizeObserver(updateOffset)
        ro.observe(el)
        window.addEventListener("resize", updateOffset, { passive: true })
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", updateOffset)
        }
    }, [isSagasSidebarCollapsed, sagas?.length])

    const handleClearSubSaga = React.useCallback(() => {
        onSelectSubSaga("")
    }, [onSelectSubSaga])

    return (
        <div key="episodes" className="space-y-8 lg:space-y-6">
            {/* Key Characters for this Saga (oculto en minimalista) */}
            {!isMinimalist && (
                <CharacterCarousel
                    sagaId={activeSaga?.id}
                    characters={activeSaga?.keyCharacters || []}
                    onSelect={onSelectCharacter}
                />
            )}

            {/* Selector de sagas compacto para ventanas angostas o split-screen */}
            {sagas && sagas.length > 1 && (
                <div className="sectionbar lg:hidden flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="sectionbar-header-icon">
                            <IconNavigationLayers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-widest block">Saga Seleccionada</span>
                            <span className="text-sm font-display font-bold text-on-surface uppercase tracking-wider truncate block">
                                {activeSaga?.name || "Seleccionar Saga"}
                            </span>
                        </div>
                    </div>
                    <Button
                        intent="outline"
                        size="sm"
                        onClick={onOpenSagaPicker}
                        className="shrink-0"
                    >
                        Cambiar
                    </Button>
                </div>
            )}

            {/* Episode Section Layout: Saga Selector (Desktop) + Episode List */}
            <div className="flex flex-col lg:flex-row gap-6 items-start relative">
                {sagas && sagas.length > 1 && (
                    <div
                        ref={sagaSidebarRef}
                        style={{ top: isMinimalist ? "24px" : stickyTopOffset }}
                        className={cn(
                            "hidden lg:block shrink-0 sticky self-start z-20",
                            isMinimalist ? "w-64 xl:w-72" : "w-80 xl:w-[340px] max-h-[calc(100dvh-6rem)]"
                        )}
                    >
                        <SagaSelector
                            sagas={sagas}
                            localSagas={localSagas}
                            sagasProgressMap={sagasProgressMap}
                            activeSagaId={activeSagaId}
                            onSelectSaga={onSelectSaga}
                            activeSubSagaId={activeSubSagaId}
                            onSelectSubSaga={onSelectSubSaga}
                            isCollapsed={isSagasSidebarCollapsed}
                            onToggleCollapse={onToggleCollapseSidebar}
                            episodes={computedEpisodes}
                        />
                    </div>
                )}

                <div className="flex-1 min-w-0 w-full">
                    {isMinimalist && activeSaga && (
                        <div className="pb-3.5 border-b border-white/[0.08] mb-4">
                            <h3 className="text-lg font-bold text-white tracking-tight text-balance">
                                {stripFillerSuffix(activeSaga.name)}
                            </h3>
                        </div>
                    )}
                    <PremiumEpisodeList
                        activeSagaId={activeSagaId}
                        episodes={episodeViewModels}
                        activeSubSagaStart={activeSubSaga?.startEp}
                        activeSubSagaEnd={activeSubSaga?.endEp}
                        onPlay={onPlayByNumber}
                        onPreload={onEpisodePreload}
                        scrollElement={scrollElement}
                        seriesMediaId={seriesMediaId}
                        onClearSubSaga={handleClearSubSaga}
                    />
                </div>
            </div>
        </div>
    )
})
