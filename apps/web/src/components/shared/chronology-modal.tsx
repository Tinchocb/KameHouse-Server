"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { indexEntriesByTmdb, type StageCollectionEntry } from "@/lib/config/dragonball_stages"
import { DRAGON_BALL_STORY_SPANS } from "@/lib/config/dragonball_story_spans"
import { IconTimeClock, IconNavigationSearch, IconUiClose } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { Button, CloseButton } from "@/components/ui/button"
import { CinematicChronologyTimeline, getSpanDefaultArt, type SpanStill } from "@/components/chronology/CinematicChronologyTimeline"
import { getServerBaseUrl } from "@/api/client/server-url"

interface ChronologyModalProps {
    isOpen: boolean
    onClose: () => void
}

export function ChronologyModal({ isOpen, onClose }: ChronologyModalProps) {
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [hideFiller, setHideFiller] = useState<boolean>(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const { data: libraryCollection } = useGetLibraryCollection({ enabled: isOpen })

    const tmdbMap = useMemo(() => {
        if (!libraryCollection?.lists) return new Map<number, StageCollectionEntry>()
        const allEntries = libraryCollection.lists.flatMap((list) => list.entries || [])
        return indexEntriesByTmdb(allEntries as unknown as StageCollectionEntry[])
    }, [libraryCollection])

    // Still real del episodio si está descargado; si no, arte editorial default.
    const spanStills = useMemo(() => {
        const map = new Map<string, SpanStill>()
        const cw = libraryCollection?.continueWatchingList ?? []
        const serverBase = typeof window !== "undefined" ? getServerBaseUrl() || window.location.origin : ""
        for (const span of DRAGON_BALL_STORY_SPANS) {
            const entry = tmdbMap.get(span.tmdbId)
            const downloaded = !!entry?.mediaId
            const ep = cw.find(
                (e) =>
                    (e.baseAnime?.tmdbId === span.tmdbId || e.baseAnime?.id === entry?.mediaId) &&
                    e.absoluteEpisodeNumber >= span.startEpisode &&
                    e.absoluteEpisodeNumber <= span.endEpisode &&
                    (e.episodeMetadata?.image || (e.isDownloaded && e.localFile?.path))
            )
            if (ep) {
                const url = ep.episodeMetadata?.image
                    ? ep.episodeMetadata.image
                    : `${serverBase}/api/v1/video-thumbnail?path=${encodeURIComponent(ep.localFile?.path ?? "")}`
                map.set(span.id, {
                    src: url,
                    isEpisode: true,
                    downloaded: true,
                    episodeLabel: `Still EP ${ep.absoluteEpisodeNumber}`,
                })
            } else {
                map.set(span.id, {
                    src: getSpanDefaultArt(span.id, span.seriesId),
                    isEpisode: false,
                    downloaded,
                })
            }
        }
        return map
    }, [libraryCollection, tmdbMap])

    const filteredSpans = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return DRAGON_BALL_STORY_SPANS.filter((span) => {
            if (hideFiller && span.hasFiller) return false
            if (!q) return true
            return (
                span.title.toLowerCase().includes(q) ||
                span.sagaName.toLowerCase().includes(q) ||
                span.previouslyOn.toLowerCase().includes(q) ||
                span.inUniverseYears.toLowerCase().includes(q)
            )
        })
    }, [hideFiller, searchQuery])

    // Atajos: Esc cierra, "/" enfoca buscador
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null
            const inInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
            if (e.key === "Escape" && !inInput) onClose()
            if (e.key === "/" && !inInput) {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    // Reset scroll al cambiar filtro
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0 })
    }, [hideFiller])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-modal flex flex-col bg-[var(--bg-primary)] text-on-surface">
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Tu viaje por Dragon Ball"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="relative flex h-full w-full flex-col overflow-hidden text-on-surface"
                    >
                        {/* Header delgado: la cronología es la protagonista */}
                        <div className="shrink-0 space-y-4 border-b border-outline-variant bg-surface-container/80 px-6 pb-4 pt-5 backdrop-blur-overlay-2xl sm:px-8 lg:px-10">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card border border-brand-accent/25 bg-brand-accent/10 text-brand-accent">
                                        <IconTimeClock className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="truncate font-display text-xl font-black uppercase tracking-wider text-on-surface">
                                            Tu viaje por Dragon Ball
                                        </h2>
                                        <div className="mt-1 h-[2px] w-12 rounded-full bg-gradient-to-r from-white via-white/60 to-transparent" />
                                        <p className="mt-1 tabular-nums text-xs text-on-surface-variant">
                                            {DRAGON_BALL_STORY_SPANS.length} arcos · 5 eras · canon + películas
                                        </p>
                                    </div>
                                </div>

                                <CloseButton onClick={onClose} />
                            </div>

                            {/* Filtros */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    intent={hideFiller ? "primary" : "gray-glass"}
                                    onClick={() => setHideFiller((v) => !v)}
                                    aria-pressed={hideFiller}
                                >
                                    {hideFiller ? "✓ Sin relleno" : "Sin relleno"}
                                </Button>
                                <div className="ml-auto w-full sm:w-auto">
                                    {/* Buscador */}
                                    <div className="relative w-full sm:w-72">
                                        <IconNavigationSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
                                        <input
                                            ref={searchRef}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Buscar saga... (/)"
                                            aria-label="Buscar saga"
                                            className="w-full rounded-full border border-outline-variant bg-surface-container-low py-2 pl-9 pr-8 text-sm text-on-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] backdrop-blur-overlay-md transition-colors placeholder:text-on-surface-variant hover:border-outline focus:border-brand-accent focus:outline-none"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery("")}
                                                aria-label="Limpiar búsqueda"
                                                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-on-surface-variant hover:text-on-surface"
                                            >
                                                <IconUiClose className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contenido cinematográfico */}
                        <div className="flex min-h-0 flex-1">
                            <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                                <div className="mx-auto w-full max-w-content">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={`${hideFiller}-${searchQuery}`}
                                            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                            exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
                                            transition={{ type: "spring", stiffness: 280, damping: 28 }}
                                        >
                                            <CinematicChronologyTimeline
                                                spans={filteredSpans}
                                                tmdbMap={tmdbMap}
                                                onClose={onClose}
                                                searchQuery={searchQuery}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
