import * as React from "react"
import { useMemo, useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Anime_Episode, Anime_LocalFile, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { SagaDefinition } from "@/lib/config/dragonball.config"
import { EpisodeCard } from "../-series-interactivity-client"
import { useWindowVirtualizer } from "@tanstack/react-virtual"

interface SagaEpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
    localFiles: Anime_LocalFile[]
    sagas: SagaDefinition[]
    seriesTmdbId?: number | null
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    onToggleWatched?: (episode: Anime_Episode) => void
    onUpdateProgress?: (progress: number) => void
    continuityItem?: Continuity_WatchHistoryItem | null
    currentlyPlayingEpNumber?: number
}

export const SagaEpisodesSection = React.memo(function SagaEpisodesSection({
    seriesTitle,
    fallbackThumb,
    episodes,
    localFiles,
    sagas,
    seriesTmdbId,
    onPlay,
    onToggleWatched,
    onUpdateProgress,
    continuityItem,
    currentlyPlayingEpNumber
}: SagaEpisodesSectionProps) {
    // Generate sagas or chunks of 20
    const generatedSagas = useMemo(() => {
        if (sagas && sagas.length > 0) return sagas.map(s => ({ ...s, isGenerated: false }))
        
        if (episodes.length === 0) return []
        
        const chunks = []
        for (let i = 0; i < episodes.length; i += 20) {
            const startEp = episodes[i]?.episodeNumber ?? 0
            const endEp = episodes[Math.min(i + 19, episodes.length - 1)]?.episodeNumber ?? 0
            chunks.push({
                id: `chunk-${i}`,
                title: `Episodios ${startEp} - ${endEp}`,
                startEp,
                endEp,
                description: "",
                image: fallbackThumb,
                isGenerated: true
            })
        }
        return chunks
    }, [sagas, episodes, fallbackThumb])

    const [activeSagaId, setActiveSagaId] = useState<string>("")
    const [activeSubSagaId, setActiveSubSagaId] = useState<string>("")

    const [layoutMode, setLayoutMode] = useState<"grid" | "horizontal">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("kamehouse-series-layout")
            if (saved === "grid" || saved === "horizontal") return saved
        }
        return "grid"
    })

    const handleLayoutChange = useCallback((mode: "grid" | "horizontal") => {
        setLayoutMode(mode)
        localStorage.setItem("kamehouse-series-layout", mode)
    }, [])

    const [cols, setCols] = useState(3)

    useEffect(() => {
        const updateCols = () => {
            const width = window.innerWidth
            if (width < 640) setCols(1)
            else if (width < 1024) setCols(2)
            else setCols(3)
        }
        updateCols()
        window.addEventListener("resize", updateCols)
        return () => window.removeEventListener("resize", updateCols)
    }, [])

    useEffect(() => {
        if (generatedSagas.length > 0 && !generatedSagas.find(s => s.id.toString() === activeSagaId)) {
            setActiveSagaId(generatedSagas[0].id.toString())
        }
    }, [generatedSagas, activeSagaId])

    useEffect(() => {
        const activeSaga = generatedSagas.find(s => s.id.toString() === activeSagaId)
        if (activeSaga?.subSagas && activeSaga.subSagas.length > 0) {
            const hasActive = activeSaga.subSagas.find(ss => ss.id === activeSubSagaId)
            if (!hasActive) {
                setActiveSubSagaId(activeSaga.subSagas[0].id)
            }
        } else {
            setActiveSubSagaId("")
        }
    }, [generatedSagas, activeSagaId, activeSubSagaId])

    const activeMainSaga = useMemo(() => {
        return generatedSagas.find(s => s.id.toString() === activeSagaId)
    }, [generatedSagas, activeSagaId])

    const visibleEpisodes = useMemo(() => {
        if (generatedSagas.length === 0) return episodes
        const saga = generatedSagas.find(s => s.id.toString() === activeSagaId)
        if (!saga) return episodes
        
        let start = saga.startEp
        let end = saga.endEp
        let activeSagaIdStr = saga.id.toString()
        
        if (activeSubSagaId && saga.subSagas) {
            const subSaga = saga.subSagas.find((ss) => ss.id === activeSubSagaId)
            if (subSaga) {
                start = subSaga.startEp
                end = subSaga.endEp
                activeSagaIdStr = subSaga.id
            }
        }

        const currentFiltered = episodes.filter(ep => {
            if (!ep) return false
            const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
            const inRange = epNum >= start && epNum <= end
            const matchesSaga = (ep as Anime_Episode & { sagaId?: string }).sagaId === activeSagaIdStr
            return matchesSaga || inRange
        })

        // Pad any missing episode number within [start, end]
        const epMap = new Map<number, Anime_Episode>()
        currentFiltered.forEach(ep => {
            if (ep) {
                const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                if (typeof epNum === 'number') {
                    epMap.set(epNum, ep)
                }
            }
        })

        const paddedEpisodes: Anime_Episode[] = []
        for (let i = start; i <= end; i++) {
            if (epMap.has(i)) {
                paddedEpisodes.push(epMap.get(i)!)
            } else {
                const displayTitle = `Episodio ${i}`
                
                paddedEpisodes.push({
                    episodeNumber: i,
                    absoluteEpisodeNumber: i,
                    episodeTitle: displayTitle,
                    displayTitle: displayTitle,
                    watched: false,
                    sagaId: activeSagaIdStr,
                    type: "main",
                    progressNumber: i,
                    isDownloaded: false,
                    isInvalid: false,
                    episodeMetadata: {
                        episodeNumber: i,
                        image: fallbackThumb || "",
                    }
                } as unknown as Anime_Episode)
            }
        }
        return paddedEpisodes
    }, [episodes, generatedSagas, activeSagaId, activeSubSagaId, fallbackThumb])

    const getLocalFile = useCallback((ep: Anime_Episode) => {
        if (ep.localFile) return ep.localFile
        
        return localFiles.find(lf => {
            const lfEp = lf.metadata?.episode || lf.parsedInfo?.episode
            const lfSeason = lf.parsedInfo?.season
            if (lfEp == null) return false
            
            if (typeof ep.seasonNumber === 'number' && lfSeason != null) {
                return Number(lfEp) === ep.episodeNumber && Number(lfSeason) === ep.seasonNumber
            }
            return Number(lfEp) === ep.episodeNumber
        })
    }, [localFiles])

    const rowCount = layoutMode === "grid" ? Math.ceil(visibleEpisodes.length / cols) : visibleEpisodes.length

    const estimateSize = useCallback(() => {
        return layoutMode === "grid" ? 280 : 120
    }, [layoutMode])

    const rowVirtualizer = useWindowVirtualizer({
        count: rowCount,
        estimateSize,
        overscan: 5,
    })

    return (
        <section className="relative z-[1] pb-20 max-w-[1800px] mx-auto">
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Sagas Sidebar (Left) */}
                {generatedSagas.length > 0 && (
                    <aside className="w-full lg:w-[400px] shrink-0">
                        <div className="sticky top-24 flex flex-col gap-6">
                            <h3 className="text-[11px] font-black tracking-[0.5em] text-zinc-700 uppercase px-2 mb-2 flex items-center gap-4">
                                <span className="w-8 h-[1px] bg-zinc-800" />
                                Seleccionar Saga
                            </h3>
                            <div className="flex flex-col border border-white/[0.03] bg-zinc-950/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
                                {generatedSagas.map((saga, idx) => {
                                    const isLast = idx === generatedSagas.length - 1
                                    const isActive = activeSagaId === saga.id.toString()
                                    const hasSubSagas = saga.subSagas && saga.subSagas.length > 0

                                    return (
                                        <div key={saga.id} className="relative">
                                            <button
                                                onClick={() => {
                                                    setActiveSagaId(saga.id.toString())
                                                }}
                                                className={cn(
                                                    "group w-full flex items-center justify-between px-6 py-5 transition-all duration-300 relative",
                                                    isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                                                )}
                                            >
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn(
                                                            "w-1 h-1 rounded-full transition-all duration-500",
                                                            isActive ? "bg-brand-orange scale-150" : "bg-zinc-800 group-hover:bg-zinc-600"
                                                        )} />
                                                        {!isLast && (
                                                            <div className="w-[1px] h-10 bg-zinc-900 mt-2" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-start text-left">
                                                        <span className={cn(
                                                            "text-[8px] font-black tracking-[0.3em] mb-0.5 transition-colors uppercase",
                                                            isActive ? "text-brand-orange" : "text-zinc-600 group-hover:text-zinc-500"
                                                        )}>
                                                            Saga {idx + 1}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[12px] font-bold uppercase tracking-[0.1em] transition-all duration-300",
                                                            isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                                                        )}>
                                                            {saga.title}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={cn(
                                                    "text-[9px] font-mono transition-opacity",
                                                    isActive ? "text-brand-orange" : "text-zinc-700 opacity-0 group-hover:opacity-100"
                                                )}>
                                                    {saga.startEp}-{saga.endEp}
                                                </div>
                                            </button>

                                            {/* Sub-Sagas Accordion */}
                                            {isActive && hasSubSagas && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    className="overflow-hidden ml-[31px] border-l border-white/5"
                                                >
                                                    <div className="flex flex-col py-2 gap-1">

                                                        {saga.subSagas?.map((sub) => (
                                                            <button
                                                                key={sub.id}
                                                                onClick={() => setActiveSubSagaId(sub.id)}
                                                                className={cn(
                                                                    "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-left transition-all relative group/sub",
                                                                    activeSubSagaId === sub.id ? "text-white" : "text-zinc-700 hover:text-zinc-400"
                                                                )}
                                                            >
                                                                {activeSubSagaId === sub.id && (
                                                                    <motion.div 
                                                                        layoutId="activeSubDot"
                                                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-brand-orange" 
                                                                    />
                                                                )}
                                                                {sub.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </aside>
                )}

                {/* Episode List (Right) */}
                <div className="flex-1 flex flex-col gap-10">
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/5 pb-8">
                                    <div className="flex flex-col gap-2">
                                        <h2 className="text-5xl font-bebas tracking-[0.2em] text-white uppercase leading-none">
                                            {activeMainSaga?.title || "EPISODIOS"}
                                        </h2>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                            <span>{visibleEpisodes.length} TOTAL</span>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span className="text-brand-orange">{visibleEpisodes.filter(e => e.watched).length} VISTOS</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons Strip */}
                                    <div className="flex items-center gap-4 shrink-0 self-start sm:self-auto">
                                        {/* Premium Progress Actions Dropdown */}
                                        {activeMainSaga && onUpdateProgress && (
                                            <div className="relative group/actions">
                                                <button className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950/60 hover:bg-zinc-900 border border-white/5 rounded-xl text-[10px] font-black tracking-widest text-zinc-400 hover:text-white uppercase transition-all duration-300">
                                                    <span>Progreso</span>
                                                    <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover/actions:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                    </svg>
                                                </button>
                                                
                                                <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl bg-zinc-950/95 border border-white/5 p-2 shadow-2xl backdrop-blur-xl opacity-0 scale-95 pointer-events-none group-hover/actions:opacity-100 group-hover/actions:scale-100 group-hover/actions:pointer-events-auto transition-all duration-300 z-50">
                                                    <button
                                                        onClick={() => {
                                                            onUpdateProgress(activeMainSaga.endEp)
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all text-left"
                                                    >
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>Visto hasta el fin</span>
                                                    </button>
                                                    
                                                    <button
                                                        onClick={() => {
                                                            onUpdateProgress(Math.max(0, activeMainSaga.startEp - 1))
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all text-left"
                                                    >
                                                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>Reiniciar progreso</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Premium Layout Selector Toggle */}
                                        <div className="flex items-center gap-2 bg-zinc-950/60 p-1.5 rounded-xl border border-white/5">
                                            <button
                                                onClick={() => handleLayoutChange("grid")}
                                                className={cn(
                                                    "flex items-center justify-center p-2.5 rounded-lg transition-all duration-300",
                                                    layoutMode === "grid" 
                                                        ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/10" 
                                                        : "text-zinc-500 hover:text-zinc-300"
                                                )}
                                                title="Vista de Cuadrícula"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="7" height="7" />
                                                    <rect x="14" y="3" width="7" height="7" />
                                                    <rect x="14" y="14" width="7" height="7" />
                                                    <rect x="3" y="14" width="7" height="7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleLayoutChange("horizontal")}
                                                className={cn(
                                                    "flex items-center justify-center p-2.5 rounded-lg transition-all duration-300",
                                                    layoutMode === "horizontal" 
                                                        ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/10" 
                                                        : "text-zinc-500 hover:text-zinc-300"
                                                )}
                                                title="Vista de Lista"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="8" y1="6" x2="21" y2="6" />
                                                    <line x1="8" y1="12" x2="21" y2="12" />
                                                    <line x1="8" y1="18" x2="21" y2="18" />
                                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {visibleEpisodes.length === 0 ? (
                                    <div className="py-24 text-center">
                                        <p className="text-zinc-600 font-bebas text-4xl tracking-widest">SIN EPISODIOS DISPONIBLES</p>
                                        <p className="text-zinc-700 text-xs font-black uppercase tracking-[0.3em] mt-2">INTENTA ACTUALIZAR LA BIBLIOTECA</p>
                                    </div>
                                ) : (
                                    <div
                                        key={`${layoutMode}-${activeSagaId}`}
                                        style={{
                                            height: `${rowVirtualizer.getTotalSize()}px`,
                                            width: "100%",
                                            position: "relative",
                                        }}
                                    >
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const rowIndex = virtualRow.index
                                            if (layoutMode === "grid") {
                                                const startIndex = rowIndex * cols
                                                const rowEpisodes = visibleEpisodes.slice(startIndex, startIndex + cols)
                                                return (
                                                    <div
                                                        key={virtualRow.key}
                                                        data-index={rowIndex}
                                                        ref={rowVirtualizer.measureElement}
                                                        style={{
                                                            position: "absolute",
                                                            top: 0,
                                                            left: 0,
                                                            width: "100%",
                                                            transform: `translateY(${virtualRow.start}px)`,
                                                        }}
                                                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                                    >
                                                        {rowEpisodes.map((ep, idx) => {
                                                            const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                                                            const globalIndex = startIndex + idx
                                                            return (
                                                                <EpisodeCard
                                                                    key={epNum}
                                                                    episode={ep}
                                                                    variant="grid"
                                                                    fallbackThumb={fallbackThumb}
                                                                    localFile={getLocalFile(ep)}
                                                                    onPlay={onPlay}
                                                                    onToggleWatched={onToggleWatched}
                                                                    onUpdateProgress={onUpdateProgress}
                                                                    continuityItem={continuityItem}
                                                                    isCurrentlyPlaying={currentlyPlayingEpNumber === epNum}
                                                                    seriesTmdbId={seriesTmdbId}
                                                                    priority={globalIndex < 6}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            } else {
                                                const ep = visibleEpisodes[rowIndex]
                                                const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                                                return (
                                                    <div
                                                        key={virtualRow.key}
                                                        data-index={rowIndex}
                                                        ref={rowVirtualizer.measureElement}
                                                        style={{
                                                            position: "absolute",
                                                            top: 0,
                                                            left: 0,
                                                            width: "100%",
                                                            transform: `translateY(${virtualRow.start}px)`,
                                                        }}
                                                        className="flex flex-col gap-1 pb-1"
                                                    >
                                                        <EpisodeCard
                                                            episode={ep}
                                                            variant="horizontal"
                                                            fallbackThumb={fallbackThumb}
                                                            localFile={getLocalFile(ep)}
                                                            onPlay={onPlay}
                                                            onToggleWatched={onToggleWatched}
                                                            onUpdateProgress={onUpdateProgress}
                                                            continuityItem={continuityItem}
                                                            isCurrentlyPlaying={currentlyPlayingEpNumber === epNum}
                                                            seriesTmdbId={seriesTmdbId}
                                                            priority={rowIndex < 6}
                                                        />
                                                    </div>
                                                )
                                            }
                                        })}
                                    </div>
                                )}
                            </>
                </div>
            </div>
        </section>
    )
})
SagaEpisodesSection.displayName = "SagaEpisodesSection"
