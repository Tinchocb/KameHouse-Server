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
    description?: string
}

interface VhsCollectionProps {
    items: VhsCollectionItem[]
    onItemClick: (item: VhsCollectionItem) => void
    className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_WIDTH = 200
const EXPANDED_WIDTH = 1200
const GAP = 4

// Helper to generate a consistent color from string
const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 60%, 40%)`
}

const getSeriesColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('super')) return '#1a4a8a' // Azul oscuro
    if (t.includes('kai')) return '#1a5c2e' // Verde
    if (t.includes('gt')) return '#2980b9' // Azul claro
    if (t.includes('daima')) return '#0e6655' // Esmeralda oscuro
    if (t.includes('dragon ball z') || t === 'dbz') return '#b51f1f' // Rojo
    if (t.includes('dragon ball')) return '#d96c14' // Naranja clásico
    return stringToColor(title)
}

const stringToStripeColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs((hash + 40) % 360)
    return `hsl(${h}, 70%, 60%)`
}

const VhsTapeCard = memo(({ 
    item, 
    isSelected, 
    onClick,
    onPlayClick
}: { 
    item: VhsCollectionItem
    isSelected: boolean
    onClick: () => void
    onPlayClick: () => void
}) => {
    const baseColor = item.color || getSeriesColor(item.title)
    const stripeColor = item.color || stringToStripeColor(item.title)
    const progress = item.episodesCount ? (item.watchedCount || 0) / item.episodesCount * 100 : 0
    const progTxt = item.status === "Completado" ? "Completada" : item.status === "En progreso" ? `Ep ${item.watchedCount} de ${item.episodesCount}` : "Sin comenzar"

    return (
        <div 
            onClick={onClick}
            className={cn(
                "h-full flex flex-col cursor-pointer border-r-[0.5px] border-black/40 transition-all duration-300 ease-out min-w-[100px] sm:min-w-[140px] overflow-hidden shrink-0",
                isSelected ? "flex-[2.5] min-w-[280px] sm:min-w-[360px]" : "flex-1"
            )}
        >
            {/* 1. .vhs-poster */}
            <div className="flex-1 relative overflow-hidden bg-[#0d0f14] group">
                {/* Background image & gradient */}
                <div className="absolute inset-0 z-0 bg-zinc-900">
                    <div className="relative w-full h-full">
                        <DeferredImage 
                            src={item.posterUrl || ""} 
                            alt="" 
                            className={cn(
                                "w-full h-full object-cover transition-all duration-700",
                                isSelected ? "brightness-100 scale-105" : "brightness-75 group-hover:brightness-90"
                            )}
                            showSkeleton={true}
                        />
                        <div 
                            className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0a0b10] via-transparent to-transparent"
                            style={{ opacity: isSelected ? 0.95 : 0.5 }}
                        />
                    </div>
                </div>

                {/* Vertical title (hidden when selected) */}
                <div 
                    className={cn(
                        "absolute inset-0 flex items-center justify-center transition-all duration-300 z-10 px-2",
                        isSelected ? "opacity-0 pointer-events-none scale-110" : "opacity-100 scale-100"
                    )}
                >
                    <span 
                        className="text-[15px] sm:text-[18px] font-black tracking-[0.25em] text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] whitespace-nowrap font-display"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                    >
                        {item.title}
                    </span>
                </div>

                {/* Detail overlay (slides up when selected) */}
                <div 
                    className={cn(
                        "absolute left-0 right-0 bottom-0 pt-20 pb-6 px-6 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-20 flex flex-col",
                        isSelected ? "translate-y-0" : "translate-y-[120%]"
                    )}
                    style={{ background: "linear-gradient(transparent 0%, rgba(8,10,15,0.98) 40%)" }}
                >
                    <h3 className="text-[20px] sm:text-[24px] font-black text-white mb-2 leading-[1.1] font-display tracking-tight">{item.title}</h3>
                    <div className="text-[11px] sm:text-[12px] text-white/50 flex items-center gap-2 mb-4 font-medium uppercase tracking-wider">
                        <span className="bg-white/10 px-2 py-0.5 rounded-md">{item.year || "2024"}</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-white/20" />
                        <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-md border border-brand-orange/20">
                            {item.episodesCount ? `${item.episodesCount} EPS` : "?? EPS"}
                        </span>
                    </div>
                    {item.description && (
                        <p className="text-[12px] sm:text-[13px] leading-[1.7] text-white/70 line-clamp-3 sm:line-clamp-5 mb-6 font-medium">
                            {item.description.replace(/<[^>]*>?/gm, '')}
                        </p>
                    )}
                    
                    <div className="flex flex-col mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[9px] sm:text-[10px] font-black tracking-[0.15em] uppercase text-white/40">Watch Progress</span>
                            <span className="text-[11px] font-bold text-brand-orange tabular-nums">{Math.round(progress)}%</span>
                        </div>
                        <div className="relative h-[4px] bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-brand-orange to-[#ff9d5c] rounded-full"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); onPlayClick(); }}
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white rounded-xl text-[13px] sm:text-[14px] font-black tracking-widest uppercase py-4 transition-all flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(255,110,58,0.3)] active:scale-[0.97] hover:-translate-y-0.5"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        Reproducir ahora
                    </button>
                </div>
            </div>

            {/* 2. .vhs-label (Simplified) */}
            <div 
                className="py-3 px-3 flex flex-col gap-1.5 shrink-0 border-t border-white/10"
                style={{ backgroundColor: baseColor }}
            >
                <div className="flex items-center justify-between">
                    <span className="text-[7px] font-black tracking-[0.2em] text-white/60 uppercase">KAME-VHS</span>
                    <span className={cn(
                        "text-[8px] font-bold px-2 py-0.5 rounded-full border",
                        item.status === "Completado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                        item.status === "En progreso" ? "bg-sky-500/20 text-sky-400 border-sky-500/30" :
                        "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    )}>
                        {item.status}
                    </span>
                </div>
                <div className="h-[1px] w-full bg-white/10" />
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black tracking-tight text-white line-clamp-1 uppercase font-display">
                        {item.title}
                    </span>
                    <span className="text-[9px] font-black text-white/50 shrink-0">
                        {item.episodesCount || 0} EP
                    </span>
                </div>
            </div>
        </div>
    )
})
VhsTapeCard.displayName = "VhsTapeCard"

export const VhsCollection = memo(({ 
    items, 
    onItemClick, 
    className 
}: VhsCollectionProps) => {
    const [selectedId, setSelectedId] = useState<string | number | null>(null)

    return (
        <div className={cn("w-full h-full flex flex-col bg-[#0d0f14] overflow-hidden min-h-0", className)}>
            {/* Vhs Row */}
            <div className="flex-1 w-full flex flex-row items-stretch min-h-0 overflow-x-auto no-scrollbar">
                {items.map((item) => (
                    <VhsTapeCard
                        key={item.id}
                        item={item}
                        isSelected={selectedId === item.id}
                        onClick={() => {
                            if (selectedId === item.id) {
                                onItemClick(item)
                            } else {
                                setSelectedId(item.id)
                            }
                        }}
                        onPlayClick={() => onItemClick(item)}
                    />
                ))}
            </div>
            
            {/* Shelf Floor */}
            <div className="h-[22px] shrink-0 bg-[#0a0c10] border-t-[1.5px] border-white/5 flex items-center justify-center">
                <span className="text-[9px] font-bold tracking-[0.14em] text-white/20 uppercase font-sans">KAME-VHS HQ</span>
            </div>
        </div>
    )
})
VhsCollection.displayName = "VhsCollection"
