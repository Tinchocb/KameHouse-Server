import { useState, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Star, Calendar, Tv, Layers, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Dragon Ball Themes ────────────────────────────────────────────────────────

const DB = { ORIGINAL: 862, Z: 12971, GT: 888, KAI: 61709, SUPER: 62715, DAIMA: 240411 }

const VHS_THEMES: Record<number, {
    accent: string
    labelBg: string
    labelText: string
    brandLabel: string
    subtitle: string
}> = {
    [DB.ORIGINAL]: { accent: "#e22d28", labelBg: "#54c0d4", labelText: "#d11c1b", brandLabel: "SHUEISHA", subtitle: "Original Series" },
    [DB.Z]:        { accent: "#f57e1a", labelBg: "#f57e1a", labelText: "#1d1d1b", brandLabel: "TOEI ANIME", subtitle: "Saiyan Saga" },
    [DB.GT]:       { accent: "#fad41e", labelBg: "#1c3966", labelText: "#fad41e", brandLabel: "BIRD STUDIO", subtitle: "Dragon Ball GT" },
    [DB.SUPER]:    { accent: "#fad41e", labelBg: "#b81d18", labelText: "#fad41e", brandLabel: "TOEI ANIME", subtitle: "Saga Súper" },
    [DB.KAI]:      { accent: "#102d6b", labelBg: "#b1b9de", labelText: "#102d6b", brandLabel: "SHUEISHA", subtitle: "Remasterizada" },
    [DB.DAIMA]:    { accent: "#d11c1b", labelBg: "#eed429", labelText: "#d11c1b", brandLabel: "BIRD STUDIO", subtitle: "Nueva Aventura" },
}

const GENERIC_ACCENTS = ["#ff3e8b", "#00ffcc", "#10b981", "#f59e0b", "#818cf8", "#f43f5e"]

function getTheme(tmdbId: number, title: string) {
    if (VHS_THEMES[tmdbId]) return VHS_THEMES[tmdbId]
    const hash = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const accent = GENERIC_ACCENTS[hash % GENERIC_ACCENTS.length]
    return { accent, labelBg: "#1a1b24", labelText: accent, brandLabel: "KAMEHOUSE", subtitle: "Anime Series" }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VhsShelfAccordion = memo(function VhsShelfAccordion({
    items,
    onItemClick,
    type = "series",
    className,
}: VhsShelfAccordionProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
    const [activeIdx, setActiveIdx] = useState<number | null>(0)

    if (items.length === 0) return null

    return (
        <div className={cn("w-full flex flex-col flex-1 h-full", className)}>
            {/* ── SHELF CONTAINER ── */}
            <div
                className="relative flex flex-row items-stretch overflow-x-auto no-scrollbar w-full flex-1 min-h-[600px] bg-[#080a0f] border-y border-white/[0.04]"
                style={{ perspective: "2000px" }}
            >
                {/* Estante de madera inferior */}
                <div className="absolute bottom-0 inset-x-0 h-6 z-20 pointer-events-none"
                    style={{ background: "linear-gradient(to top, #1a1209 0%, #2d2010 60%, transparent 100%)" }} />
                <div className="absolute bottom-6 inset-x-0 h-1 bg-[#3d2e14] z-20 pointer-events-none" />
                {/* Sombra ambiental superior */}
                <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />

                <div className="flex flex-row items-stretch gap-[3px] h-full z-10 px-3 pb-7 pt-4">
                    {items.map((item, index) => {
                        const isHovered = hoveredIdx === index
                        const isActive = activeIdx === index
                        const isExpanded = isHovered || (hoveredIdx === null && isActive)
                        const theme = getTheme(item.tmdbId || 0, item.title)
                        const scoreStr = item.score
                            ? (Number(item.score) > 10 ? Number(item.score) / 10 : Number(item.score)).toFixed(1)
                            : null
                        const subtitle = item.subtitle || theme.subtitle

                        return (
                            <motion.div
                                key={item.id}
                                className={cn(
                                    "relative flex flex-row shrink-0 cursor-pointer overflow-hidden select-none h-full",
                                    "rounded-sm",
                                    isExpanded
                                        ? "shadow-[20px_0_60px_rgba(0,0,0,0.9),−20px_0_60px_rgba(0,0,0,0.9)] z-30"
                                        : "shadow-[8px_0_24px_rgba(0,0,0,0.7)] z-10 hover:z-20"
                                )}
                                animate={{
                                    width: isExpanded ? 820 : 90,
                                    rotateY: isExpanded ? 0 : 2,
                                    scale: isExpanded ? 1 : 0.985,
                                    filter: isExpanded ? "brightness(1)" : (hoveredIdx !== null && !isHovered ? "brightness(0.7)" : "brightness(1)"),
                                }}
                                transition={{ type: "spring", stiffness: 200, damping: 26 }}
                                style={{ transformStyle: "preserve-3d", transformOrigin: "left center" }}
                                onMouseEnter={() => setHoveredIdx(index)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                onClick={() => {
                                    setActiveIdx(index)
                                    if (isExpanded) onItemClick(item)
                                }}
                            >
                                {/* ════════════════════════════════════════
                                    LOMO (SPINE) — poster a pantalla completa
                                ════════════════════════════════════════ */}
                                <div className="w-[90px] shrink-0 h-full relative overflow-hidden flex flex-col">

                                    {/* Poster como fondo — alta visibilidad */}
                                    <div className="absolute inset-0 z-0">
                                        <DeferredImage
                                            src={item.posterUrl || ""}
                                            alt=""
                                            className="w-full h-full object-cover object-top"
                                            style={{ filter: "brightness(0.92) saturate(1.1) contrast(1.05)" }}
                                            showSkeleton={false}
                                        />
                                        {/* Vignette sutil en los bordes — NO aplana el poster */}
                                        <div className="absolute inset-0"
                                            style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
                                        {/* Gradiente inferior para el chassis */}
                                        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-black/70 to-transparent" />
                                        {/* Gradiente superior para el año */}
                                        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />
                                    </div>

                                    {/* Barra de acento temático — borde izquierdo */}
                                    <div className="absolute inset-y-0 left-0 w-[4px] z-20 pointer-events-none"
                                        style={{ background: `linear-gradient(to bottom, ${theme.accent}, ${theme.accent}88, ${theme.accent})` }} />

                                    {/* Reflejo plástico derecho */}
                                    <div className="absolute inset-y-0 right-0 w-[2px] z-20 pointer-events-none"
                                        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 50%, transparent)" }} />

                                    {/* ── CABECERA: año y badge NEW ── */}
                                    <div className="relative z-10 flex flex-col items-center pt-2 gap-1 px-1.5">
                                        <span
                                            className="text-[7px] font-black font-mono tracking-[0.12em] uppercase px-1.5 py-[2px] rounded-[2px]"
                                            style={{
                                                background: "rgba(0,0,0,0.55)",
                                                color: "rgba(255,255,255,0.75)",
                                                backdropFilter: "blur(4px)",
                                                border: `1px solid ${theme.accent}55`
                                            }}
                                        >
                                            {item.year || "VHS"}
                                        </span>
                                        {item.year && Number(item.year) >= 2024 && (
                                            <span
                                                className="text-[6px] font-black uppercase px-1.5 py-[2px] rotate-[-4deg] shadow-md"
                                                style={{ background: theme.accent, color: theme.labelText }}
                                            >
                                                NEW
                                            </span>
                                        )}
                                    </div>

                                    {/* ── TÍTULO VERTICAL ── */}
                                    <div className="flex-1 flex items-center justify-center relative z-10 overflow-hidden py-3">
                                        <h3
                                            className="font-bebas leading-none uppercase tracking-[0.06em] text-white text-center"
                                            style={{
                                                writingMode: "vertical-rl",
                                                transform: "rotate(180deg)",
                                                fontSize: "clamp(16px, 1.5vw, 22px)",
                                                textShadow: "0 2px 12px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.8)",
                                                overflow: "hidden",
                                                display: "-webkit-box",
                                                WebkitLineClamp: 1,
                                                WebkitBoxOrient: "horizontal",
                                                maxHeight: "100%",
                                            } as React.CSSProperties}
                                        >
                                            {item.title}
                                        </h3>
                                    </div>

                                    {/* ── CHASSIS VHS (base mecánica) ── */}
                                    <div
                                        className="relative z-10 flex flex-col items-center justify-center shrink-0 overflow-hidden"
                                        style={{
                                            height: "52px",
                                            background: "linear-gradient(135deg, #0d0e14 0%, #15161f 40%, #0a0b10 100%)",
                                            borderTop: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        {/* Ranuras de cartucho */}
                                        <div className="absolute inset-x-2 top-1.5 bottom-1.5 flex gap-[3px] opacity-20 pointer-events-none">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div key={i} className="flex-1 rounded-[1px]" style={{ background: "rgba(255,255,255,0.4)" }} />
                                            ))}
                                        </div>
                                        {/* Ventana de cinta magnética */}
                                        <div
                                            className="w-10 h-5 rounded-sm relative overflow-hidden"
                                            style={{
                                                background: "rgba(0,0,0,0.8)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.9)"
                                            }}
                                        >
                                            {/* Bobinas */}
                                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-zinc-600/60" style={{ background: "rgba(30,30,40,0.9)" }}>
                                                <div className="w-1 h-1 rounded-full bg-zinc-500/40 absolute inset-1/2 -translate-x-1/2 -translate-y-1/2" />
                                            </div>
                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-zinc-600/60" style={{ background: "rgba(30,30,40,0.9)" }}>
                                                <div className="w-1 h-1 rounded-full bg-zinc-500/40 absolute inset-1/2 -translate-x-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        {/* Marca */}
                                        <span className="text-[5.5px] font-mono font-black tracking-[0.2em] uppercase mt-1"
                                            style={{ color: `${theme.accent}80` }}>
                                            {theme.brandLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* ════════════════════════════════════════
                                    PANEL EXPANDIDO
                                ════════════════════════════════════════ */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -24 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }}
                                            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                                            className="flex-1 h-full relative overflow-hidden flex flex-row"
                                        >
                                            {/* ── BANNER como fondo (sin blur en la zona derecha) ── */}
                                            <div className="absolute inset-0 z-0">
                                                <DeferredImage
                                                    src={item.bannerUrl || item.posterUrl || ""}
                                                    alt=""
                                                    className="w-full h-full object-cover object-center"
                                                    style={{ filter: "brightness(0.35) saturate(1.2)" }}
                                                    showSkeleton={false}
                                                />
                                                {/* Gradiente izquierda → opaco para el contenido */}
                                                <div className="absolute inset-0"
                                                    style={{ background: "linear-gradient(to right, rgba(6,8,14,0.98) 0%, rgba(6,8,14,0.88) 45%, rgba(6,8,14,0.2) 100%)" }} />
                                                {/* Gradiente inferior */}
                                                <div className="absolute inset-0"
                                                    style={{ background: "linear-gradient(to top, rgba(6,8,14,0.9) 0%, transparent 50%)" }} />
                                                {/* Glow temático */}
                                                <div className="absolute inset-0 pointer-events-none"
                                                    style={{ background: `radial-gradient(ellipse at 20% 80%, ${theme.accent}18 0%, transparent 60%)` }} />
                                            </div>

                                            {/* Decoración: carrete SVG */}
                                            <div className="absolute top-6 right-10 opacity-[0.06] pointer-events-none w-52 h-52">
                                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                                    <circle cx="50" cy="50" r="46" stroke="white" strokeWidth="1.5" fill="none" />
                                                    <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="0.8" fill="none" />
                                                    <circle cx="50" cy="50" r="10" fill="white" />
                                                    <path d="M50 4 L50 20 M50 80 L50 96 M4 50 L20 50 M80 50 L96 50" stroke="white" strokeWidth="1.2" />
                                                    <path d="M17 17 L28 28 M72 72 L83 83 M83 17 L72 28 M28 72 L17 83" stroke="white" strokeWidth="0.8" />
                                                </svg>
                                            </div>

                                            {/* ── LAYOUT: poster | info ── */}
                                            <div className="relative z-10 flex flex-row w-full h-full">

                                                {/* POSTER GRANDE */}
                                                <motion.div
                                                    initial={{ y: 24, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                                    className="w-[170px] md:w-[200px] shrink-0 h-full flex items-end pl-6 pb-8"
                                                >
                                                    <div
                                                        className="w-full aspect-[2/3] rounded-lg overflow-hidden relative"
                                                        style={{
                                                            boxShadow: `0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px ${theme.accent}22`
                                                        }}
                                                    >
                                                        <DeferredImage
                                                            src={item.posterUrl || ""}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {/* Brillo sutil sobre el poster */}
                                                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/30 pointer-events-none" />
                                                        {/* Borde acento en el poster */}
                                                        <div
                                                            className="absolute bottom-0 inset-x-0 h-[3px]"
                                                            style={{ background: theme.accent }}
                                                        />
                                                    </div>
                                                </motion.div>

                                                {/* INFO */}
                                                <motion.div
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.13, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                                                    className="flex-1 flex flex-col justify-end gap-3 px-7 pb-8 pt-8 min-w-0"
                                                >
                                                    {/* Badges superiores */}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {scoreStr && (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black"
                                                                style={{
                                                                    background: `${theme.accent}18`,
                                                                    color: theme.accent,
                                                                    border: `1px solid ${theme.accent}35`,
                                                                }}>
                                                                <Star className="w-3 h-3 fill-current" />
                                                                <span className="tracking-widest">{scoreStr}</span>
                                                            </div>
                                                        )}
                                                        {item.year && (
                                                            <div className="flex items-center gap-1.5 bg-white/[0.06] text-zinc-300 px-3 py-1 rounded-md text-[11px] font-black border border-white/[0.08]">
                                                                <Calendar className="w-3 h-3" />
                                                                <span className="tracking-widest">{item.year}</span>
                                                            </div>
                                                        )}
                                                        {item.format && (
                                                            <div className="flex items-center gap-1.5 bg-white/[0.06] text-zinc-300 px-3 py-1 rounded-md text-[11px] font-black border border-white/[0.08]">
                                                                <Tv className="w-3 h-3" />
                                                                <span className="tracking-widest">{item.format}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Título y saga */}
                                                    <div>
                                                        <h2
                                                            className="font-bebas uppercase leading-[0.88] text-white line-clamp-2"
                                                            style={{
                                                                fontSize: "clamp(36px, 4vw, 56px)",
                                                                textShadow: "0 8px 30px rgba(0,0,0,0.6)",
                                                            }}
                                                        >
                                                            {item.title}
                                                        </h2>
                                                        <div className="flex items-center gap-2.5 mt-2">
                                                            <div className="h-[2px] w-10 rounded-full flex-shrink-0"
                                                                style={{ background: theme.accent }} />
                                                            <span
                                                                className="text-[10px] font-black uppercase tracking-[0.35em] font-mono"
                                                                style={{ color: theme.accent }}
                                                            >
                                                                {subtitle}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Descripción — legible, normal case */}
                                                    {item.description && (
                                                        <p
                                                            className="text-[13px] leading-[1.65] text-zinc-300/90 line-clamp-3 font-normal"
                                                            style={{ maxWidth: "480px" }}
                                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                                                        />
                                                    )}

                                                    {/* Géneros */}
                                                    {item.genres && item.genres.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {item.genres.slice(0, 5).map(g => (
                                                                <span
                                                                    key={g}
                                                                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-[4px] rounded-full"
                                                                    style={{
                                                                        background: "rgba(255,255,255,0.05)",
                                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                                        color: "rgba(200,200,210,0.8)"
                                                                    }}
                                                                >
                                                                    {g}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Stats + botón */}
                                                    <div
                                                        className="pt-3 flex items-center justify-between gap-4"
                                                        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                                                    >
                                                        <div className="flex items-center gap-5 text-[11px] font-mono font-black uppercase tracking-[0.15em]">
                                                            {item.episodesCount != null && item.episodesCount > 0 && (
                                                                <span className="flex items-center gap-2 text-zinc-400">
                                                                    <Layers className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                                                                    <span className="text-white text-base font-black mr-0.5">{item.episodesCount}</span>
                                                                    EPISODIOS
                                                                </span>
                                                            )}
                                                            {item.runtime && (
                                                                <span className="text-zinc-500">
                                                                    RUN: <strong className="text-zinc-300">{item.runtime}</strong>
                                                                </span>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={e => { e.stopPropagation(); onItemClick(item) }}
                                                            className="flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[11px] tracking-[0.2em] uppercase transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shrink-0"
                                                            style={{
                                                                background: "white",
                                                                color: "black",
                                                                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 0 ${theme.accent}`,
                                                                transition: "background 0.25s, color 0.25s, box-shadow 0.25s, transform 0.1s",
                                                            }}
                                                            onMouseEnter={e => {
                                                                const btn = e.currentTarget as HTMLButtonElement
                                                                btn.style.background = theme.accent
                                                                btn.style.color = theme.labelText
                                                                btn.style.boxShadow = `0 8px 32px ${theme.accent}55`
                                                            }}
                                                            onMouseLeave={e => {
                                                                const btn = e.currentTarget as HTMLButtonElement
                                                                btn.style.background = "white"
                                                                btn.style.color = "black"
                                                                btn.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4)`
                                                            }}
                                                        >
                                                            <Play className="w-4 h-4 fill-current flex-shrink-0" />
                                                            <span>{type === "series" ? "INICIAR REPRODUCCIÓN" : "SINTONIZAR ARCO"}</span>
                                                            <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            </div>

                                            {/* Borde izquierdo del panel — continuación del lomo */}
                                            <div className="absolute inset-y-0 left-0 w-[4px] pointer-events-none z-20"
                                                style={{ background: theme.accent }} />
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
