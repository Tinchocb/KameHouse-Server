import * as React from "react"
import { motion } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { spotlightCardItemVariants } from "./spotlight-movie-card"

export interface SpotlightSagaCardProps {
    saga: SagaDefinition
    thumbnailUrl?: string | null
    seriesId: number
    index?: number
    colors: typeof ERA_COLOR_MAP[EraId]
    onNavigateSaga: (seriesId: number, sagaId: string) => void
    onHover: () => void
}

export const SpotlightSagaCard = React.memo(function SpotlightSagaCard({
    saga,
    thumbnailUrl,
    seriesId,
    index = 0,
    colors,
    onNavigateSaga,
    onHover,
}: SpotlightSagaCardProps) {
    const sagaImage = thumbnailUrl || ""
    const epRange = `Ep. ${saga.startEp} — ${saga.endEp}`
    const epCount = saga.endEp - saga.startEp + 1

    const isFiller = saga.title.toLowerCase().includes("relleno")
    const cleanTitle = saga.title.replace(/\s*\([Rr]elleno\)\s*/g, "").trim()

    return (
        // Mismo tratamiento que SpotlightMovieCard: hover CSS, sin will-change
        // permanente, sin backdrop-blur por badge, sin springs por tarjeta.
        <motion.div
            variants={spotlightCardItemVariants}
            custom={index}
            onClick={() => onNavigateSaga(seriesId, saga.id)}
            onMouseEnter={onHover}
            className={cn(
                "group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer border border-[var(--glass-border-side)] select-none shrink-0 bg-[var(--md-sys-color-surface-container)] transform-gpu",
                "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]",
                "hover:z-10 hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
            )}
            style={{
                borderColor: `color-mix(in srgb, ${colors.glowStrong} 20%, rgba(255,255,255,0.1))`,
                // Título en hover con el color vivo de la era.
                "--spotlight-title-hover": colors.ambientGlow1,
            } as React.CSSProperties}
        >
            <DeferredImage
                src={sagaImage}
                alt={cleanTitle}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            {/* Top Badges (Ep Range & Filler/Arcs) — sin backdrop-blur */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-top)] text-[var(--status-warning)] uppercase shadow-elevation-1">
                    {epRange}
                </span>
                {isFiller ? (
                    <span className="text-[9px] font-mono font-black tracking-wider px-2 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-top)] text-[var(--brand-secondary-hex)] uppercase shadow-elevation-1">
                        Relleno
                    </span>
                ) : saga.subSagas && saga.subSagas.length > 0 ? (
                    <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface-variant uppercase shadow-elevation-1">
                        {saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}
                    </span>
                ) : null}
            </div>

            {/* Gradient overlay: difuminado idéntico al formato de películas en Home */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />

            {/* Play Button Overlay on Hover (CSS, sin spring por tarjeta) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigateSaga(seriesId, saga.id)
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-on-primary bg-brand-accent shadow-xl shadow-brand-accent/50 pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </div>
            </div>

            {/* Title & Info at bottom over difuminado */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-3.5 flex flex-col justify-end pointer-events-none">
                <p className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide leading-tight line-clamp-1 text-edge-glow group-hover:text-[var(--spotlight-title-hover)] transition-colors font-display">
                    {cleanTitle}
                </p>
                <div className="flex items-center gap-2 text-on-surface-variant text-[10px] sm:text-[11px] font-mono mt-0.5">
                    <span>{epCount} {epCount === 1 ? "episodio" : "episodios"}</span>
                    {saga.subSagas && saga.subSagas.length > 0 && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                            <span>{saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}</span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    )
})
