import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { ERA_TABS, EraTab } from "../-MovieCard"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { SortOption, SORT_OPTIONS } from "./movies-utils"

interface MoviesFilterBarProps {
    allMovies: (Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number })[]
    activeEra: EraTab
    setActiveEra: (era: EraTab) => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    sortOpen: boolean
    setSortOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function MoviesFilterBar({
    allMovies,
    activeEra,
    setActiveEra,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOpen,
    setSortOpen,
}: MoviesFilterBarProps) {
    return (
        <div className="sticky top-0 z-40 bg-[#07070a]/80 backdrop-blur-md border-b border-white/[0.04] transition-all duration-300">
            <div className="max-w-[1700px] mx-auto px-6 md:px-14 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Era tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 py-1">
                    {ERA_TABS.map((tab) => {
                        const count =
                            tab.value === "all"
                                ? allMovies.length
                                : allMovies.filter((m) => m.era === tab.value).length
                        const isActive = activeEra === tab.value
                        return (
                            <motion.button
                                key={tab.value}
                                onClick={() => setActiveEra(tab.value)}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-mono font-black tracking-widest uppercase shrink-0 border transition-colors duration-300",
                                    isActive
                                        ? "border-transparent"
                                        : "text-white/30 border-transparent hover:text-white/60 bg-transparent"
                                )}
                                style={isActive ? { color: tab.color } : {}}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeEraPill"
                                        className="absolute inset-0 rounded-full border z-0"
                                        style={
                                            {
                                                borderColor: tab.color + "40",
                                                backgroundColor: tab.color + "12",
                                            } as any
                                        }
                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{tab.label}</span>
                                <span className="relative z-10 text-[8px] opacity-40 font-bold px-1 rounded bg-white/5">
                                    {count}
                                </span>
                            </motion.button>
                        )
                    })}
                </div>

                {/* Panel de búsqueda y ordenación */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    {/* Buscador de texto */}
                    <div className="relative flex-1 md:w-64">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar Peliculas..."
                            className="w-full bg-[#111115] border border-zinc-800 rounded-lg pl-9 pr-8 py-1.5 text-[11px] font-mono tracking-widest uppercase text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-[10px] font-mono"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>

                    {/* Sort dropdown */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setSortOpen((o) => !o)}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#111115] border border-zinc-800 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M3 4h13M3 8h9M3 12h5m0 0v8m0 0l3-3m-3 3l-3-3"
                                />
                            </svg>
                            <span>{SORT_OPTIONS.find((s) => s.value === sortBy)?.label}</span>
                            <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-3.5 h-3.5 ml-1" />
                            </motion.span>
                        </button>

                        <AnimatePresence>
                            {sortOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-52 bg-[#0d0d12] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden p-1 font-mono"
                                    onMouseLeave={() => setSortOpen(false)}
                                >
                                    {SORT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setSortBy(opt.value)
                                                setSortOpen(false)
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-150",
                                                sortBy === opt.value
                                                    ? "text-orange-400 bg-orange-500/10"
                                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                                            )}
                                        >
                                            <span>{opt.label}</span>
                                            {sortBy === opt.value && <span className="text-orange-500">•</span>}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}
