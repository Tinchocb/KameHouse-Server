import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/api/types/intelligence.types"
import { Folder, ImageOff, Play, Zap } from "lucide-react"
import * as React from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { DeferredImage } from "@/components/shared/deferred-image"
import { motion } from "framer-motion"
import { getHighResImage } from "@/lib/helpers/images"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaCardProps {
    artwork: string
    title: string
    subtitle?: string
    /** Top-left format badge (e.g. "TV", "MOVIE") */
    badge?: string
    availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    description?: string
    /** Enforce strict aspect ratio */
    aspect?: CardAspect
    progress?: number
    progressColor?: "white" | "zinc"
    /** Intelligence ContentTag — rendered as a tiny bottom label */
    intelligenceTag?: string
    /** Quick metadata for the hover ribbon */
    year?: string | number
    rating?: number
    onClick?: () => void
    className?: string
    /** Unique ID for shared element transitions */
    layoutId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

const MediaCardCompare = (
    prevProps: Readonly<MediaCardProps>,
    nextProps: Readonly<MediaCardProps>
): boolean => {
    return (
        prevProps.artwork === nextProps.artwork &&
        prevProps.title === nextProps.title &&
        prevProps.subtitle === nextProps.subtitle &&
        prevProps.progress === nextProps.progress &&
        prevProps.availabilityType === nextProps.availabilityType &&
        prevProps.badge === nextProps.badge &&
        prevProps.rating === nextProps.rating &&
        prevProps.year === nextProps.year &&
        prevProps.intelligenceTag === nextProps.intelligenceTag &&
        prevProps.className === nextProps.className
    )
}

export const MediaCard = React.memo(function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    availabilityType,
    description,
    aspect = "poster",
    progress,
    progressColor: _progressColor = "white",
    intelligenceTag: _intelligenceTag,
    year,
    rating,
    onClick,
    className,
    layoutId,
}: MediaCardProps) {
    const isPoster = aspect === "poster"
    const cardRef = React.useRef<HTMLDivElement>(null)
    const shineRef = React.useRef<HTMLDivElement>(null)
    const hasEnteredRef = React.useRef(false)

    // 3D Tilt effect with mouse position tracking
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return

        const rect = cardRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((y - centerY) / centerY) * -8
        const rotateY = ((x - centerX) / centerX) * 8

        gsap.to(cardRef.current, {
            rotationX: rotateX,
            rotationY: rotateY,
            duration: 0.3,
            ease: "power2.out",
            overwrite: "auto",
        })
    }

    const handleMouseLeave = () => {
        if (!cardRef.current) return
        gsap.to(cardRef.current, {
            rotationX: 0,
            rotationY: 0,
            duration: 0.6,
            ease: "elastic.out(1, 0.5)",
            overwrite: "auto",
        })
    }

    // Shine sweep effect on first enter
    useGSAP(() => {
        if (!shineRef.current) return

        const handleMouseEnter = () => {
            if (hasEnteredRef.current) return
            hasEnteredRef.current = true

            gsap.fromTo(
                shineRef.current,
                { left: "-100%", opacity: 0.6 },
                {
                    left: "200%",
                    opacity: 0,
                    duration: 0.8,
                    ease: "power2.inOut",
                }
            )
        }

        const card = cardRef.current
        if (card) {
            card.addEventListener("mouseenter", handleMouseEnter)
            return () => card.removeEventListener("mouseenter", handleMouseEnter)
        }
    }, { scope: cardRef })

    // Progress bar expands height slightly on card hover via CSS, removing the need for shadow pulsing JS logic

    const [hasImageError, setHasImageError] = React.useState(false)

    // Netflix-style Fallback UI
    const fallbackUI = (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6 text-center">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <ImageOff className="relative h-12 w-12 text-zinc-700 opacity-50" />
            </div>
            <div className="mt-auto w-full space-y-2">
                <p className="font-bebas text-3xl text-white/20 line-clamp-2 uppercase leading-none tracking-widest">
                    {title}
                </p>
                {year && (
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                        {year}
                    </p>
                )}
            </div>
        </div>
    )

    return (
        <motion.div
            ref={cardRef}
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick?.()}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            layoutId={layoutId}
            whileHover={{
                scale: 1.02,
                transition: { duration: 0.2, ease: "easeOut" }
            }}
            className={cn(
                // Base
                "group/card relative shrink-0 cursor-pointer overflow-hidden rounded-[28px] border border-white/[0.05] transition-all duration-700",
                "bg-zinc-950/40 hover:border-primary/30 hover:z-50",
                "shadow-lg hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]",
                "hover:ring-1 hover:ring-primary/20",
                // Intrinsic sizing
                isPoster
                    ? "aspect-[2/3] w-[150px] md:w-[185px] lg:w-[220px]"
                    : "aspect-[16/9] w-[260px] md:w-[340px] lg:w-[400px]",
                className,
            )}
            style={{
                transformStyle: "preserve-3d",
                perspective: "1000px",
            }}
        >
            {/* ── Shine Sweep Effect ─────────────────────── */}
            <div
                ref={shineRef}
                className="absolute inset-0 z-40 pointer-events-none overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12" />
            </div>

            {/* ── Artwork (Deferred) ────────────────────── */}
            <DeferredImage
                src={getHighResImage(artwork)}
                alt={title}
                fallback={fallbackUI}
                onError={() => setHasImageError(true)}
                className={cn(
                    "absolute inset-0 h-full w-full select-none object-cover transition-all duration-700 group-hover/card:scale-110 group-hover/card:brightness-50",
                    (!artwork || hasImageError) && "opacity-0" 
                )}
            />

            {/* ── Top-right: Source Icon ─────────────────── */}
            {availabilityType && (
                <div className="absolute right-0 top-0 z-20">
                    <span className="flex h-8 w-8 items-center justify-center bg-zinc-950/60 backdrop-blur-md rounded-bl-2xl border-l border-b border-white/5 text-primary">
                        {availabilityType === "ONLY_ONLINE" ? (
                            <Zap className="h-3.5 w-3.5 fill-current" />
                        ) : (
                            <Folder className="h-3.5 w-3.5 fill-current" />
                        )}
                    </span>
                </div>
            )}

            {/* ── Top-left: Format Badge ──────────────── */}
            {badge && (
                <div className="absolute left-0 top-0 z-20">
                    <span className="bg-primary/10 backdrop-blur-md px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-primary rounded-br-2xl border-r border-b border-white/5">
                        {badge}
                    </span>
                </div>
            )}

            {/* ── Bottom Gradient ─────────────────────────────────── */}
            <div
                className={cn(
                    "absolute inset-x-0 bottom-0 z-10",
                    isPoster ? "h-[50%]" : "h-[60%]",
                    "bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-500 group-hover/card:opacity-0",
                )}
            />

            {/* ── Info Container (Rest State) ─────────────────────── */}
            <div className="absolute inset-x-0 bottom-0 z-20 p-5 transition-transform duration-500 group-hover/card:translate-y-full">
                <p className="line-clamp-1 text-[16px] font-black leading-tight text-white uppercase tracking-tight font-display drop-shadow-lg">
                    {title}
                </p>

                <div className="mt-1.5 flex items-center justify-between gap-1">
                    {subtitle && (
                        <p className="truncate text-[10px] font-black text-white/50 uppercase tracking-[0.15em]">{subtitle}</p>
                    )}
                </div>
            </div>

            {/* ── Hover Overlay (Active State) ────────────────── */}
            <div className="absolute inset-0 z-30 flex flex-col justify-end bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent p-5 opacity-0 transition-all duration-500 group-hover/card:opacity-100">
                <div className="flex flex-col gap-3 translate-y-2 transition-transform duration-500 group-hover/card:translate-y-0">
                    
                    {/* Netflix Action Row */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 hover:scale-110 active:scale-95 shadow-xl">
                            <Play className="ml-1 h-5 w-5 fill-current" />
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/40 bg-zinc-900/40 backdrop-blur-sm text-white transition-all duration-300 hover:border-white hover:bg-zinc-800">
                            <span className="text-xl font-light">+</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <h3 className="line-clamp-2 font-bebas text-[2.2rem] leading-[0.85] text-white uppercase tracking-tight">
                            {title}
                        </h3>
                        
                        {/* Netflix Metadata Row */}
                        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider">
                            {rating && (
                                <span className="text-emerald-400 font-black">
                                    {(rating * 10).toFixed(0)}% Match
                                </span>
                            )}
                            <span className="text-white/60">•</span>
                            <span className="text-white/80">{year}</span>
                            <span className="text-white/60">•</span>
                            <span className="border border-white/30 px-1.5 py-0.5 rounded-sm text-[9px] text-white/70">{badge}</span>
                        </div>
                    </div>

                    {description && (
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-300/90 font-medium">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Progress Bar ──────────────────────────────────────────── */}
            {progress !== undefined && (
                <div className="absolute inset-x-0 bottom-0 z-50 h-[1.5px] bg-white/10 group-hover/card:h-[3.5px] transition-all duration-300">
                    <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            )}
        </motion.div>
    )
}, MediaCardCompare)
MediaCard.displayName = "MediaCard"
