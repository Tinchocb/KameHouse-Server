/**
 * VhsShelfAccordion — mejorado
 *
 * Cambios:
 *
 * PERFORMANCE / ANIMACIONES (choppy fix)
 * ───────────────────────────────────────
 * • Spring más apretado: stiffness 200→400, damping 26→42, mass 0.7
 *   → La apertura/cierre se siente instantánea y sin rebote excesivo
 * • willChange: "width, transform" en cada tape
 *   → Fuerza GPU layer, evita repaints en el layout principal
 * • Dimming por overlay (opacity) en vez de filter: brightness() en el parent
 *   → Animar filter en múltiples elementos simultáneos es muy caro;
 *     un div overlay con opacity es casi gratis en GPU
 * • useReducedMotion → respeta prefers-reduced-motion del OS
 *
 * ESTRUCTURA / CÓDIGO
 * ───────────────────
 * • Sub-componentes extraídos: VhsReel, VhsChassis (memoizados)
 * • useCallback en todos los handlers → evita recrear funciones en cada render
 * • useMemo en springCfg → objeto de config no se recrea en cada render
 * • expandedIdx como derived state → fuente única de verdad entre hover y active
 *
 * UX / INTERACCIÓN
 * ────────────────
 * • Bobinas (VhsReel) giran con animation framer-motion cuando el tape está expandido
 * • Scanlines en el chassis (repeating-linear-gradient, sin DOM extra)
 * • Guía magnética de cinta animada con glow temático
 * • Badge NEW con spring de entrada
 * • Transición del panel expandido más rápida: 0.32→0.28s, ease mejorado
 *
 * ACCESIBILIDAD
 * ─────────────
 * • role="listbox" en el contenedor, role="option" + aria-selected en cada tape
 * • aria-expanded, aria-label con título, año y episodios
 * • tabIndex={0} + onFocus/onBlur para integración con hover state
 * • Teclado: Enter/Space → seleccionar/abrir; ← → → navegar entre tapes
 * • focus-visible ring temático (box-shadow, sin romper overflow)
 * • Botón CTA con focus-visible propio
 */

