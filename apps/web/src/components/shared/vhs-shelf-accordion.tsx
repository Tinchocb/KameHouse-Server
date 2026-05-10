import { useState, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Star, Calendar, Tv, Layers, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

import { sanitizeHtml } from "@/lib/helpers/sanitizer"

// ─── Types & Schema ────────────────────────────────────────────────────────────

export interface VhsTapeItem {
    id: string | number
    title: string
    subtitle?: string
    description?: string
    posterUrl?: string
    bannerUrl?: string
    episodesCount?: number
    runtime?: string
    score?: string | number | null
    year?: string | number
    format?: string
    genres?: string[]
    tmdbId?: number | null
}

interface VhsShelfAccordionProps {
    items: VhsTapeItem[]
    onItemClick: (item: VhsTapeItem) => void
    type?: "series" | "sagas"
    className?: string
}

// ─── Dragon Ball Config Matching ──────────────────────────────────────────────

const DRAGON_BALL_SERIES = {
    ORIGINAL: 862,
    Z: 12971,
    GT: 888,
    KAI: 61709,
    SUPER: 62715,
    DAIMA: 240411,
}

// Retro themes inspired by real VHS spine releases
const VHS_THEMES: Record<number, {
    spineBg: string         // Tailwind classes for lomo background
    textColor: string       // Spine text color
    spineTitleColor: string // Spine title color
    accentBorder: string    // Accent color for outlines
    defaultSubtitle: string // Subtitle fallback
    toeiCatBg: string       // Toei cat circle bg
    blackBottomText: string // Embossed brand
}> = {
    [DRAGON_BALL_SERIES.ORIGINAL]: {
        spineBg: "bg-[#54c0d4] bg-gradient-to-b from-[#69d0e2] via-[#54c0d4] to-[#3ca0b3]",
        textColor: "text-zinc-900",
        spineTitleColor: "text-[#d11c1b]",
        accentBorder: "border-[#d11c1b]/30",
        defaultSubtitle: "Original Series",
        toeiCatBg: "bg-[#e22d28]",
        blackBottomText: "SHUEISHA"
    },
    [DRAGON_BALL_SERIES.Z]: {
        spineBg: "bg-[#f57e1a] bg-gradient-to-b from-[#f79339] via-[#f57e1a] to-[#d66504]",
        textColor: "text-zinc-950",
        spineTitleColor: "text-[#1d1d1b]",
        accentBorder: "border-amber-950/20",
        defaultSubtitle: "Saiyan Saga",
        toeiCatBg: "bg-[#1d1d1b]",
        blackBottomText: "TOEI ANIME"
    },
    [DRAGON_BALL_SERIES.GT]: {
        spineBg: "bg-[#1c3966] bg-gradient-to-b from-[#254b85] via-[#1c3966] to-[#122442]",
        textColor: "text-zinc-100",
        spineTitleColor: "text-[#fad41e]",
        accentBorder: "border-[#fad41e]/20",
        defaultSubtitle: "Dragon Ball GT",
        toeiCatBg: "bg-[#e22d28]",
        blackBottomText: "BIRD STUDIO"
    },
    [DRAGON_BALL_SERIES.SUPER]: {
        spineBg: "bg-[#b81d18] bg-gradient-to-b from-[#d12c26] via-[#b81d18] to-[#91130f]",
        textColor: "text-white",
        spineTitleColor: "text-[#fad41e]",
        accentBorder: "border-amber-400/20",
        defaultSubtitle: "Saga Súper",
        toeiCatBg: "bg-[#fad41e]",
        blackBottomText: "TOEI ANIME"
    },
    [DRAGON_BALL_SERIES.KAI]: {
        spineBg: "bg-[#b1b9de] bg-gradient-to-b from-[#c8cef0] via-[#b1b9de] to-[#8c94ba]",
        textColor: "text-zinc-900",
        spineTitleColor: "text-[#102d6b]",
        accentBorder: "border-[#102d6b]/20",
        defaultSubtitle: "Remasterizada",
        toeiCatBg: "bg-[#102d6b]",
        blackBottomText: "SHUEISHA"
    },
    [DRAGON_BALL_SERIES.DAIMA]: {
        spineBg: "bg-[#eed429] bg-gradient-to-b from-[#fae23f] via-[#eed429] to-[#cca716]",
        textColor: "text-zinc-950",
        spineTitleColor: "text-[#d11c1b]",
        accentBorder: "border-zinc-950/20",
        defaultSubtitle: "Nueva Aventura",
        toeiCatBg: "bg-[#d11c1b]",
        blackBottomText: "BIRD STUDIO"
    }
}

// Dynamic theme generator for generic/non-DB shows based on string hashes
function getGenericTheme(title: string, index: number) {
    const hash = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const options = [
        { // Neon Cyberpunk
            spineBg: "bg-[#11131c] bg-gradient-to-b from-[#1c1e2d] via-[#11131c] to-[#08090f] border-r border-[#ff3e8b]/20",
            textColor: "text-zinc-400",
            spineTitleColor: "text-[#ff3e8b]",
            accentBorder: "border-[#ff3e8b]/20",
            defaultSubtitle: "Cyberpunk Arch",
            toeiCatBg: "bg-[#ff3e8b]",
            blackBottomText: "KAME TAPE"
        },
        { // Classic Purple Shonen
            spineBg: "bg-[#4a154b] bg-gradient-to-b from-[#631e64] via-[#4a154b] to-[#310c32]",
            textColor: "text-purple-100",
            spineTitleColor: "text-[#00ffcc]",
            accentBorder: "border-[#00ffcc]/20",
            defaultSubtitle: "Fantasy Arc",
            toeiCatBg: "bg-[#00ffcc]",
            blackBottomText: "MANGA CO."
        },
        { // Dark Mecha Green
            spineBg: "bg-[#0f1f1a] bg-gradient-to-b from-[#18332b] via-[#0f1f1a] to-[#07100d]",
            textColor: "text-emerald-400",
            spineTitleColor: "text-[#10b981]",
            accentBorder: "border-emerald-500/20",
            defaultSubtitle: "Sci-Fi Saga",
            toeiCatBg: "bg-[#10b981]",
            blackBottomText: "KAME MEDIA"
        },
        { // Retro Slate Vintage
            spineBg: "bg-[#334155] bg-gradient-to-b from-[#475569] via-[#334155] to-[#1e293b]",
            textColor: "text-slate-200",
            spineTitleColor: "text-amber-500",
            accentBorder: "border-amber-500/20",
            defaultSubtitle: "Vintage Series",
            toeiCatBg: "bg-amber-500",
            blackBottomText: "KAMEHOUSE"
        }
    ]
    return options[hash % options.length]
}

// ─── Main Accordion Component ─────────────────────────────────────────────────

export const VhsShelfAccordion = memo(function VhsShelfAccordion({
    items,
    onItemClick,
    type = "series",
    className,
}: VhsShelfAccordionProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [activeIndex, setActiveIndex] = useState<number | null>(0) // Default first item active

    if (items.length === 0) return null

    return (
        <div className={cn("w-full flex flex-col gap-4", className)}>
            {/* VHS Tape Shelf Base Container */}
            <div 
                className="relative flex flex-row items-stretch overflow-x-auto no-scrollbar py-6 px-1 w-full h-[650px] rounded-2xl bg-zinc-950/70 border border-white/5 shadow-[inset_0_10px_30px_rgba(0,0,0,0.9),0_20px_40px_rgba(0,0,0,0.6)]"
                style={{ perspective: "1800px" }}
            >
                {/* Wood Shelf Bottom Indicator */}
                <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-zinc-900 via-zinc-800 to-zinc-950 border-t border-white/5 z-0 pointer-events-none" />

                <div className="flex flex-row items-stretch gap-1.5 md:gap-2.5 h-full z-10 px-4">
                    {items.map((item, index) => {
                        const isHovered = hoveredIndex === index
                        const isActive = activeIndex === index
                        const isExpanded = isHovered || (hoveredIndex === null && isActive)

                        // ── Theme Mapping ──
                        const tmdbId = item.tmdbId || 0
                        const theme = VHS_THEMES[tmdbId] || getGenericTheme(item.title, index)
                        
                        const titleText = item.title
                        const subtitleText = item.subtitle || theme.defaultSubtitle
                        const scoreStr = item.score 
                            ? (Number(item.score) > 10 ? Number(item.score) / 10 : Number(item.score)).toFixed(1)
                            : null

                        return (
                            <motion.div
                                key={item.id}
                                className={cn(
                                    "relative flex flex-row shrink-0 cursor-pointer overflow-hidden rounded-xl transition-shadow duration-300 select-none",
                                    isExpanded 
                                        ? "shadow-[15px_15px_30px_rgba(0,0,0,0.85)] border border-white/10" 
                                        : "shadow-[5px_5px_15px_rgba(0,0,0,0.6)] border border-black/30 hover:shadow-[10px_10px_20px_rgba(0,0,0,0.7)]"
                                )}
                                animate={{ 
                                    width: isExpanded ? 600 : 140,
                                    rotateY: isExpanded ? 0 : 4,
                                    scale: isExpanded ? 1.01 : 0.98,
                                }}
                                transition={{ 
                                    type: "spring", 
                                    stiffness: 160, 
                                    damping: 22 
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                onClick={() => {
                                    setActiveIndex(index)
                                    // On mobile/double click, navigate
                                    if (isExpanded) {
                                        onItemClick(item)
                                    }
                                }}
                                style={{
                                    transformStyle: "preserve-3d",
                                    transformOrigin: "left center"
                                }}
                            >
                                {/* ── VHS TAPE SPINE (LOMO) ── */}
                                <div 
                                    className="w-[140px] shrink-0 flex flex-col justify-between py-3 border-r border-black/50 relative overflow-hidden bg-zinc-900"
                                >
                                    {/* Spine Background Full Poster */}
                                    <div className="absolute inset-0 z-0">
                                        <DeferredImage
                                            src={item.posterUrl || ""}
                                            alt=""
                                            className="w-full h-full object-cover object-center filter brightness-[0.6] contrast-125 grayscale-[30%] group-hover:brightness-[0.9] transition-all duration-500"
                                            showSkeleton={false}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                                    </div>

                                    {/* Spine Shiny Gloss Reflection Overlay */}
                                    <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-white/30 via-white/10 to-transparent pointer-events-none z-10" />
                                    <div className="absolute inset-y-0 right-0 w-1 bg-black/10 pointer-events-none z-10" />

                                    {/* Spine Header: New Badge */}
                                    <div className="flex flex-col items-center gap-1.5 px-2 relative z-10 min-h-[46px]">
                                        {/* Golden/Yellow "NEW" Ribbon diagonal */}
                                        {item.year && Number(item.year) >= 2024 && (
                                            <div className="absolute top-1 right-1 bg-[#eed429] text-zinc-950 text-[6px] font-black uppercase py-0.5 px-1.5 rotate-12 shadow-md border border-zinc-950/10 scale-110">
                                                NEW
                                            </div>
                                        )}
                                    </div>

                                    {/* Spine Center: Vertical Title */}
                                    <div className="flex-1 flex items-center justify-center py-4 relative z-10">
                                        <h3 className="font-bebas text-[28px] tracking-[0.1em] text-center leading-none uppercase max-h-[300px] text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)] select-none pointer-events-none [writing-mode:vertical-rl] rotate-180">
                                            {titleText}
                                        </h3>
                                    </div>

                                    {/* Spine Footer: Saga Subtitle & Ratings & VHS Logo */}
                                    <div className="flex flex-col items-center gap-2 px-1 relative z-10 text-center">
                                        {/* Small vertical description text line */}
                                        <div className="max-h-[70px] flex items-center justify-center">
                                            <span 
                                                className={cn(
                                                    "text-[7px] font-black font-mono tracking-widest uppercase opacity-70 whitespace-nowrap [writing-mode:vertical-rl] rotate-180",
                                                    theme.textColor
                                                )}
                                            >
                                                {subtitleText}
                                            </span>
                                        </div>

                                        {/* Sello Toei Animation Cat Badge */}
                                        <div className={cn("w-5.5 h-5.5 rounded-full flex items-center justify-center p-0.5 shadow-sm border border-black/15", theme.toeiCatBg)}>
                                            {/* Stylized Toei cat whiskers */}
                                            <span className="text-[5px] text-white font-black leading-none tracking-tighter">TC</span>
                                        </div>

                                        {/* VHS Logo Bordered Box */}
                                        <div className="border border-current px-1 py-0.2 rounded-sm text-[7px] font-serif font-black tracking-widest text-center uppercase opacity-85 scale-90 select-none">
                                            VHS
                                        </div>
                                    </div>

                                    {/* Spine Base Plastic Cartridge Exposure (Embossed Retro Detail) */}
                                    <div className="h-11 bg-gradient-to-r from-[#0d0e12] via-[#1a1b24] to-[#07080b] border-t border-zinc-800/80 relative overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] mt-2">
                                        {/* Plastic grooves/stripes */}
                                        <div className="absolute inset-y-0 left-2 w-[1px] bg-black/60 shadow-r" />
                                        <div className="absolute inset-y-0 left-3 w-[1px] bg-black/60" />
                                        <div className="absolute inset-y-0 right-2 w-[1px] bg-black/60" />
                                        <div className="absolute inset-y-0 right-3 w-[1px] bg-black/60" />

                                        {/* Embossed text "VHS" */}
                                        <span className="font-serif text-[8px] font-black tracking-[0.2em] text-[#22232a] select-none uppercase drop-shadow-[0.5px_0.5px_0px_rgba(255,255,255,0.05)]">
                                            VHS
                                        </span>
                                        <span className="text-[5px] font-mono font-black text-[#1d1d22] tracking-tighter mt-0.5 scale-90">
                                            {theme.blackBottomText}
                                        </span>
                                    </div>
                                </div>

                                {/* ── VHS TAPE CASE COVER (REVEAL ON EXPAND) ── */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -40, width: 0 }}
                                            animate={{ opacity: 1, x: 0, width: 460 }}
                                            exit={{ opacity: 0, x: -20, width: 0 }}
                                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                            className="h-full w-[460px] shrink-0 bg-[#06080e] relative flex flex-col justify-end overflow-hidden border-l border-white/5 shadow-[20px_0_60px_rgba(0,0,0,0.8)]"
                                        >
                                            {/* Advanced Dynamic Background (Poster Blur) */}
                                            <div className="absolute inset-0 z-0">
                                                <DeferredImage
                                                    src={item.bannerUrl || item.posterUrl || ""}
                                                    alt=""
                                                    className="w-full h-full object-cover filter blur-[80px] opacity-40 scale-150 transition-all duration-1000"
                                                    showSkeleton={false}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-tr from-[#06080e] via-[#06080e]/95 to-transparent" />
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,110,58,0.08),transparent_70%)]" />
                                            </div>

                                            {/* Mechanical Detail: Magnetic Tape Reel Representation */}
                                            <div className="absolute top-12 -right-24 w-64 h-64 opacity-[0.03] pointer-events-none rotate-12">
                                                <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                                                    <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="1" fill="transparent" />
                                                    <circle cx="50" cy="50" r="15" fill="white" />
                                                    <path d="M 50 5 L 50 95 M 5 50 L 95 50" stroke="white" strokeWidth="0.5" />
                                                </svg>
                                            </div>

                                            {/* Content Area with Sophisticated Glassmorphism */}
                                            <div className="relative z-10 p-8 flex flex-col gap-6 justify-end h-full">
                                                
                                                {/* Mini Poster Preview (Mechanical Slide-in) */}
                                                <motion.div 
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="w-24 aspect-[2/3] rounded-lg border border-white/10 shadow-2xl overflow-hidden mb-2"
                                                >
                                                    <DeferredImage src={item.posterUrl || ""} alt="" className="w-full h-full object-cover" />
                                                </motion.div>

                                                {/* Header Badges with premium styling */}
                                                <div className="flex flex-wrap items-center gap-2.5">
                                                    {scoreStr && (
                                                        <div className="flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange font-black text-[10px] px-3 py-1 rounded-lg border border-brand-orange/20 backdrop-blur-3xl shadow-[0_0_20px_rgba(255,110,58,0.1)]">
                                                            <Star className="w-3 h-3 fill-current" />
                                                            <span className="tracking-widest">{scoreStr}</span>
                                                        </div>
                                                    )}
                                                    {item.year && (
                                                        <div className="flex items-center gap-1.5 bg-white/5 text-zinc-300 font-black text-[10px] px-3 py-1 rounded-lg border border-white/5 backdrop-blur-3xl">
                                                            <Calendar className="w-3 h-3" />
                                                            <span className="tracking-widest">{item.year}</span>
                                                        </div>
                                                    )}
                                                    {item.format && (
                                                        <div className="flex items-center gap-1.5 bg-white/5 text-zinc-300 font-black text-[10px] px-3 py-1 rounded-lg border border-white/5 backdrop-blur-3xl">
                                                            <Tv className="w-3 h-3" />
                                                            <span className="tracking-widest">{item.format}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Title & Metadata */}
                                                <div className="space-y-2">
                                                    <h2 className="font-bebas text-5xl leading-[0.85] text-white tracking-wide uppercase drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                                                        {item.title}
                                                    </h2>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-[1px] w-8 bg-brand-orange/40" />
                                                        <p className="text-[11px] font-black uppercase text-brand-orange/80 tracking-[0.3em] font-mono">
                                                            {subtitleText}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Description with high-end glass container */}
                                                {item.description && (
                                                    <p 
                                                        className="text-[12px] text-zinc-400 font-medium leading-relaxed uppercase tracking-wider line-clamp-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.05] backdrop-blur-2xl shadow-inner"
                                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                                                    />
                                                )}

                                                {/* Technical Specs Stripe */}
                                                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-mono border-t border-white/10 pt-4 mt-2">
                                                    <span className="flex items-center gap-2 text-zinc-300">
                                                        <Layers className="w-3.5 h-3.5 text-brand-orange/50" />
                                                        {item.episodesCount && item.episodesCount > 0 ? `${item.episodesCount} EPISODES` : "TV SERIES"}
                                                    </span>
                                                    {item.runtime && (
                                                        <span className="flex items-center gap-2">
                                                            RUN: <strong className="text-white">{item.runtime}</strong>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Premium Action Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onItemClick(item)
                                                    }}
                                                    className="group/btn w-full mt-4 h-14 bg-white text-black hover:bg-brand-orange hover:text-white font-black text-xs tracking-[0.25em] uppercase flex items-center justify-center gap-4 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <Play className="w-4 h-4 fill-current group-hover/btn:scale-110 transition-transform duration-500" />
                                                    <span>{type === "series" ? "INICIAR REPRODUCCIÓN" : "SINTONIZAR ARCO"}</span>
                                                    <ChevronRight className="w-5 h-5 ml-auto opacity-40 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                                                </button>
                                            </div>

                                            {/* Edge gloss/plastic texture */}
                                            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
})
