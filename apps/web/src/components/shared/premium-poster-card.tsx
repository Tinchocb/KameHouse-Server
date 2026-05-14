import * as React from "react"
import { motion } from "framer-motion"
import { Play, Star, Info, Calendar } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "./deferred-image"
import { getHighResImage } from "@/lib/helpers/images"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

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
    id,
    title,
    posterUrl,
    rating,
    year,
    format,
    genres,
    onClick,
    className
}: PremiumPosterCardProps) => {
    const cardRef = React.useRef<HTMLDivElement>(null)
    const glowRef = React.useRef<HTMLDivElement>(null)

    const formattedRating = rating 
        ? (rating > 10 ? rating / 10 : rating).toFixed(1) 
        : null

    useGSAP(() => {
        const card = cardRef.current
        const glow = glowRef.current
        if (!card || !glow) return

        const onMouseMove = (e: MouseEvent) => {
            const rect = card.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            
            gsap.to(glow, {
                x: x - 75,
                y: y - 75,
                duration: 0.6,
                ease: "power2.out"
            })

            const rotateX = (y / rect.height - 0.5) * 10
            const rotateY = (x / rect.width - 0.5) * -10
            
            gsap.to(card, {
                rotateX,
                rotateY,
                duration: 0.4,
                ease: "power2.out"
            })
        }

        const onMouseLeave = () => {
            gsap.to(card, {
                rotateX: 0,
                rotateY: 0,
                duration: 0.6,
                ease: "elastic.out(1, 0.3)"
            })
        }

        card.addEventListener("mousemove", onMouseMove)
        card.addEventListener("mouseleave", onMouseLeave)
        return () => {
            card.removeEventListener("mousemove", onMouseMove)
            card.removeEventListener("mouseleave", onMouseLeave)
        }
    }, { scope: cardRef })

    return (
        <div 
            ref={cardRef}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={(e) => {
                if (onClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                "group relative aspect-[2/3] w-full cursor-pointer rounded-2xl bg-zinc-900 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] focus-visible:ring-4 focus-visible:ring-brand-orange focus-visible:ring-offset-4 focus-visible:ring-offset-background",
                "perspective-1000",
                className
            )}
            style={{ transformStyle: "preserve-3d" }}
        >
            {/* ── Background & Poster ── */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
                <DeferredImage
                    src={getHighResImage(posterUrl)}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* ── Overlays ── */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
                
                {/* ── Interactive Glow (Cursor Follow) ── */}
                <div 
                    ref={glowRef}
                    className="pointer-events-none absolute h-40 w-40 rounded-full bg-brand-orange/20 blur-[60px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
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
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
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
                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange text-white transition-all hover:scale-110 shadow-lg shadow-brand-orange/30">
                                <Play className="h-5 w-5 fill-current" />
                            </button>
                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-all hover:bg-white/20 border border-white/10">
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