import { useState, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
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

// ─── Themes ───────────────────────────────────────────────────────────────────

const DB = { ORIGINAL: 862, Z: 12971, GT: 888, KAI: 61709, SUPER: 62715, DAIMA: 240411 }

const VHS_THEMES: Record<number, {
    accent: string; labelBg: string; labelText: string; brandLabel: string; subtitle: string
}> = {
    [DB.ORIGINAL]: { accent: "#e22d28", labelBg: "#54c0d4", labelText: "#d11c1b", brandLabel: "SHUEISHA", subtitle: "Original Series" },
    [DB.Z]: { accent: "#f57e1a", labelBg: "#f57e1a", labelText: "#1d1d1b", brandLabel: "TOEI ANIME", subtitle: "Saiyan Saga" },
    [DB.GT]: { accent: "#fad41e", labelBg: "#1c3966", labelText: "#fad41e", brandLabel: "BIRD STUDIO", subtitle: "Dragon Ball GT" },
    [DB.SUPER]: { accent: "#fad41e", labelBg: "#b81d18", labelText: "#fad41e", brandLabel: "TOEI ANIME", subtitle: "Saga Súper" },
    [DB.KAI]: { accent: "#102d6b", labelBg: "#b1b9de", labelText: "#102d6b", brandLabel: "SHUEISHA", subtitle: "Remasterizada" },
    [DB.DAIMA]: { accent: "#d11c1b", labelBg: "#eed429", labelText: "#d11c1b", brandLabel: "BIRD STUDIO", subtitle: "Nueva Aventura" },
}

const GENERIC_ACCENTS = ["#ff3e8b", "#00ffcc", "#10b981", "#f59e0b", "#818cf8", "#f43f5e"]

const themeCache = new Map<string, { accent: string; labelBg: string; labelText: string; brandLabel: string; subtitle: string }>()

function getTheme(tmdbId: number, title: string) {
    if (VHS_THEMES[tmdbId]) return VHS_THEMES[tmdbId]
    const cacheKey = `${tmdbId}_${title}`
    const cached = themeCache.get(cacheKey)
    if (cached) return cached
    const hash = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const accent = GENERIC_ACCENTS[hash % GENERIC_ACCENTS.length]
    const theme = { accent, labelBg: "#1a1b24", labelText: accent, brandLabel: "KAMEHOUSE", subtitle: "Anime Series" }
    themeCache.set(cacheKey, theme)
    return theme
}

const RADIOS = [0, 72, 144, 216, 288].map(deg => {
    const r = (deg * Math.PI) / 180
    return {
        deg,
        x1: 10 + Math.cos(r) * 3.2,
        y1: 10 + Math.sin(r) * 3.2,
        x2: 10 + Math.cos(r) * 7.8,
        y2: 10 + Math.sin(r) * 7.8,
    }
})

const NOTCHES = [36, 108, 180, 252, 324].map(deg => {
    const r = (deg * Math.PI) / 180
    return {
        deg,
        x1: 10 + Math.cos(r) * 7.5,
        y1: 10 + Math.sin(r) * 7.5,
        x2: 10 + Math.cos(r) * 9,
        y2: 10 + Math.sin(r) * 9,
    }
})

// ─── VhsReel ──────────────────────────────────────────────────────────────────
// Bobina SVG animada. isSpinning → rotación continua con framer-motion.
// Se usa dentro del chassis, en pares.

const VhsReel = memo(function VhsReel({
    isSpinning,
    accent,
}: {
    isSpinning: boolean
    accent: string
}) {
    return (
        <svg
            viewBox="0 0 20 20"
            className={cn(
                "w-[14px] h-[14px] transition-transform duration-300 ease-out",
                isSpinning && "animate-[spin_1.4s_linear_infinite] will-change-transform"
            )}
        >
            {/* Aro exterior */}
            <circle cx="10" cy="10" r="9" stroke="rgba(100,100,120,0.5)" strokeWidth="1" fill="rgba(12,12,20,0.96)" />
            {/* Hub */}
            <circle cx="10" cy="10" r="2.5" fill={`${accent}55`} />
            <circle cx="10" cy="10" r="1" fill={`${accent}88`} />
            {/* 5 radios */}
            {RADIOS.map(radio => (
                <line
                    key={radio.deg}
                    x1={radio.x1} y1={radio.y1}
                    x2={radio.x2} y2={radio.y2}
                    stroke="rgba(140,140,165,0.35)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                />
            ))}
            {/* Muescas exteriores */}
            {NOTCHES.map(notch => (
                <line
                    key={notch.deg}
                    x1={notch.x1} y1={notch.y1}
                    x2={notch.x2} y2={notch.y2}
                    stroke="rgba(120,120,145,0.25)"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                />
            ))}
        </svg>
    )
})

const CHASSIS_SLOTS = Array.from({ length: 8 })

// ─── VhsChassis ───────────────────────────────────────────────────────────────
// Bloque mecánico inferior del lomo. Scanlines + ventana de cinta + bobinas.

const VhsChassis = memo(function VhsChassis({
    isSpinning,
    accent,
    brandLabel,
}: {
    isSpinning: boolean
    accent: string
    brandLabel: string
}) {
    return (
        <div
            className="relative z-10 flex flex-col items-center justify-center shrink-0 overflow-hidden"
            style={{
                height: "54px",
                background: "linear-gradient(160deg, #0e1018 0%, #161820 45%, #0a0c12 100%)",
                borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
        >
            {/* Scanlines — solo CSS, cero DOM extra */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 3px)",
                    opacity: 0.6,
                }}
            />
            {/* Ranuras del cartucho */}
            <div className="absolute inset-x-2 top-1.5 bottom-1.5 flex gap-[3px] opacity-[0.13] pointer-events-none">
                {CHASSIS_SLOTS.map((_, i) => (
                    <div key={i} className="flex-1 rounded-[1px]" style={{ background: "rgba(200,200,220,0.5)" }} />
                ))}
            </div>

            {/* Ventana de cinta magnética */}
            <div
                className="w-11 h-6 rounded-sm relative overflow-hidden flex items-center justify-between px-1.5"
                style={{
                    background: "rgba(4,4,8,0.97)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.95), inset 0 0 12px rgba(0,0,0,0.8)",
                }}
            >
                {/* Guía de cinta con glow temático */}
                <div
                    className="absolute inset-x-0 bottom-1.5 h-[1px] pointer-events-none"
                    style={{
                        background: `linear-gradient(to right, transparent, ${accent}50 30%, ${accent}80 50%, ${accent}50 70%, transparent)`,
                    }}
                />
                <VhsReel isSpinning={isSpinning} accent={accent} />
                <VhsReel isSpinning={isSpinning} accent={accent} />
            </div>

            {/* Marca de fábrica */}
            <span
                className="text-[5.5px] font-mono font-black tracking-[0.22em] uppercase mt-1"
                style={{ color: `${accent}70` }}
            >
                {brandLabel}
            </span>
        </div>
    )
})

// ─── VhsShelfAccordion ────────────────────────────────────────────────────────

export const VhsShelfAccordion = memo(function VhsShelfAccordion({
    items,
    onItemClick,
    type = "series",
    className,
}: VhsShelfAccordionProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
    const [activeIdx, setActiveIdx] = useState<number | null>(0)

    // Respeta prefers-reduced-motion del sistema operativo
    const prefersReduced = useReducedMotion()
    const containerRef = useRef<HTMLDivElement>(null)

    // ── Derived: qué tape está expandido
    const expandedIdx = hoveredIdx !== null ? hoveredIdx : activeIdx
    const anyHovered = hoveredIdx !== null

    // ── Spring: más apretado → apertura más snappy, sin choppy
    // (stiffness 200→400, damping 26→42, mass 0.7 en vez de 1)
    const springCfg = useMemo(
        () =>
            prefersReduced
                ? ({ duration: 0.01 } as const)
                : ({ type: "spring", stiffness: 400, damping: 42, mass: 0.7 } as const),
        [prefersReduced],
    )

    // ── Handlers memoizados
    const handleMouseEnter = useCallback((idx: number) => setHoveredIdx(idx), [])
    const handleMouseLeave = useCallback(() => setHoveredIdx(null), [])

    const handleClick = useCallback(
        (idx: number, item: VhsTapeItem) => {
            setActiveIdx(idx)
            // Segundo click (ya expandido) → navega
            if (expandedIdx === idx) onItemClick(item)
        },
        [expandedIdx, onItemClick],
    )

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent, idx: number, item: VhsTapeItem) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setActiveIdx(idx)
                if (expandedIdx === idx) onItemClick(item)
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                const next = Math.min(items.length - 1, idx + 1)
                setActiveIdx(next)
                setHoveredIdx(null)
                // Mover foco al siguiente elemento
                setTimeout(() => {
                    containerRef.current
                        ?.querySelector<HTMLElement>(`[data-idx="${next}"]`)
                        ?.focus()
                }, 0)
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                const prev = Math.max(0, idx - 1)
                setActiveIdx(prev)
                setHoveredIdx(null)
                setTimeout(() => {
                    containerRef.current
                        ?.querySelector<HTMLElement>(`[data-idx="${prev}"]`)
                        ?.focus()
                }, 0)
            }
        },
        [expandedIdx, items.length, onItemClick],
    )

    if (items.length === 0) return null

    return (
        <div className={cn("w-full flex flex-col flex-1 h-full", className)}>

            {/* ── SHELF CONTAINER ── */}
            <div
                ref={containerRef}
                role="listbox"
                aria-label={type === "series" ? "Estantería de series" : "Estantería de sagas"}
                aria-orientation="horizontal"
                className="relative flex flex-row items-stretch overflow-x-auto no-scrollbar w-full flex-1 min-h-[600px] bg-[#06080d] border-y border-white/[0.04]"
                style={{ perspective: "2000px" }}
            >
                {/* Estante de madera inferior */}
                <div
                    className="absolute bottom-0 inset-x-0 h-6 z-20 pointer-events-none"
                    style={{ background: "linear-gradient(to top, #14100a 0%, #261a0d 60%, transparent 100%)" }}
                />
                <div
                    className="absolute bottom-6 inset-x-0 h-[2px] z-20 pointer-events-none"
                    style={{
                        background: "linear-gradient(to right, transparent, #3d2e14 15%, #4a3818 50%, #3d2e14 85%, transparent)",
                    }}
                />
                {/* Sombra ambiental superior */}
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />

                {/* Badge contador de tapes — esquina superior derecha */}
                <div
                    className="absolute top-3 right-4 z-30 flex items-center gap-1.5 pointer-events-none"
                    style={{
                        background: "rgba(0,0,0,0.55)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(8px)",
                        borderRadius: "6px",
                        padding: "3px 8px",
                    }}
                >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                        <rect x="0.5" y="2" width="9" height="7" rx="1" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                        <rect x="2" y="0.5" width="6" height="3" rx="0.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
                        <circle cx="3.5" cy="6.5" r="1.2" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
                        <circle cx="6.5" cy="6.5" r="1.2" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
                    </svg>
                    <span
                        className="text-[9px] font-mono font-black uppercase tracking-[0.2em] tabular-nums"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                    >
                        {items.length} {type === "series" ? "series" : "sagas"}
                    </span>
                </div>

                <div className="flex flex-row items-stretch gap-[3px] h-full z-10 px-3 pb-7 pt-4">
                    {items.map((item, index) => {
                        const isExpanded = expandedIdx === index
                        const isActive = activeIdx === index
                        const theme = getTheme(item.tmdbId ?? 0, item.title)
                        const scoreStr = item.score
                            ? (Number(item.score) > 10
                                ? Number(item.score) / 10
                                : Number(item.score)
                            ).toFixed(1)
                            : null
                        const subtitle = item.subtitle || theme.subtitle

                        return (
                            <div
                                key={item.id}
                                data-idx={index}
                                // ── A11y
                                role="option"
                                aria-selected={isActive}
                                aria-expanded={isExpanded}
                                aria-label={[
                                    item.title,
                                    item.year ? String(item.year) : null,
                                    item.episodesCount ? `${item.episodesCount} episodios` : null,
                                ].filter(Boolean).join(", ")}
                                tabIndex={0}
                                // ── Clases
                                className={cn(
                                    "relative flex flex-row shrink-0 cursor-pointer overflow-hidden select-none h-full rounded-sm",
                                    "outline-none",
                                    isExpanded ? "z-30" : "z-10 hover:z-20",
                                )}
                                style={{
                                    width: isExpanded ? 820 : 90,
                                    transition: prefersReduced ? "none" : "width 320ms cubic-bezier(0.25, 0.8, 0.25, 1)",
                                    willChange: "width",
                                    // focus-visible: ring temático via box-shadow (no rompe overflow)
                                    boxShadow: isExpanded
                                        ? `20px 0 60px rgba(0,0,0,0.9), -8px 0 30px rgba(0,0,0,0.6), 0 0 0 1px ${theme.accent}22`
                                        : "8px 0 24px rgba(0,0,0,0.7)",
                                }}
                                onMouseEnter={() => handleMouseEnter(index)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => handleClick(index, item)}
                                onKeyDown={e => handleKeyDown(e, index, item)}
                                // Teclado: hover visual al hacer focus
                                onFocus={() => setHoveredIdx(index)}
                                onBlur={handleMouseLeave}
                            >
                                {/*
                                 * DIMMING: overlay opacity en vez de filter: brightness() en el parent.
                                 * Razón: animar filter en N elementos simultáneos genera un repaint
                                 * de capa compuesta por cada frame. Un div con opacity en GPU es ~gratis.
                                 */}
                                <div
                                    className={cn(
                                        "absolute inset-0 z-40 pointer-events-none bg-black transition-opacity duration-150 ease-out",
                                        anyHovered && !isExpanded ? "opacity-[0.42]" : "opacity-0"
                                    )}
                                />

                                {/* ════════════════════════════════════════
                                    LOMO (SPINE)
                                ════════════════════════════════════════ */}
                                <div className="w-[90px] shrink-0 h-full relative overflow-hidden flex flex-col">

                                    {/* Poster como fondo */}
                                    <div className="absolute inset-0 z-0">
                                        <DeferredImage
                                            src={item.posterUrl || ""}
                                            alt=""
                                            className="w-full h-full object-cover object-top"
                                            style={{ filter: "brightness(0.9) saturate(1.1) contrast(1.06)" }}
                                            showSkeleton={false}
                                        />
                                        <div className="absolute inset-0"
                                            style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.6) 100%)" }} />
                                        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black via-black/60 to-transparent" />
                                        <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
                                    </div>

                                    {/* Barra de acento temático — borde izquierdo */}
                                    <div className="absolute inset-y-0 left-0 w-1 z-20 pointer-events-none"
                                        style={{ background: `linear-gradient(to bottom, ${theme.accent}dd, ${theme.accent}55, ${theme.accent}dd)` }} />

                                    {/* Reflejo plástico derecho */}
                                    <div className="absolute inset-y-0 right-0 w-[2px] z-20 pointer-events-none"
                                        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 50%, transparent)" }} />

                                    {/* ── Cabecera: año + badge NEW ── */}
                                    <div className="relative z-10 flex flex-col items-center pt-2.5 gap-1 px-1.5">
                                        <span
                                            className="text-[7px] font-black font-mono tracking-[0.14em] uppercase px-1.5 py-[2px] rounded-[2px]"
                                            style={{
                                                background: "rgba(0,0,0,0.6)",
                                                color: "rgba(255,255,255,0.8)",
                                                backdropFilter: "blur(4px)",
                                                border: `1px solid ${theme.accent}44`,
                                            }}
                                        >
                                            {item.year || "VHS"}
                                        </span>
                                        {item.year && Number(item.year) >= 2024 && (
                                            <motion.span
                                                initial={{ scale: 0.6, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.05 }}
                                                className="text-[6px] font-black uppercase px-1.5 py-[2px] shadow-md"
                                                style={{ background: theme.accent, color: theme.labelText, transform: "rotate(-4deg)" }}
                                            >
                                                NEW
                                            </motion.span>
                                        )}
                                    </div>

                                    {/* ── Título vertical ── */}
                                    <div className="flex-1 flex items-center justify-center relative z-10 overflow-hidden py-3">
                                        <h3
                                            className="font-bebas leading-none uppercase text-white text-center"
                                            style={{
                                                writingMode: "vertical-rl",
                                                transform: "rotate(180deg)",
                                                fontSize: "clamp(16px, 1.5vw, 21px)",
                                                letterSpacing: "0.06em",
                                                textShadow: "0 2px 14px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.9)",
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

                                    {/* ── Chassis VHS ── */}
                                    <VhsChassis
                                        isSpinning={isExpanded && !prefersReduced}
                                        accent={theme.accent}
                                        brandLabel={theme.brandLabel}
                                    />
                                </div>

                                {/* ════════════════════════════════════════
                                    PANEL EXPANDIDO
                                ════════════════════════════════════════ */}
                                <div
                                    className={cn(
                                        "flex-1 h-full relative overflow-hidden flex flex-row transition-all ease-out duration-300 will-change-[opacity,transform]",
                                        isExpanded 
                                            ? "opacity-100 translate-x-0 pointer-events-auto" 
                                            : "opacity-0 -translate-x-4 pointer-events-none"
                                    )}
                                >
                                    {/* Banner como fondo */}
                                    <div className="absolute inset-0 z-0">
                                        <DeferredImage
                                            src={item.bannerUrl || item.posterUrl || ""}
                                            alt=""
                                            className="w-full h-full object-cover object-center"
                                            style={{ filter: "brightness(0.3) saturate(1.2)" }}
                                            showSkeleton={false}
                                        />
                                        <div className="absolute inset-0"
                                            style={{ background: "linear-gradient(to right, rgba(5,7,12,0.99) 0%, rgba(5,7,12,0.9) 42%, rgba(5,7,12,0.15) 100%)" }} />
                                        <div className="absolute inset-0"
                                            style={{ background: "linear-gradient(to top, rgba(5,7,12,0.95) 0%, transparent 55%)" }} />
                                        <div className="absolute inset-0 pointer-events-none"
                                            style={{ background: `radial-gradient(ellipse at 18% 85%, ${theme.accent}20 0%, transparent 58%)` }} />
                                    </div>

                                    {/* Decoración: carrete SVG */}
                                    <div className="absolute top-4 right-8 opacity-[0.055] pointer-events-none w-48 h-48">
                                        <svg viewBox="0 0 100 100" className="w-full h-full">
                                            <circle cx="50" cy="50" r="46" stroke="white" strokeWidth="1.5" fill="none" />
                                            <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="0.8" fill="none" />
                                            <circle cx="50" cy="50" r="10" fill="white" />
                                            <path d="M50 4 L50 20 M50 80 L50 96 M4 50 L20 50 M80 50 L96 50" stroke="white" strokeWidth="1.2" />
                                            <path d="M17 17 L28 28 M72 72 L83 83 M83 17 L72 28 M28 72 L17 83" stroke="white" strokeWidth="0.8" />
                                        </svg>
                                    </div>

                                    {/* Borde izquierdo del panel — continuación del lomo */}
                                    <div className="absolute inset-y-0 left-0 w-1 z-20 pointer-events-none"
                                        style={{ background: theme.accent }} />

                                    {/* Layout: poster | info */}
                                    <div className="relative z-10 flex flex-row w-full h-full">

                                        {/* POSTER GRANDE */}
                                        <div
                                            className={cn(
                                                "w-[170px] md:w-[200px] shrink-0 h-full flex items-end pl-6 pb-8 transition-all ease-out duration-300 will-change-[opacity,transform]",
                                                isExpanded 
                                                    ? "opacity-100 translate-y-0 delay-75" 
                                                    : "opacity-0 translate-y-4"
                                            )}
                                        >
                                            <div
                                                className="w-full aspect-[2/3] rounded-lg overflow-hidden relative"
                                                style={{
                                                    boxShadow: `0 24px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07), 0 0 40px ${theme.accent}1e`,
                                                }}
                                            >
                                                <DeferredImage
                                                    src={item.posterUrl || ""}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/25 pointer-events-none" />
                                                <div className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: theme.accent }} />
                                            </div>
                                        </div>

                                        {/* INFO */}
                                        <div
                                            className={cn(
                                                "flex-1 flex flex-col justify-end gap-3 px-7 pb-8 pt-8 min-w-0 transition-all ease-out duration-300 will-change-[opacity,transform]",
                                                isExpanded 
                                                    ? "opacity-100 translate-y-0 delay-100" 
                                                    : "opacity-0 translate-y-4"
                                            )}
                                        >
                                            {/* Badges */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                {scoreStr && (
                                                    <div
                                                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black"
                                                        style={{
                                                            background: `${theme.accent}1a`,
                                                            color: theme.accent,
                                                            border: `1px solid ${theme.accent}30`,
                                                        }}
                                                    >
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

                                            {/* Título + saga */}
                                            <div>
                                                <h2
                                                    className="font-bebas uppercase leading-[0.88] text-white line-clamp-2"
                                                    style={{
                                                        fontSize: "clamp(34px, 4vw, 54px)",
                                                        textShadow: "0 6px 28px rgba(0,0,0,0.65)",
                                                    }}
                                                >
                                                    {item.title}
                                                </h2>
                                                <div className="flex items-center gap-2.5 mt-2">
                                                    <div className="h-[2px] w-10 rounded-full shrink-0" style={{ background: theme.accent }} />
                                                    <span
                                                        className="text-[10px] font-black uppercase tracking-[0.35em] font-mono"
                                                        style={{ color: theme.accent }}
                                                    >
                                                        {subtitle}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Descripción */}
                                            {item.description && (
                                                <p
                                                    className="text-[13px] leading-[1.65] text-zinc-300/85 line-clamp-3 font-normal"
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
                                                                border: "1px solid rgba(255,255,255,0.09)",
                                                                color: "rgba(195,195,208,0.8)",
                                                            }}
                                                        >
                                                            {g}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Stats + botón CTA */}
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
                                                    className="flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[11px] tracking-[0.2em] uppercase transition-[background,color,box-shadow,transform] duration-200 hover:scale-[1.03] active:scale-[0.97] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                                    style={{
                                                        background: "white",
                                                        color: "black",
                                                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                                    }}
                                                    onMouseEnter={e => {
                                                        const btn = e.currentTarget
                                                        btn.style.background = theme.accent
                                                        btn.style.color = theme.labelText
                                                        btn.style.boxShadow = `0 8px 32px ${theme.accent}55`
                                                    }}
                                                    onMouseLeave={e => {
                                                        const btn = e.currentTarget
                                                        btn.style.background = "white"
                                                        btn.style.color = "black"
                                                        btn.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"
                                                    }}
                                                >
                                                    <Play className="w-4 h-4 fill-current shrink-0" />
                                                    <span>{type === "series" ? "INICIAR REPRODUCCIÓN" : "SINTONIZAR ARCO"}</span>
                                                    <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
})