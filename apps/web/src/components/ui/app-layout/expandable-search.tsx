"use client"

import * as React from "react"
import { getFormatLabel } from "@/lib/helpers/media"
import { useNavigate } from "@tanstack/react-router"
import { m, AnimatePresence } from "framer-motion"
import { Search, X, Loader2, Sparkles, Film, Tv, Clock, ArrowRight } from "lucide-react"
import { useGlobalSearch, type GlobalSearchResultItem } from "@/hooks/use-global-search"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

const RECENT_SEARCHES_KEY = "kamehouse_recent_searches"
const MAX_RECENTS = 5
const SUGGESTIONS = ["Dragon Ball Z", "Películas", "Dragon Ball Super", "Daima"]

function getStoredRecents(): string[] {
    if (typeof window === "undefined") return []
    try {
        const item = localStorage.getItem(RECENT_SEARCHES_KEY)
        const parsed = item ? JSON.parse(item) : []
        return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
        return []
    }
}

function saveStoredRecent(term: string) {
    if (!term.trim() || typeof window === "undefined") return
    try {
        const recents = getStoredRecents().filter(r => r.toLowerCase() !== term.toLowerCase())
        const updated = [term.trim(), ...recents].slice(0, MAX_RECENTS)
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch {
        // Silently ignore storage errors
    }
}

function removeStoredRecent(term: string) {
    if (typeof window === "undefined") return
    try {
        const recents = getStoredRecents().filter(r => r !== term)
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recents))
    } catch {
        // Silently ignore
    }
}

