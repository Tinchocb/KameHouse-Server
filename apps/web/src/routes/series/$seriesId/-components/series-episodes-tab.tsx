import React from "react"
import { CharacterCarousel } from "./character-carousel"
import { SagaSelector } from "./saga-selector"
import { PremiumEpisodeList } from "./premium-episode-list"
import { IconNavigationLayers } from "@/components/ui/icons";
import type { SagaDTO, PremiumEpisode } from "@/api/types/series.types"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"

interface SeriesEpisodesTabProps {
    sagas?: SagaDTO[]
    localSagas?: SagaDefinition[]
    chronologySeriesId?: string
    sagasProgressMap?: Record<string, { watched: number; total: number; percent: number }>
    activeSagaId?: string
    activeSubSagaId?: string
    activeSaga?: SagaDTO
    activeSubSaga?: { startEp?: number; endEp?: number } | null
    episodeViewModels: PremiumEpisode[]
    sagaProgress: { watched: number; total: number; percent: number }
    fillerStats: { filler: number; total: number; percent: number }
    isSagasSidebarCollapsed: boolean
    scrollElement: HTMLElement | null
    onSelectCharacter: (name: string) => void
    onOpenMobileSagas: () => void
    onSelectSaga: (sagaId: string) => void
    onSelectSubSaga: (subSagaId: string) => void
    onToggleCollapseSidebar: () => void
    onPlayByNumber: (epNumber: number) => void
    onEpisodePreload?: (filePath: string) => void
}

export function SeriesEpisodesTab({
    sagas,
    localSagas,
    chronologySeriesId,
    sagasProgressMap,
    activeSagaId,
    activeSubSagaId,
    activeSaga,
    activeSubSaga,
    episodeViewModels,
    sagaProgress,
    fillerStats,
    isSagasSidebarCollapsed,
    scrollElement,
    onSelectCharacter,
    onOpenMobileSagas,
    onSelectSaga,
    onSelectSubSaga,
    onToggleCollapseSidebar,
    onPlayByNumber,
    onEpisodePreload,
}: SeriesEpisodesTabProps) {
    return (
        <div key="episodes" className="space-y-8 animate-fade-in">
            {/* Key Characters for this Saga */}
            <CharacterCarousel
                characters={activeSaga?.keyCharacters || []}
                onSelect={onSelectCharacter}
            />

            {/* Mobile Saga Selector Trigger Button */}
            {sagas && sagas.length > 1 && (
                <div className="sectionbar lg:hidden flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="sectionbar-header-icon">
                            <IconNavigationLayers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest block">Saga Seleccionada</span>
                            <span className="text-sm font-display font-bold text-on-surface uppercase tracking-wider truncate block">
                                {activeSaga?.name || "Seleccionar Saga"}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenMobileSagas}
                        className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono font-bold uppercase tracking-wider text-white active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                        Cambiar
                    </button>
                </div>
            )}

            {/* Episode Section Layout: Saga Selector (Desktop) + Episode List */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {sagas && sagas.length > 1 && (
                    <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-4">
                        <SagaSelector
                            sagas={sagas}
                            localSagas={localSagas}
                            chronologySeriesId={chronologySeriesId}
                            sagasProgressMap={sagasProgressMap}
                            activeSagaId={activeSagaId}
                            onSelectSaga={onSelectSaga}
                            activeSubSagaId={activeSubSagaId}
                            onSelectSubSaga={onSelectSubSaga}
                            isCollapsed={isSagasSidebarCollapsed}
                            onToggleCollapse={onToggleCollapseSidebar}
                        />
                    </div>
                )}

                <div className="flex-1 min-w-0 w-full">
                    <PremiumEpisodeList
                        activeSagaId={activeSagaId}
                        episodes={episodeViewModels}
                        activeSubSagaStart={activeSubSaga?.startEp}
                        activeSubSagaEnd={activeSubSaga?.endEp}
                        onPlay={onPlayByNumber}
                        onPreload={onEpisodePreload}
                        sagaProgress={sagaProgress}
                        fillerStats={fillerStats}
                        scrollElement={scrollElement}
                    />
                </div>
            </div>
        </div>
    )
}
