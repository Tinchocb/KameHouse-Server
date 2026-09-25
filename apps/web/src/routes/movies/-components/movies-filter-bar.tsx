import * as React from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { IconNavigationSearch, IconUiClose, IconArrowDownUp, IconNavigationChevronDown } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { SortOption, SORT_OPTIONS } from "./movies-utils"
import { MagneticIndicator } from "@/components/ui/kinetics"

export type MovieStatusFilter = "all" | "completed" | "unwatched"

const STATUS_FILTER_OPTIONS: { id: MovieStatusFilter; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "completed", label: "Vistas" },
    { id: "unwatched", label: "Sin ver" },
]

interface MoviesFilterBarProps {
    searchQuery: string
    setSearchQuery: (query: string) => void
    statusFilter: MovieStatusFilter
    setStatusFilter: (status: MovieStatusFilter) => void
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    totalCount: number
    filteredCount: number
}

export const MoviesFilterBar = React.memo(function MoviesFilterBar({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
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
        <div className="w-full flex flex-col gap-3.5 select-none pb-2">
            {/* Fila Superior: Buscador y Dropdown de Orden */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
                            className="w-full bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 rounded-full py-1.5 pl-9 pr-8 text-xs font-medium text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/40 transition-[border-color,box-shadow] duration-base ease-smooth-out backdrop-blur-overlay-2xl shadow-glass-highlight-md"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-white transition-colors"
                            >
                                <IconUiClose className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Dropdown de Orden */}
                    <div ref={dropdownRef} className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setSortOpen((o) => !o)}
                            aria-haspopup="true"
                            aria-expanded={sortOpen}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-lowest/60 hover:bg-surface-container-high/60 border border-white/20 border-t-white/40 border-b-white/10 text-xs font-mono font-bold text-on-surface-variant hover:text-white active:scale-[0.97] transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out-strong backdrop-blur-overlay-2xl shadow-glass-highlight-md cursor-pointer"
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
                                    className="absolute right-0 top-[calc(100%+6px)] origin-top-right w-44 bg-surface-container-lowest/90 backdrop-blur-overlay-2xl border border-white/20 border-t-white/40 border-b-white/10 rounded-2xl shadow-[shadow:var(--glass-highlight-lg),0_16px_40px_-6px_rgba(0,0,0,0.9)] z-50 overflow-hidden p-1"
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
                                                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer",
                                                sortBy === opt.value
                                                    ? "text-black bg-white/95 font-bold shadow-[0_2px_10px_rgba(255,255,255,0.3)]"
                                                    : "text-on-surface-variant hover:text-white hover:bg-white/10"
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

            {/* Fila Inferior: solo Filtro de Estado (la Era vive en la píldora superior) */}
            <div className="flex items-center justify-start gap-2.5 pt-2 border-t border-white/10">
                {/* Filtro de Estado (Todas, Vistas, Sin ver): segmented control §5.3 */}
                <div
                    role="radiogroup"
                    aria-label="Filtrar por estado"
                    className="flex items-center gap-1 shrink-0 rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5"
                >
                    {STATUS_FILTER_OPTIONS.map((status) => {
                        const isSelected = statusFilter === status.id
                        return (
                            <button
                                key={status.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => setStatusFilter(status.id)}
                                className={cn(
                                    "relative flex min-h-11 items-center rounded-full px-4 text-xs font-semibold shrink-0 cursor-pointer select-none transition-colors duration-base",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                    isSelected ? "text-zinc-950 font-bold" : "text-on-surface-variant hover:text-on-surface",
                                )}
                            >
                                <MagneticIndicator
                                    layoutId="statusFilterActivePill"
                                    active={isSelected}
                                    disableAnimation={!!reduceMotion}
                                    className="bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]"
                                />
                                <span className="relative z-10">{status.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
})