export function ExpandableSearch() {
    const { playSound } = useSound()
    const navigate = useNavigate()
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [selectedIndex, setSelectedIndex] = React.useState<number>(-1)
    const [recentSearches, setRecentSearches] = React.useState<string[]>([])
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const tabIndicatorSpring = useSpringPreset('tabIndicator')

    const { query, setQuery, results, isLoading, isSearchActive } = useGlobalSearch(isExpanded)

    const visibleResults = React.useMemo(() => {
        return (results || []).filter(res => res != null).slice(0, 6)
    }, [results])

    // Cargar recientes al expandir
    const [prevExpanded, setPrevExpanded] = React.useState(false)
    if (isExpanded !== prevExpanded) {
        setPrevExpanded(isExpanded)
        if (isExpanded) {
            setRecentSearches(getStoredRecents())
            setSelectedIndex(-1)
        }
    }

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
        setSelectedIndex(-1)
    }, [setQuery])

    // Click outside listener to collapse
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleCollapse()
            }
        }

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isExpanded) {
                handleCollapse()
            }
        }

        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside)
            document.addEventListener("keydown", handleEscape)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [isExpanded, handleCollapse])

    // Open full command palette
    const handleOpenFullPalette = () => {
        playSound("category", 0.3)
        handleCollapse()
        window.dispatchEvent(new CustomEvent("open-command-palette"))
    }

    const handleSelectResult = (item: GlobalSearchResultItem) => {
        if (query.trim()) {
            saveStoredRecent(query)
        }
        // Huérfanos: no tienen página de detalle; abrir la paleta completa
        // (ahí tienen acciones Cola / Pre-TC / Match).
        if ("isUnlinked" in item && item.isUnlinked) {
            handleCollapse()
            window.dispatchEvent(new CustomEvent("open-command-palette"))
            return
        }
        // Semánticos: el id navegable vive en semanticData, no en mediaId.
        if ("isSemantic" in item && item.isSemantic) {
            const sem = item.semanticData
            handleCollapse()
            if (sem.mediaType === "MOVIE") {
                navigate({ to: "/movies/$movieId", params: { movieId: String(sem.mediaId) } })
            } else {
                navigate({ to: "/series/$seriesId", params: { seriesId: String(sem.mediaId) } })
            }
            return
        }
        // El offset TMDB (+1M) NO indica película: solo formato/tipo deciden.
        const fmt = item?.media?.format?.toUpperCase()
        const isMovie =
            fmt === "MOVIE" ||
            fmt === "SPECIAL" ||
            fmt === "OVA"

        handleCollapse()
        if (isMovie) {
            navigate({ to: "/movies/$movieId", params: { movieId: String(item.mediaId) } })
        } else {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(item.mediaId) } })
        }
    }

    // Navegación con teclado
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedIndex(prev => (prev < visibleResults.length - 1 ? prev + 1 : 0))
            return
        }
        if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : visibleResults.length - 1))
            return
        }
        if (e.key === "Enter") {
            e.preventDefault()
            if (selectedIndex >= 0 && visibleResults[selectedIndex]) {
                handleSelectResult(visibleResults[selectedIndex] as GlobalSearchResultItem)
                return
            }
            const firstValid = visibleResults[0] as GlobalSearchResultItem | undefined
            if (firstValid) {
                handleSelectResult(firstValid)
                return
            }
            handleOpenFullPalette()
            return
        }
        if (e.key === "Escape") {
            e.preventDefault()
            handleCollapse()
        }
    }

    return (
        <div ref={containerRef} className="relative flex items-center">
            {/* Pill Container */}
            <m.div
                initial={false}
                animate={{
                    width: isExpanded ? 260 : 36,
                    backgroundColor: isExpanded
                        ? "rgba(255, 255, 255, 0.08)"
                        : "transparent",
                    borderColor: isExpanded
                        ? "rgba(255, 255, 255, 0.2)"
                        : "transparent",
                    boxShadow: isExpanded
                        ? "inset 0 1px 1px rgba(255, 255, 255, 0.18)"
                        : "inset 0 1px 1px rgba(255, 255, 255, 0)",
                }}
                transition={tabIndicatorSpring}
                className="relative flex items-center h-8 rounded-full border overflow-hidden"
            >
                {/* Search Icon Trigger - Zero Shift geometry */}
                <m.button
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
                            : "text-on-surface-variant hover:text-white hover:bg-white/10 active:scale-90"
                    )}
                >
                    <Search className="w-3.5 h-3.5" />
                </m.button>

                {/* Animated Input & Actions */}
                <AnimatePresence>
                    {isExpanded && (
                        <m.div
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
                                className="w-full bg-transparent border-none outline-none text-xs text-on-surface placeholder:text-on-surface-variant/60 font-sans focus:ring-0 focus:outline-none p-0 pr-1"
                            />

                            {/* Loading indicator */}
                            {isLoading && (
                                <Loader2 className="w-3 h-3 text-brand-accent animate-spin shrink-0 mx-1" />
                            )}

                            {/* Clear or Close button */}
                            <AnimatePresence mode="wait">
                                {query ? (
                                    <m.button
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
                                        className="p-1 rounded-full text-on-surface-variant hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                                        aria-label="Limpiar búsqueda"
                                        whileTap={{ scale: 0.85 }}
                                    >
                                        <X className="w-3 h-3" />
                                    </m.button>
                                ) : (
                                    <m.button
                                        key="collapse-search"
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        transition={{ duration: 0.12 }}
                                        type="button"
                                        onClick={handleCollapse}
                                        className="p-1 rounded-full text-on-surface-variant hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                                        aria-label="Cerrar búsqueda"
                                        whileTap={{ scale: 0.85 }}
                                    >
                                        <X className="w-3 h-3" />
                                    </m.button>
                                )}
                            </AnimatePresence>
                        </m.div>
                    )}
                </AnimatePresence>
            </m.div>

            {/* Instant Floating Results & Recents Dropdown */}
            <AnimatePresence>
                {isExpanded && (
                    <m.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={tabIndicatorSpring}
                        className="absolute top-[calc(100%+10px)] right-0 origin-top-right w-80 sm:w-96 max-h-[70vh] flex flex-col bg-bg-secondary border border-white/20 border-t-white/40 backdrop-blur-overlay-2xl backdrop-saturate-[190%] rounded-2xl shadow-[shadow:0_16px_40px_-8px_rgba(0,0,0,0.95),var(--glass-highlight-md)] p-2.5 z-50 overflow-hidden"
                    >
                        {isSearchActive ? (
                            <>
                                {/* Header bar */}
                                <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 text-3xs uppercase font-black tracking-widest text-on-surface-variant">
                                    <span className="flex items-center gap-1.5 text-brand-accent">
                                        <Sparkles className="w-3 h-3" />
                                        Resultados instantáneos
                                    </span>
                                    <span>{results?.length || 0} encontrados</span>
                                </div>

                                {/* List container */}
                                <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1 custom-scrollbar max-h-[360px]">
                                    {visibleResults.length > 0 ? (
                                        visibleResults.map((res, index) => {
                                            const result = res as GlobalSearchResultItem
                                            if (!result) return null
                                            const media = result && typeof result === "object" && "media" in result ? result.media : undefined
                                            const title = media?.titleSpanish || media?.titleRomaji || media?.titleEnglish || `Título (${result?.mediaId ?? index})`
                                            const isMovie =
                                                media?.format === "MOVIE" ||
                                                media?.format === "SPECIAL" ||
                                                media?.format === "OVA"

                                            const isSelected = selectedIndex === index

                                            return (
                                                <button
                                                    key={String(result?.mediaId ?? `idx-${index}`)}
                                                    type="button"
                                                    onClick={() => handleSelectResult(result)}
                                                    className={cn(
                                                        "w-full group flex items-center gap-3 p-2 rounded-xl transition duration-150 cursor-pointer text-left",
                                                        isSelected
                                                            ? "bg-brand-accent/20 border border-brand-accent/40"
                                                            : "hover:bg-white/10 active:bg-white/15 border border-transparent"
                                                    )}
                                                >
                                                    {/* Poster preview */}
                                                    <div className="w-9 h-12 rounded-lg bg-surface-container-high border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                                                        {media?.posterImage ? (
                                                            <img
                                                                src={media.posterImage}
                                                                alt={title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                            />
                                                        ) : isMovie ? (
                                                            <Film className="w-4 h-4 text-on-surface-variant/60" />
                                                        ) : (
                                                            <Tv className="w-4 h-4 text-on-surface-variant/60" />
                                                        )}
                                                    </div>

                                                    {/* Media details */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            "text-xs font-bold truncate transition-colors",
                                                            isSelected ? "text-brand-accent" : "text-on-surface group-hover:text-white"
                                                        )}>
                                                            {title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1 text-3xs text-on-surface-variant">
                                                            {media?.year && <span>{media.year}</span>}
                                                            <span className="px-1.5 py-px rounded bg-white/10 text-on-surface font-semibold uppercase tracking-wider">
                                                                {getFormatLabel(media?.format, isMovie ? "Película" : "Serie")}
                                                            </span>
                                                            {media && "score" in media && media.score !== undefined && media.score > 0 && (
                                                                <span className="text-amber-400 font-black">
                                                                    ★ {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })
                                    ) : !isLoading ? (
                                        <div className="py-8 text-center px-4">
                                            <p className="text-xs text-on-surface-variant">Sin coincidencias detectadas</p>
                                            <p className="text-3xs text-on-surface-variant/70 mt-1">Prueba con otro término de búsqueda</p>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : (
                            /* Vista Idle / Vacía: Recientes y Sugerencias Rápidas */
                            <div className="p-2 space-y-3">
                                {/* Sugerencias rápidas */}
                                <div className="space-y-1.5">
                                    <span className="text-3xs font-black uppercase tracking-widest text-on-surface-variant/80 font-mono">
                                        Exploración rápida
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {SUGGESTIONS.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => {
                                                    setQuery(tag)
                                                    inputRef.current?.focus()
                                                }}
                                                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-2xs font-medium text-on-surface transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                <span>{tag}</span>
                                                <ArrowRight className="w-2.5 h-2.5 text-on-surface-variant" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Búsquedas recientes */}
                                {recentSearches.length > 0 && (
                                    <div className="space-y-1.5 pt-2 border-t border-white/10">
                                        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-on-surface-variant/80 font-mono">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-brand-accent" />
                                                Recientes
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    localStorage.removeItem(RECENT_SEARCHES_KEY)
                                                    setRecentSearches([])
                                                }}
                                                className="text-4xs text-on-surface-variant hover:text-white lowercase cursor-pointer"
                                            >
                                                limpiar
                                            </button>
                                        </div>
                                        <div className="space-y-1 pt-0.5">
                                            {recentSearches.map((term) => (
                                                <div
                                                    key={term}
                                                    className="flex items-center justify-between group/recent px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQuery(term)
                                                            inputRef.current?.focus()
                                                        }}
                                                        className="flex-1 text-left text-xs text-on-surface group-hover/recent:text-white truncate cursor-pointer"
                                                    >
                                                        {term}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            removeStoredRecent(term)
                                                            setRecentSearches(getStoredRecents())
                                                        }}
                                                        className="text-on-surface-variant/40 hover:text-red-400 p-0.5 rounded cursor-pointer"
                                                        aria-label={`Eliminar ${term}`}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer - Link to full command palette */}
                        <div className="pt-2 mt-1 border-t border-white/10 px-1">
                            <button
                                type="button"
                                onClick={handleOpenFullPalette}
                                className="w-full py-1.5 px-2.5 rounded-lg text-left text-2xs font-semibold text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                                <span>Búsqueda avanzada en Bóveda</span>
                                <kbd className="text-4xs font-mono px-1.5 py-0.5 rounded bg-white/10 text-on-surface-variant border border-white/10 group-hover:border-white/20">
                                    Ctrl+K
                                </kbd>
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}
