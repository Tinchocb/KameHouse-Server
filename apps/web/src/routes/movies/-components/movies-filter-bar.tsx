import * as React from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { IconNavigationSearch, IconUiClose, IconArrowDownUp, IconNavigationChevronDown } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { SortOption, SORT_OPTIONS } from "./movies-utils"

interface MoviesFilterBarProps {
    searchQuery: string
    setSearchQuery: (query: string) => void
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    totalCount?: number
    filteredCount?: number
}

export const MoviesFilterBar = React.memo(function MoviesFilterBar({
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    totalCount: _totalCount,
    filteredCount: _filteredCount,
}: MoviesFilterBarProps) {
    const [sortOpen, setSortOpen] = React.useState(false)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const searchInputRef = React.useRef<HTMLInputElement>(null)

    // Cerrar dropdown al hacer click afuera
    React.useEffect(() => {
        if (!sortOpen) return
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setSortOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [sortOpen])

    // Atajo '/' para enfocar el buscador instantáneamente
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    const reduceMotion = useReducedMotion()
    return (
        <div className="w-full flex items-center justify-between gap-3 select-none pb-2">
            {/* Buscador y Orden */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {/* Campo de búsqueda */}
                <div className="relative flex-1 sm:w-60 md:w-64">
                    <IconNavigationSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar película... (/)"
                        className="sectionbar sectionbar-pill w-full min-h-11 py-1.5 pl-9 pr-8 text-xs font-medium text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/40 transition-[border-color,box-shadow] duration-base ease-smooth-out"
                    />
                    <AnimatePresence>
                        {searchQuery && (
                            <m.button
                                key="clear-search"
                                type="button"
                                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                                onClick={() => setSearchQuery("")}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-white transition-colors duration-fast ease-smooth-out cursor-pointer"
                            >
                                <IconUiClose className="w-3.5 h-3.5" />
                            </m.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Dropdown de Orden */}
                <div ref={dropdownRef} className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setSortOpen((o) => !o)}
                        aria-haspopup="true"
                        aria-expanded={sortOpen}
                        className="sectionbar sectionbar-pill flex items-center gap-1.5 px-3.5 min-h-11 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/60 text-xs font-mono font-bold text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:scale-95 transition-[background-color,color,border-color,box-shadow,transform] duration-fast ease-out-strong cursor-pointer"
                    >
                        <IconArrowDownUp className="w-3 h-3 text-on-surface-variant" />
                        <span className="hidden md:inline">{SORT_OPTIONS.find((s) => s.value === sortBy)?.label}</span>
                        <span className="md:hidden">Orden</span>
                        <m.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}>
                            <IconNavigationChevronDown className="w-3 h-3 text-on-surface-variant" />
                        </m.span>
                    </button>

                    <AnimatePresence>
                        {sortOpen && (
                            <m.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                className="absolute right-0 top-[calc(100%+6px)] origin-top-right w-44 bg-surface-container-lowest/90 backdrop-blur-overlay-md border border-white/20 border-t-white/40 border-b-white/10 rounded-2xl shadow-[shadow:var(--glass-highlight-lg),0_16px_40px_-6px_rgba(0,0,0,0.9)] z-50 overflow-hidden p-1"
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        aria-pressed={sortBy === opt.value}
                                        onClick={() => {
                                            setSortBy(opt.value)
                                            setSortOpen(false)
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium transition-[background-color,color,transform] duration-fast ease-out-strong active:scale-95 cursor-pointer",
                                            sortBy === opt.value
                                                ? "text-black bg-white/95 font-bold shadow-[0_2px_10px_rgba(255,255,255,0.3)]"
                                                : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        {sortBy === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                    </button>
                                ))}
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
})
