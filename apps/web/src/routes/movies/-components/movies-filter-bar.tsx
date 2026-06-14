import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Search, X, ArrowDownUp } from "lucide-react"
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
        <div className="sticky top-0 z-40 bg-[#07070a]/70 backdrop-blur-xl border-b border-white/5 transition-all duration-300 shadow-2xl">
            <div className="max-w-[1700px] mx-auto px-6 md:px-14 py-4 flex flex-col md:flex-row md:items-center justify-between gap-5">
                
                {/* Era Glass Capsules */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 py-1">
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
                                    "relative flex items-center h-10 px-5 text-[11px] font-sans font-bold tracking-wider uppercase shrink-0 rounded-full transition-all duration-300 overflow-hidden select-none border",
                                    isActive
                                        ? "text-white border-transparent"
                                        : "text-zinc-400 border-white/5 bg-white/[0.02] hover:text-white hover:border-white/10 hover:bg-white/[0.05]"
                                )}
                                style={isActive ? { 
                                    backgroundColor: tab.color + "20",
                                    borderColor: tab.color + "40",
                                    boxShadow: `0 0 20px ${tab.color}15`,
                                } : {}}
                            >
                                {/* Active subtle glow behind text */}
                                {isActive && (
                                    <div 
                                        className="absolute inset-0 opacity-50 blur-md pointer-events-none"
                                        style={{ backgroundColor: tab.color }}
                                    />
                                )}
                                
                                <span className="relative z-10" style={isActive ? { color: tab.color } : {}}>
                                    {tab.label}
                                </span>
                                
                                <span 
                                    className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full ml-3 transition-colors duration-300 flex items-center justify-center min-w-[20px]"
                                    style={{
                                        backgroundColor: isActive ? tab.color + "40" : "rgba(255,255,255,0.06)",
                                        color: isActive ? "#fff" : "rgba(255,255,255,0.5)"
                                    }}
                                >
                                    {count}
                                </span>
                            </motion.button>
                        )
                    })}
                </div>
 
                {/* Search and Sort Section */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    
                    {/* Search Input */}
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-brand-orange transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar Películas..."
                            className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-full pl-11 pr-10 py-2.5 text-[12px] font-sans font-medium tracking-wide text-white placeholder-zinc-500 focus:outline-none focus:border-brand-orange/40 focus:bg-brand-orange/5 focus:ring-4 focus:ring-brand-orange/10 transition-all duration-300"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
 
                    {/* Sort Dropdown */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setSortOpen((o) => !o)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-[11px] font-sans font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:border-white/15 transition-all duration-300"
                        >
                            <ArrowDownUp className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{SORT_OPTIONS.find((s) => s.value === sortBy)?.label}</span>
                            <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-3.5 h-3.5 ml-1 text-zinc-500" />
                            </motion.span>
                        </button>
 
                        <AnimatePresence>
                            {sortOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="absolute right-0 top-[calc(100%+8px)] w-56 bg-[#0f0f13]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden p-1.5"
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
                                                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-sans font-bold tracking-wide transition-all duration-200",
                                                sortBy === opt.value
                                                    ? "text-brand-orange bg-brand-orange/10"
                                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            <span>{opt.label}</span>
                                            {sortBy === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-brand-orange" />}
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
