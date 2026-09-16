import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconNavigationSearch, IconUiClose, IconArrowDownUp, IconNavigationChevronDown } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { SortOption, SORT_OPTIONS } from "./movies-utils"

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
    totalCount,
    filteredCount,
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

    return (
        <div className="w-full flex flex-col gap-3.5 select-none pb-2">
            {/* Fila Superior: Título, Contador, Buscador y Dropdown de Orden */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Título y Conteo */}
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-on-surface font-display leading-none">
                            Películas de Dragon Ball
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
                            {filteredCount === totalCount ? `${totalCount} títulos` : `${filteredCount} de ${totalCount}`}
                        </span>
                    </div>
                </div>

                {/* Buscador y Orden */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {/* Campo de búsqueda */}
                    <div className="relative flex-1 sm:w-60 md:w-64">
                        <IconNavigationSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar película... (/)"
                            className="w-full bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 rounded-full py-1.5 pl-9 pr-8 text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/40 transition-all backdrop-blur-overlay-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors"
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
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-950/45 hover:bg-zinc-900/60 border border-white/20 border-t-white/40 border-b-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all backdrop-blur-overlay-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] cursor-pointer"
                        >
                            <IconArrowDownUp className="w-3 h-3 text-zinc-400" />
                            <span className="hidden md:inline">{SORT_OPTIONS.find((s) => s.value === sortBy)?.label}</span>
                            <span className="md:hidden">Orden</span>
                            <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
                                <IconNavigationChevronDown className="w-3 h-3 text-zinc-400" />
                            </motion.span>
                        </button>

                        <AnimatePresence>
                            {sortOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                    className="absolute right-0 top-[calc(100%+6px)] w-44 bg-zinc-950/80 backdrop-blur-overlay-2xl border border-white/20 border-t-white/40 border-b-white/10 rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_16px_40px_-6px_rgba(0,0,0,0.9)] z-50 overflow-hidden p-1"
                                >
                                    {SORT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                setSortBy(opt.value)
                                                setSortOpen(false)
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer",
                                                sortBy === opt.value
                                                    ? "text-zinc-950 bg-white/95 font-bold shadow-[0_2px_10px_rgba(255,255,255,0.3)]"
                                                    : "text-zinc-300 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            <span>{opt.label}</span>
                                            {sortBy === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Fila Inferior: solo Filtro de Estado (la Era vive en la píldora superior) */}
            <div className="flex items-center justify-start gap-2.5 pt-2 border-t border-white/10">
                {/* Filtro de Estado (Todas, Vistas, Sin ver) */}
                <div className="flex items-center gap-1 shrink-0 bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 rounded-full p-1 backdrop-blur-overlay-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.6)]">
                    {STATUS_FILTER_OPTIONS.map((status) => {
                        const isSelected = statusFilter === status.id
                        return (
                                <button
                                        key={status.id}
                                        type="button"
                                        onClick={() => setStatusFilter(status.id)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                    "relative px-3.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 cursor-pointer select-none",
                                    isSelected
                                        ? "text-zinc-950"
                                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="statusFilterActivePill"
                                        transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                        className="absolute inset-0 bg-white/95 rounded-full shadow-[0_2px_12px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)] -z-0"
                                    />
                                )}
                                <span className="relative z-10">{status.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
})
