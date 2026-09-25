import * as React from "react"
import { m } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { spotlightCardItemVariants } from "./spotlight-movie-card"
import { useMotionTier, cardMotionProps } from "@/components/ui/kinetics"

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

    const detectedTier = useMotionTier()
    const motionProps = cardMotionProps(detectedTier)
    const isFullTier = detectedTier === "full"
    const isSubtleTier = detectedTier === "subtle"

    return (
        // Mismo tratamiento canónico que MoviePosterCard: tier full asume spring hover/tap
        // y subtle retiene la transición CSS nativa ligera, sin conflicto de transform.
        <m.div
            variants={spotlightCardItemVariants}
            custom={index}
            {...motionProps}
            onClick={() => onNavigateSaga(seriesId, saga.id)}
            // Activable con teclado; Enter sobre el botón "Reproducir" interno no navega.
            role="button"
            tabIndex={0}
            aria-label={`Ver ${cleanTitle}`}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onNavigateSaga(seriesId, saga.id)
                }
            }}
            onFocus={onHover}
            onMouseEnter={onHover}
            className={cn(
                "group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer border border-[var(--glass-border-side)] select-none shrink-0 bg-[var(--md-sys-color-surface-container)] transform-gpu",
                isFullTier
                    ? "transition-[border-color,box-shadow] duration-base ease-smooth-out"
                    : isSubtleTier
                    ? "transition-[transform,border-color,box-shadow] duration-base ease-smooth-out hover:-translate-y-1 hover:scale-[1.015] active:scale-95"
                    : "transition-[border-color,box-shadow] duration-base ease-smooth-out",
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
            <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-none group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none" />

            {/* Top Badges (Ep Range & Filler/Arcs) — fondo opaco sin blur por rendimiento */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-20 pointer-events-none">
                <span className="text-2xs font-mono font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-black/65 border border-white/20 text-white uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    {epRange}
                </span>
                {isFiller ? (
                    <span className="text-2xs font-mono font-black tracking-wider px-2 py-0.5 rounded-md bg-black/65 border border-white/20 text-white uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                        Relleno
                    </span>
                ) : saga.subSagas && saga.subSagas.length > 0 ? (
                    <span className="text-2xs font-mono font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-black/65 border border-white/20 text-white/90 uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                        {saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}
                    </span>
                ) : null}
            </div>

            {/* Scrims: superior para badges + inferior denso para título/meta */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/65 via-black/25 to-transparent z-10 pointer-events-none" />
            {/* Gradient overlay: difuminado idéntico al formato de películas en Home */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-10 pointer-events-none" />

            {/* Play Button Overlay on Hover (CSS, sin spring por tarjeta) — siempre visible en táctil */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                <button
                    type="button"
                    aria-label={`Reproducir ${cleanTitle}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigateSaga(seriesId, saga.id)
                    }}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-black ring-1 ring-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,1)] pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90 p-0 border-0"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </button>
            </div>

            {/* Title & Info at bottom over difuminado */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-3.5 flex flex-col justify-end pointer-events-none">
                <p className="text-white font-black text-sm sm:text-[15px] uppercase tracking-wide leading-snug line-clamp-2 text-edge-glow group-hover:text-[var(--spotlight-title-hover)] transition-colors font-display">
                    {cleanTitle}
                </p>
                <div className="flex items-center gap-1.5 text-white/85 text-2xs sm:text-xs font-mono font-semibold mt-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    <span>{epCount} {epCount === 1 ? "episodio" : "episodios"}</span>
                    {saga.subSagas && saga.subSagas.length > 0 && (
                        <>
                            <span className="text-white/50">•</span>
                            <span>{saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}</span>
                        </>
                    )}
                </div>
            </div>
        </m.div>
    )
})
