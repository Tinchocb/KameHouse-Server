import { memo } from "react"
import { motion } from "framer-motion"
import { Play } from "lucide-react"
import { FaStar } from "react-icons/fa"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"

interface CassetteCardProps {
    entry: Anime_LibraryCollectionEntry
    onClick?: () => void
    className?: string
    size?: "normal" | "hero"
}

// SVG Reel for the realistic cassette tape
const CassetteReel = () => (
    <motion.svg
        variants={{
            idle: { rotate: 0 },
            hover: { rotate: 360, transition: { repeat: Infinity, duration: 3, ease: "linear" } }
        }}
        className="w-full h-full max-w-[32px] max-h-[32px] text-zinc-700/80 fill-zinc-900/60"
        viewBox="0 0 100 100"
    >
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" />
        <path d="M 50 15 L 50 85 M 15 50 L 85 50 M 25 25 L 75 75 M 25 75 L 75 25" stroke="currentColor" strokeWidth="6" />
        <circle cx="50" cy="50" r="16" fill="#03060f" stroke="currentColor" strokeWidth="4" />
    </motion.svg>
)

export const CassetteCard = memo(function CassetteCard({
    entry,
    onClick,
    className,
    size = "normal"
}: CassetteCardProps) {
    const media = entry.media
    if (!media) return null

    const title = media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin título"
    const score = media.score 
        ? (media.score > 10 ? media.score / 10 : media.score).toFixed(1)
        : null

    const SPINE_WIDTH = size === "hero" ? 56 : 40

    return (
        <motion.div 
            className={cn("group relative cursor-pointer", className)}
            initial="idle"
            whileHover="hover"
            animate="idle"
            style={{ transformStyle: "preserve-3d" }}
            onClick={onClick}
        >
            {/* ── 1. The Slidable Plastic Cassette Tape Body (Slides Up on Hover) ── */}
            <motion.div
                className="absolute inset-x-2 bg-gradient-to-b from-[#0e1220] to-[#04060b] border border-white/10 rounded-xl p-3 flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.8)] overflow-hidden"
                style={{
                    aspectRatio: "1 / 1.7",
                    zIndex: 5,
                    transformOrigin: "bottom center"
                }}
                variants={{
                    idle: { 
                        y: 0, 
                        scale: 0.95, 
                        opacity: 0,
                        rotateY: 0,
                        rotateX: 0
                    },
                    hover: { 
                        y: size === "hero" ? "-55%" : "-45%", 
                        scale: 1, 
                        opacity: 1,
                        rotateY: size === "hero" ? -4 : -8, 
                        rotateX: size === "hero" ? 2 : 4,
                        transition: { type: "spring", stiffness: 180, damping: 18 } 
                    }
                }}
            >
                {media.bannerImage && (
                    <div className="absolute inset-0 z-0 opacity-20">
                        <DeferredImage src={media.bannerImage} alt="Tape Label" className="w-full h-full object-cover" showSkeleton={false} />
                    </div>
                )}
                
                {/* Cassette Top notches & brand label */}
                <div className="relative z-10 flex justify-between items-center px-1 border-b border-white/5 pb-2">
                    <span className={cn("font-mono font-black text-brand-orange/80 tracking-widest uppercase", size === "hero" ? "text-[10px]" : "text-[7px]")}>
                        KAMEHOUSE TAPE
                    </span>
                    <span className={cn("font-mono text-zinc-500 font-bold tracking-tight", size === "hero" ? "text-[10px]" : "text-[7px]")}>
                        SIDE A
                    </span>
                </div>

                {/* Cassette Mechanical Reels Center section */}
                <div className="relative z-10 py-2 px-1 bg-[#020408]/90 border border-white/10 rounded-lg flex items-center justify-around h-1/4 min-h-[40px] shadow-inner">
                    {/* Spool background window */}
                    <div className="absolute inset-y-2 inset-x-6 bg-zinc-950/80 rounded border border-white/5 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-brand-orange/20 to-transparent" />
                    </div>
                    <div className="h-full aspect-square flex items-center justify-center relative z-10"><CassetteReel /></div>
                    <div className="h-full aspect-square flex items-center justify-center relative z-10"><CassetteReel /></div>
                </div>

                {/* Bottom recording specifications info */}
                <div className={cn("relative z-10 flex flex-col gap-1.5 px-1 pt-1 font-mono", size === "hero" ? "text-[11px]" : "text-[8px]")}>
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-zinc-500 shrink-0">VOL:</span>
                        <span className="font-bold text-white uppercase tracking-tight line-clamp-2 text-right">
                            {title}
                        </span>
                    </div>
                    {media.totalEpisodes && (
                        <div className="flex justify-between items-center text-brand-orange/90">
                            <span>EPS:</span>
                            <span className="font-bold tabular-nums">
                                {media.totalEpisodes}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── 2. The Translucent Protective Sleeve/Case (Main Front Area) ── */}
            <motion.div
                className="relative z-10 w-full h-full overflow-hidden bg-[#0d111d]/45 border border-white/5 rounded-2xl shadow-xl flex flex-col justify-end"
                style={{
                    aspectRatio: "1 / 1.7",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.02)",
                    backdropFilter: "blur(12px)",
                    transformStyle: "preserve-3d"
                }}
                variants={{
                    idle: { rotateY: 0, rotateX: 0, scale: 1 },
                    hover: { 
                        rotateY: size === "hero" ? -4 : -8, 
                        rotateX: size === "hero" ? 2 : 4, 
                        scale: 1.02, 
                        borderColor: "rgba(255,110,58,0.25)",
                        boxShadow: "10px 20px 40px rgba(0,0,0,0.6), inset 0 0 40px rgba(255,110,58,0.05)",
                        transition: { duration: 0.3 } 
                    }
                }}
            >
                {/* Spine representation (left-aligned stripe inside case) */}
                <div
                    className="absolute inset-y-0 left-0 z-20 overflow-hidden border-r border-white/5 bg-[#03060f]/80 backdrop-blur-md flex flex-col justify-between py-4"
                    style={{ width: SPINE_WIDTH }}
                >
                    {/* Glossy edge gradient */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 to-transparent" />

                    {/* Spine score indicator */}
                    {score ? (
                        <div className="flex flex-col items-center gap-1">
                            <FaStar className={cn("text-brand-orange drop-shadow-[0_0_5px_rgba(255,110,58,0.5)]", size === "hero" ? "text-[10px]" : "text-[7px]")} />
                            <span className={cn("font-black text-brand-orange tracking-tighter tabular-nums", size === "hero" ? "text-[12px]" : "text-[8px]")}>{score}</span>
                        </div>
                    ) : <div />}

                    {/* Spine vertically stacked labels */}
                    <div className="flex flex-col items-center gap-2">
                        {media.year && (
                            <span className={cn("font-mono font-black text-zinc-500 uppercase tracking-widest rotate-90 my-2 whitespace-nowrap", size === "hero" ? "text-[10px]" : "text-[7px]")}>
                                {media.year}
                            </span>
                        )}
                        <span className={cn("font-mono font-bold text-zinc-600 rotate-90 py-1 uppercase whitespace-nowrap", size === "hero" ? "text-[10px]" : "text-[7px]")}>
                            {media.format || "TV"}
                        </span>
                    </div>
                </div>

                {/* Cover Art Poster (inside case) */}
                <div 
                    className="absolute inset-y-0 right-0 overflow-hidden rounded-r-2xl bg-zinc-950"
                    style={{ left: SPINE_WIDTH }}
                >
                    <DeferredImage
                        src={media.posterImage || ""}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                        showSkeleton={false}
                    />

                    {/* Premium glass reflection gloss overlay */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06] pointer-events-none transition-all duration-300 group-hover:via-white/[0.05]" 
                    />
                    
                    {/* Shadow overlay at bottom for text visibility */}
                    <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </div>

                {/* ── Outer text information overlay (always readable) ── */}
                <div className="relative z-20 p-4 w-full" style={{ paddingLeft: SPINE_WIDTH + 16 }}>
                    {/* Badge */}
                    <div className="mb-2">
                        <span className={cn("font-black uppercase tracking-[0.2em] text-brand-orange bg-brand-orange/10 px-2.5 py-1 rounded-md border border-brand-orange/20 backdrop-blur-md", size === "hero" ? "text-[10px]" : "text-[8px]")}>
                            {media.genres?.[0] || "ANIME"}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className={cn("font-black text-white uppercase tracking-tight leading-[1.1] line-clamp-2 drop-shadow-xl group-hover:text-brand-orange transition-colors duration-300 font-display", size === "hero" ? "text-[24px] tracking-normal" : "text-[14px]")}>
                        {title}
                    </h3>
                </div>

                {/* Interactive Play icon hovering at the top of the case on hover */}
                <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <div className={cn("rounded-full bg-brand-orange text-white flex items-center justify-center shadow-xl shadow-brand-orange/20 hover:scale-110 active:scale-95 transition-all", size === "hero" ? "w-11 h-11" : "w-8 h-8")}>
                        <Play className={cn("fill-current text-white translate-x-0.5", size === "hero" ? "w-5 h-5" : "w-4 h-4")} />
                    </div>
                </div>
            </motion.div>

            {/* ── 3. Subtle Floating Shadow base underneath ── */}
            <div className="absolute -bottom-6 inset-x-4 h-6 opacity-20 blur-xl bg-black rounded-full scale-95 group-hover:scale-110 group-hover:opacity-40 transition-all duration-500 pointer-events-none" />
        </motion.div>
    )
})
