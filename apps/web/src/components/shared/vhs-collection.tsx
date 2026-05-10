import { useState, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VhsCollectionItem {
    id: string | number
    title: string
    episodesCount?: number
    watchedCount?: number
    genres?: string[]
    year?: string | number
    status?: "Completado" | "En progreso" | "Sin comenzar"
    isNew?: boolean
    color?: string
    posterUrl?: string
    bannerUrl?: string
}

interface VhsCollectionProps {
    items: VhsCollectionItem[]
    onItemClick: (item: VhsCollectionItem) => void
    className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_WIDTH = 140
const EXPANDED_WIDTH = 720
const CARD_HEIGHT = 680
const GAP = 6

// Helper to generate a consistent color from string
const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 60%, 25%)`
}

// ─── Components ───────────────────────────────────────────────────────────────

const VhsTapeCard = memo(({ 
    item, 
    isExpanded, 
    onHover, 
    onClick 
}: { 
    item: VhsCollectionItem
    isExpanded: boolean
    onHover: (hovered: boolean) => void
    onClick: () => void
}) => {
    const baseColor = item.color || stringToColor(item.title)
    const progress = item.episodesCount ? (item.watchedCount || 0) / item.episodesCount * 100 : 0

    return (
        <motion.div
            layout
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onClick={onClick}
            initial={false}
            animate={{ 
                width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                backgroundColor: isExpanded ? "rgba(255,255,255,0.03)" : "transparent"
            }}
            transition={{ 
                duration: 0.45, 
                ease: [0.4, 0, 0.2, 1] 
            }}
            className={cn(
                "relative h-[680px] shrink-0 cursor-pointer overflow-hidden rounded-[8px] border border-white/10 transition-shadow duration-300 select-none",
                isExpanded ? "shadow-2xl z-10" : "shadow-lg z-0"
            )}
        >
            {/* Background Image (Poster) */}
            <div className="absolute inset-0 z-0">
                <DeferredImage 
                    src={item.posterUrl || ""} 
                    alt="" 
                    className={cn(
                        "w-full h-full object-cover transition-all duration-700",
                        isExpanded ? "scale-110 blur-xl opacity-30" : "scale-100 opacity-60"
                    )}
                    showSkeleton={false}
                    fallback={
                        <div 
                            className="w-full h-full opacity-40 blur-2xl"
                            style={{ background: `radial-gradient(circle at 50% 30%, ${baseColor}, transparent 80%)` }}
                        />
                    }
                />
            </div>

            {/* Background Gradient Overlay */}
            <div 
                className="absolute inset-0 z-[1] transition-opacity duration-500"
                style={{ 
                    background: `linear-gradient(180deg, ${baseColor} 0%, #0d0d14 100%)`,
                    opacity: isExpanded ? 0.9 : 0.4
                }}
            />

            {/* Collapsed State: Vertical Title */}
            <AnimatePresence>
                {!isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center py-10 z-[2]"
                    >
                        <h3 className="font-bebas text-[32px] tracking-[0.1em] text-white uppercase [writing-mode:vertical-rl] rotate-180 whitespace-nowrap overflow-hidden drop-shadow-2xl">
                            {item.title}
                        </h3>
                        
                        {/* VHS Reels Detail */}
                        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-2 opacity-60">
                            <div className="flex justify-between w-12 px-1">
                                <div className="w-3 h-3 rounded-full border-2 border-white" />
                                <div className="w-3 h-3 rounded-full border-2 border-white" />
                            </div>
                            <div className="w-12 h-[2px] bg-white/50" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expanded State: Full Metadata */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col z-[2]"
                    >
                        {/* Banner Image at Top */}
                        <div className="h-1/2 w-full relative overflow-hidden">
                            <DeferredImage 
                            src={item.bannerUrl || item.posterUrl || ""} 
                            alt="" 
                            className="w-full h-full object-cover"
                            showSkeleton={false}
                            fallback={
                                <div 
                                    className="w-full h-full opacity-50 blur-3xl scale-150"
                                    style={{ background: `radial-gradient(circle at 50% 30%, ${baseColor}, transparent 70%)` }}
                                />
                            }
                        />
                        {!item.bannerUrl && !item.posterUrl && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center">
                                        <div className="w-1 h-1 bg-white/40 rounded-full" />
                                    </div>
                                    <span className="text-[8px] font-black tracking-[0.2em] text-white/40 uppercase">Sin Imagen</span>
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent" />
                            
                            {/* "NEW" Badge */}
                            {item.isNew && (
                                <div className="absolute top-4 right-4 bg-[#ffe600] text-black text-[10px] font-black px-2 py-1 rounded-[4px] shadow-xl">
                                    NEW
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col p-6 space-y-4">
                            {/* Metadata Badges */}
                            <div className="flex flex-wrap gap-2">
                                {item.genres?.map(genre => (
                                    <span key={genre} className="text-[9px] font-black uppercase tracking-widest text-white/60 bg-white/5 px-2 py-1 rounded-[4px] border border-white/5">
                                        {genre}
                                    </span>
                                ))}
                                {item.episodesCount && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-orange bg-brand-orange/10 px-2 py-1 rounded-[4px] border border-brand-orange/20">
                                        {item.episodesCount} EPISODIOS
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1">
                                <h2 className="font-bebas text-5xl leading-none text-white uppercase tracking-wider">
                                    {item.title}
                                </h2>
                                <div className="flex items-center justify-between text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">
                                    <span>Lanzamiento: {item.year || "2024"}</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-sm bg-white/5 border border-white/5",
                                        item.status === "Completado" ? "text-green-400" : 
                                        item.status === "En progreso" ? "text-brand-orange" : "text-white/20"
                                    )}>
                                        {item.status || "Sin comenzar"}
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar Container */}
                            <div className="mt-auto space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-widest">
                                        <span>Progreso</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1, delay: 0.3 }}
                                            className="h-full bg-[#ffe600] shadow-[0_0_15px_rgba(255,230,0,0.5)]"
                                        />
                                    </div>
                                </div>

                                {/* Play Button */}
                                <button className="w-full h-14 bg-white text-black hover:bg-[#ffe600] transition-all duration-300 font-black text-[12px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 rounded-[4px] shadow-2xl active:scale-95 group">
                                    <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                                    INICIAR REPRODUCCIÓN
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

export const VhsCollection = memo(({ 
    items, 
    onItemClick, 
    className 
}: VhsCollectionProps) => {
    const [hoveredId, setHoveredId] = useState<string | number | null>(null)

    return (
        <div className={cn("w-full bg-[#0d0d14] py-10 px-12 overflow-hidden", className)}>
            <div className="flex flex-row items-center gap-[6px] w-full overflow-x-auto no-scrollbar pb-10">
                {items.map((item) => (
                    <VhsTapeCard
                        key={item.id}
                        item={item}
                        isExpanded={hoveredId === item.id}
                        onHover={(hovered) => setHoveredId(hovered ? item.id : null)}
                        onClick={() => onItemClick(item)}
                    />
                ))}
            </div>
        </div>
    )
})
