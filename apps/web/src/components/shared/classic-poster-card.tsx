import { memo } from "react"
import { motion } from "framer-motion"
import { Anime_Entry } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getHighResImage } from "@/lib/helpers/images"
import { cn } from "@/components/ui/core/styling"

interface ClassicPosterCardProps {
    entry: Anime_Entry
    className?: string
    onClick?: () => void
    posterUrlOverride?: string
}

export const ClassicPosterCard = memo(function ClassicPosterCard({
    entry,
    className,
    onClick,
    posterUrlOverride
}: ClassicPosterCardProps) {
    const media = entry.media
    if (!media) return null

    const title = media.titleSpanish || media.titleRomaji || media.titleEnglish || "Sin título"
    
    return (
        <div 
            onClick={onClick}
            className={cn(
                "relative group select-none", 
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Main Poster Container */}
            <div className="relative aspect-[2/3] w-full overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl rounded-2xl">
                {/* Poster Image */}
                <DeferredImage
                    src={getHighResImage(posterUrlOverride || media.posterImage || "")}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    showSkeleton={false}
                />

                {/* Overlays */}
                {/* 1. Subtle Inner Glow/Border */}
                <div className="absolute inset-0 border-[0.5px] border-white/20 pointer-events-none z-10" />
                
                {/* 2. Glossy Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.05] pointer-events-none z-10" />

                {/* 3. Bottom Gradient for Badges */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent z-10" />

                {/* Badges Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-20">
                    <div className="flex flex-col gap-1">
                        {media.year && (
                            <span className="text-[10px] font-black tracking-[0.3em] text-white/60 uppercase">
                                {media.year}
                            </span>
                        )}
                        <span className="text-[12px] font-black tracking-[0.1em] text-white uppercase border-b border-brand-orange pb-0.5">
                            {media.format || "TV"}
                        </span>
                    </div>

                    {media.score && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-brand-orange tracking-widest uppercase">SCORE</span>
                            <span className="text-[20px] font-bebas text-white tracking-widest leading-none">
                                {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Interactive Border on Hover */}
                <motion.div 
                    className="absolute inset-0 border-2 border-brand-orange opacity-0 z-30 pointer-events-none rounded-2xl"
                    variants={{
                        hover: { opacity: 1, scale: 1 },
                        idle: { opacity: 0, scale: 1.02 }
                    }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Decorative Shadow Base */}
            <div className="absolute -bottom-4 inset-x-4 h-8 bg-black/40 blur-2xl rounded-full -z-10 group-hover:bg-brand-orange/10 transition-colors duration-500" />
            
            {/* Title Display (Optional, since it's in the HeroSection too) */}
            <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] font-black tracking-[0.4em] text-brand-orange uppercase text-center truncate">
                    {title}
                </p>
            </div>
        </div>
    )
})
