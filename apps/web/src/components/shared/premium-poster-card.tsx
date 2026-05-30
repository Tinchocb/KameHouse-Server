import * as React from "react"
import { Play, Star, Info, Calendar } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "./deferred-image"
import { getHighResImage, getMediumResImage } from "@/lib/helpers/images"

interface PremiumPosterCardProps {
    id: number
    title: string
    posterUrl: string
    rating?: number
    year?: number
    format?: string
    genres?: string[]
    onClick?: () => void
    className?: string
}

export const PremiumPosterCard = React.memo(({
    title,
    posterUrl,
    rating,
    year,
    format,
    genres,
    onClick,
    className
}: PremiumPosterCardProps) => {
    const formattedRating = rating 
        ? (rating > 10 ? rating / 10 : rating).toFixed(1) 
        : null

    const playHoverSound = () => {
        const audio = new Audio("/sounds/seleccion de hover.wav")
        audio.volume = 0.15
        audio.play().catch(() => {})
    }

    return (
        <div 
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onMouseEnter={playHoverSound}
            onKeyDown={(e) => {
                if (onClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                "group relative aspect-[2/3] w-full cursor-pointer rounded-2xl bg-zinc-900 shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out focus-visible:ring-4 focus-visible:ring-brand-orange focus-visible:ring-offset-4 focus-visible:ring-offset-background transform-gpu",
                className
            )}
        >
            {/* ── Background & Poster ── */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
                <DeferredImage
                    src={getMediumResImage(posterUrl)}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 transform-gpu"
                />
                
                {/* ── Overlays ── */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
                
                {/* ── Static Subtle Glow on Hover ── */}
                <div 
                    className="pointer-events-none absolute inset-0 bg-brand-orange/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 transform-gpu"
                />

                {/* ── Top Badges ── */}
                <div className="absolute right-3 top-3 flex flex-col gap-2">
                    {formattedRating && (
                        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-xl border border-white/10">
                            <Star className="h-3 w-3 fill-brand-orange text-brand-orange" />
                            <span className="text-[10px] font-black text-white">{formattedRating}</span>
                        </div>
                    )}
                    {format && (
                        <div className="rounded-full bg-brand-orange px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                            {format}
                        </div>
                    )}
                </div>

                {/* ── Hover Content ── */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5 translate-y-4 opacity-0 transition-[transform,opacity] duration-500 group-hover:translate-y-0 group-hover:opacity-100 transform-gpu">
                    <div className="flex flex-wrap gap-2">
                        {genres?.slice(0, 2).map(g => (
                            <span key={g} className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20 backdrop-blur-md">
                                {g}
                            </span>
                        ))}
                    </div>
                    
                    <h3 className="text-[18px] sm:text-[22px] font-black uppercase leading-[1.1] tracking-tight text-white line-clamp-2 font-display drop-shadow-2xl">
                        {title}
                    </h3>
                    
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4">
                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange text-white transition-transform duration-300 hover:scale-110 shadow-lg shadow-brand-orange/30 transform-gpu">
                                <Play className="h-5 w-5 fill-current" />
                            </button>
                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-[transform,background-color] duration-300 hover:scale-110 hover:bg-white/20 border border-white/10 transform-gpu">
                                <Info className="h-5 w-5" />
                            </button>
                        </div>
                        {year && (
                            <div className="flex items-center gap-1.5 text-white/50">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="text-[12px] font-black tracking-widest">{year}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Default Content (Static) ── */}
                <div className="absolute inset-x-0 bottom-0 p-5 transition-opacity duration-500 group-hover:opacity-0 bg-gradient-to-t from-black/80 to-transparent">
                    <h3 className="text-[16px] font-black uppercase tracking-tight text-white line-clamp-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-display">
                        {title}
                    </h3>
                </div>
            </div>

            {/* ── Glass Shine Effect ── */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>
    )
})

PremiumPosterCard.displayName = "PremiumPosterCard"
