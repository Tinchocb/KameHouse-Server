"use client"

import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Loader2, Sparkles, Film, Tv } from "lucide-react"
import { useGlobalSearch, type GlobalSearchResultItem } from "@/hooks/use-global-search"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { SPRING_PILL } from "@/components/ui/core/motion"

export function ExpandableSearch() {
    const { playSound } = useSound()
    const navigate = useNavigate()
    const [isExpanded, setIsExpanded] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const { query, setQuery, results, isLoading, isSearchActive } = useGlobalSearch(isExpanded)

    // Expand handler
    const handleExpand = () => {
        if (!isExpanded) {
            playSound("category", 0.3)
            setIsExpanded(true)
            setTimeout(() => {
                inputRef.current?.focus()
            }, 50)
        }
    }

    // Collapse handler
    const handleCollapse = React.useCallback(() => {
        setIsExpanded(false)
        setQuery("")
    }, [setQuery])

    // Click outside listener to collapse
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleCollapse()
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isExpanded) {
                handleCollapse()
            }
        }

        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside)
            document.addEventListener("keydown", handleKeyDown)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isExpanded, handleCollapse])

    // Open full command palette
    const handleOpenFullPalette = () => {
        playSound("category", 0.3)
        handleCollapse()
        window.dispatchEvent(new CustomEvent("open-command-palette"))
    }

    // On submit / Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            if (results && results.length > 0) {
                const first = results[0] as GlobalSearchResultItem
                const isMovie =
                    first.media?.format === "MOVIE" ||
                    first.media?.format === "SPECIAL" ||
                    first.media?.format === "OVA" ||
                    Number(first.mediaId) >= 1000000
                
                handleCollapse()
                if (isMovie) {
                    navigate({ to: "/movies/$movieId", params: { movieId: String(first.mediaId) } })
                } else {
                    navigate({ to: "/series/$seriesId", params: { seriesId: String(first.mediaId) } })
                }
            } else {
                handleOpenFullPalette()
            }
        }
    }

    return (
        <div ref={containerRef} className="relative flex items-center">
            {/* Animated Search Pill Container */}
            <motion.div
                initial={false}
                animate={{
                    width: isExpanded ? 264 : 32,
                    backgroundColor: isExpanded ? "rgba(24, 24, 27, 0.92)" : "rgba(24, 24, 27, 0)",
                    borderColor: isExpanded ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0)",
                    boxShadow: isExpanded
                        ? "inset 0 1px 1px rgba(255, 255, 255, 0.18)"
                        : "inset 0 1px 1px rgba(255, 255, 255, 0)",
                }}
                transition={SPRING_PILL}
                className="relative flex items-center h-8 rounded-full border overflow-hidden"
            >
                {/* Search Icon Trigger - Zero Shift geometry */}
                <motion.button
                    type="button"
                    onClick={handleExpand}
                    aria-label="Buscar (Ctrl+K)"
                    title={isExpanded ? undefined : "Buscar (Ctrl+K)"}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: isExpanded ? 1 : 1.05 }}
                    className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors duration-150",
                        isExpanded
                            ? "text-brand-accent"
                            : "text-zinc-300 hover:text-white hover:bg-white/10 active:scale-90"
                    )}
                >
                    <Search className="w-3.5 h-3.5" />
                </motion.button>

                {/* Animated Input & Actions */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, x: -6 }}
                            animate={{
                                opacity: 1,
                                x: 0,
                                transition: { duration: 0.18, ease: [0.2, 1, 0.2, 1] },
                            }}
                            exit={{
                                opacity: 0,
                                x: -4,
                                transition: { duration: 0.1, ease: "easeOut" },
                            }}
                            className="flex-1 flex items-center min-w-0 pr-1.5 overflow-hidden"
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar anime, películas..."
                                className="w-full bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-500 font-sans focus:ring-0 focus:outline-none p-0 pr-1"
                            />

                            {/* Loading indicator */}
                            {isLoading && (
                                <Loader2 className="w-3 h-3 text-brand-accent animate-spin shrink-0 mx-1" />
                            )}

                            {/* Clear or Close button */}
                            <AnimatePresence mode="wait">
                                {query ? (
                                    <motion.button
                                        key="clear-query"
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        transition={{ duration: 0.12 }}
                                        type="button"
                                        onClick={() => {
                                            setQuery("")
                                            inputRef.current?.focus()
                                        }}
                                        className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                                        aria-label="Limpiar búsqueda"
                                        whileTap={{ scale: 0.85 }}
                                    >
                                        <X className="w-3 h-3" />
                                    </motion.button>
                                ) : (
                                    <motion.button
                                        key="collapse-search"
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        transition={{ duration: 0.12 }}
                                        type="button"
                                        onClick={handleCollapse}
                                        className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                                        aria-label="Cerrar búsqueda"
                                        whileTap={{ scale: 0.85 }}
                                    >
                                        <X className="w-3 h-3" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Instant Floating Results Dropdown */}
            <AnimatePresence>
                {isExpanded && isSearchActive && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.2, 1, 0.2, 1] } }}
                        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1, ease: "easeOut" } }}
                        className="absolute top-[calc(100%+10px)] right-0 w-80 sm:w-96 max-h-[70vh] flex flex-col bg-zinc-950/90 border border-white/20 border-t-white/40 backdrop-blur-overlay-2xl backdrop-saturate-[190%] rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.2)] p-2 z-50 overflow-hidden"
                    >
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 text-[10px] uppercase font-black tracking-widest text-zinc-400">
                            <span className="flex items-center gap-1.5 text-brand-accent">
                                <Sparkles className="w-3 h-3" />
                                Resultados instantáneos
                            </span>
                            <span>{results?.length || 0} encontrados</span>
                        </div>

                        {/* List container */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1 custom-scrollbar max-h-[360px]">
                            {results && results.length > 0 ? (
                                results.slice(0, 6).map((res) => {
                                    const result = res as GlobalSearchResultItem
                                    const media = "media" in result ? result.media : undefined
                                    const title = media?.titleSpanish || media?.titleRomaji || media?.titleEnglish || `Título (${result.mediaId})`
                                    const isMovie =
                                        media?.format === "MOVIE" ||
                                        media?.format === "SPECIAL" ||
                                        media?.format === "OVA" ||
                                        Number(result.mediaId) >= 1000000

                                    const linkProps = isMovie
                                        ? { to: "/movies/$movieId" as const, params: { movieId: String(result.mediaId) } }
                                        : { to: "/series/$seriesId" as const, params: { seriesId: String(result.mediaId) } }

                                    return (
                                        <Link
                                            key={String(result.mediaId)}
                                            {...linkProps}
                                            onClick={handleCollapse}
                                            className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all duration-150 cursor-pointer"
                                        >
                                            {/* Poster preview */}
                                            <div className="w-9 h-12 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                                                {media?.posterImage ? (
                                                    <img
                                                        src={media.posterImage}
                                                        alt={title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    />
                                                ) : isMovie ? (
                                                    <Film className="w-4 h-4 text-zinc-600" />
                                                ) : (
                                                    <Tv className="w-4 h-4 text-zinc-600" />
                                                )}
                                            </div>

                                            {/* Media details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-zinc-200 group-hover:text-white truncate transition-colors">
                                                    {title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                                                    {media?.year && <span>{media.year}</span>}
                                                    <span className="px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 font-semibold uppercase tracking-wider">
                                                        {media?.format || (isMovie ? "PELÍCULA" : "SERIE")}
                                                    </span>
                                                    {media && "score" in media && media.score !== undefined && media.score > 0 && (
                                                        <span className="text-amber-400 font-black">
                                                            ★ {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })
                            ) : !isLoading ? (
                                <div className="py-8 text-center px-4">
                                    <p className="text-xs text-zinc-400">Sin coincidencias detectadas</p>
                                    <p className="text-[10px] text-zinc-500 mt-1">Prueba con otro término de búsqueda</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Footer - Link to full command palette */}
                        <div className="pt-2 mt-1 border-t border-white/10 px-1">
                            <button
                                type="button"
                                onClick={handleOpenFullPalette}
                                className="w-full py-1.5 px-2.5 rounded-lg text-left text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                                <span>Búsqueda avanzada en Bóveda</span>
                                <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10 group-hover:border-white/20">
                                    Ctrl+K
                                </kbd>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
