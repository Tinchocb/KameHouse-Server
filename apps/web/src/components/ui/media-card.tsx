import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/api/types/intelligence.types"
import { Play, Info } from "lucide-react"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getHighResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import { GlowingEffect } from "@/components/shared/glowing-effect"

export interface MediaCardProps {
    artwork: string
    title: string
    subtitle?: string
    badge?: string
    availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    description?: string
    aspect?: CardAspect
    progress?: number
    year?: string | number
    rating?: number
    episodeNumber?: number
    onClick?: () => void
    className?: string
    layoutId?: string
}

export const MediaCard = React.memo(function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    description,
    aspect = "poster",
    progress,
    year,
    rating,
    episodeNumber,
    onClick,
    className,
    layoutId,
}: MediaCardProps) {
    const isPoster = aspect === "poster"
    const [isHovered, setIsHovered] = React.useState(false)

    return (
        <motion.div
            layoutId={layoutId}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "group relative shrink-0 cursor-pointer overflow-hidden bg-zinc-900/40 transition-all duration-500",
                "border border-white/5 hover:border-white/20",
                isPoster
                    ? "aspect-[2/3] w-[160px] md:w-[200px] lg:w-[240px] rounded-xl"
                    : "aspect-[16/9] w-[280px] md:w-[380px] lg:w-[440px] rounded-2xl",
                className
            )}
        >
            {/* Glowing effect */}
            <GlowingEffect glow={isHovered} blur={6} spread={30} disabled={false} borderWidth={1.5} />

            {/* ── Artwork ─────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                <DeferredImage
                    src={getHighResImage(artwork)}
                    alt={title}
                    className={cn(
                        "h-full w-full object-cover transition-transform duration-1000 ease-[0.23,1,0.32,1]",
                        isHovered ? "scale-105 brightness-50" : "scale-100"
                    )}
                />
                {/* Gradient Overlay Premium (No Neon) */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent opacity-90 transition-opacity duration-700" />
            </div>

            {/* ── Asymmetric Episode Badge ────────────────── */}
            {episodeNumber !== undefined && (
                <div className="absolute top-0 left-0 z-20">
                    <div className="bg-white text-zinc-950 px-3 py-1.5 rounded-br-xl font-black text-xs tracking-widest uppercase">
                        EP {episodeNumber}
                    </div>
                </div>
            )}

            {/* ── Content ─────────────────────────────────── */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 md:p-6">
                <AnimatePresence>
                    {!isHovered ? (
                        <motion.div
                            key="static-info"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-1"
                        >
                            <h3 className="font-bebas text-xl md:text-2xl leading-none tracking-tight text-white line-clamp-1">
                                {title}
                            </h3>
                            {subtitle && (
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                                    {subtitle}
                                </p>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="hover-info"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 15 }}
                            transition={{ type: "spring", damping: 25, stiffness: 120 }}
                            className="space-y-5"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl hover:scale-105 transition-transform">
                                    <Play size={20} fill="currentColor" className="ml-1" />
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 transition-colors">
                                    <Info size={20} />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <h3 className="font-bebas text-3xl md:text-4xl leading-[0.9] text-white uppercase tracking-normal">
                                    {title}
                                </h3>
                                
                                <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                    {rating && <span className="text-primary font-black">{(rating * 10).toFixed(0)}% MATCH</span>}
                                    <span>{year}</span>
                                    {badge && <span className="border border-white/10 bg-white/5 backdrop-blur-md px-2 py-0.5 rounded text-zinc-300">{badge}</span>}
                                </div>

                                {description && (
                                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400 font-medium pt-1">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Progress ─────────────────────────────────── */}
            {progress !== undefined && (
                <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/10">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-primary"
                    />
                </div>
            )}
        </motion.div>
    )
})
