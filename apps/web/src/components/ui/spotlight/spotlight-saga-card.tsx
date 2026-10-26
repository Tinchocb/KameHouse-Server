import * as React from "react"
import { m } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { spotlightCardItemVariants } from "./spotlight-movie-card"
import { useMotionTier, cardMotionProps } from "@/components/ui/kinetics"

interface SpotlightSagaCardProps {
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
    const epRange = `Ep. ${saga.startEp}–${saga.endEp}`
    const epCount = saga.endEp - saga.startEp + 1

    const isFiller = saga.title.toLowerCase().includes("relleno")
    const cleanTitle = saga.title.replace(/\s*\([Rr]elleno\)\s*/g, "").trim()
    const subSagas = saga.subSagas ?? []
    const hasSubSagas = subSagas.length > 0
    const visibleSubSagas = subSagas.length > 4 ? subSagas.slice(0, 3) : subSagas
    const hiddenSubSagasCount = subSagas.length - visibleSubSagas.length

    const detectedTier = useMotionTier()
    const motionProps = cardMotionProps(detectedTier)
    const isFullTier = detectedTier === "full"
    // En subtle la sombra no se transiciona: su blur de 35 px se repintaba en cada cuadro del hover.
    const isSubtleTier = detectedTier === "subtle"

    return (
        // Mismo tratamiento canónico que MoviePosterCard: tier full asume spring hover/tap
        // y subtle retiene la transición CSS nativa ligera, sin conflicto de transform.
        <m.div
            variants={spotlightCardItemVariants}
            custom={index}
            {...motionProps}
            onClick={() => onNavigateSaga(seriesId, saga.id)}
            // Activable con teclado (Enter/Espacio).
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
                    ? "transition-[transform,border-color] duration-base ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.015] active:scale-95"
                    : "transition-[border-color,box-shadow] duration-base ease-smooth-out",
                "[@media(hover:hover)_and_(pointer:fine)]:hover:z-10 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[shadow:var(--shadow-poster-hover)]"
            )}
            style={{
                borderColor: `color-mix(in srgb, ${colors.glowStrong} 25%, rgba(255,255,255,0.12))`,
                // Título y acentos en hover con el color vivo de la era.
                "--spotlight-title-hover": colors.ambientGlow1,
                "--spotlight-era-accent": colors.accent,
            } as React.CSSProperties}
        >
            <DeferredImage
                src={sagaImage}
                alt={cleanTitle}
                className="absolute inset-0 h-full w-full object-cover [filter:saturate(1.16)_contrast(1.06)_brightness(1.02)] transition-transform duration-slow ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            />
            <div aria-hidden className="absolute inset-0 -translate-x-full [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-full transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none" />

            {/* Top Badge (Ep Range + punto de era; sin repetir el conteo de arcos arriba) */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-20 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider tabular-nums px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-white shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--spotlight-era-accent)] shadow-[0_0_6px_var(--spotlight-era-accent)]"
                    />
                    {epRange}
                </span>
                {isFiller && (
                    <span className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-white/90 shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                        Relleno
                    </span>
                )}
            </div>

            {/* Scrims: en reposo libera el centro de la miniatura; en hover oscurece por opacity para leer el desglose de arcos */}
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/45 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 pointer-events-none" />
            {hasSubSagas && (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/25 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-base ease-smooth-out z-10 pointer-events-none"
                />
            )}

            {/* Play Button Overlay: solo en sagas sin drawer o en pantallas táctiles para no chocar con el desglose de arcos */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 max-sm:opacity-100 transition-opacity duration-200 z-20 pointer-events-none",
                    !hasSubSagas && "group-hover:opacity-100 group-focus-visible:opacity-100"
                )}
            >
                <span
                    aria-hidden
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-black ring-1 ring-white/40 shadow-[shadow:var(--shadow-play-cta)] transition-transform duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04] group-active:scale-95"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </span>
            </div>

            {/* Title, Info & Expandable Arc Drawer at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-3.5 flex flex-col justify-end pointer-events-none">
                <p className="text-white font-extrabold text-sm sm:text-base leading-snug line-clamp-1 text-balance text-edge-glow group-hover:text-[var(--spotlight-title-hover)] transition-colors duration-fast font-display">
                    {cleanTitle}
                </p>
                <div className="flex items-center gap-1.5 text-white/85 text-xs font-medium tabular-nums mt-0.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    <span>{epCount} {epCount === 1 ? "episodio" : "episodios"}</span>
                    {hasSubSagas && (
                        <>
                            <span aria-hidden="true" className="text-white/45">·</span>
                            <span className="text-[var(--spotlight-title-hover)] font-semibold">
                                {subSagas.length} {subSagas.length === 1 ? "arco" : "arcos"}
                            </span>
                        </>
                    )}
                </div>

                {/* Drawer de episodios por arco (Variante D) */}
                {hasSubSagas && (
                    <div className="grid grid-rows-[0fr] [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-focus-visible:opacity-100 transition-[grid-template-rows,opacity] duration-base ease-smooth-out">
                        <div className="overflow-hidden">
                            <div className="mt-2 pt-1.5 border-t border-white/15 space-y-1">
                                {visibleSubSagas.map((sub, subIdx) => (
                                    <div
                                        key={sub.id}
                                        className="flex items-center justify-between gap-2 text-xs leading-tight"
                                    >
                                        <span className="text-white/90 truncate">
                                            <b className="font-mono text-[var(--spotlight-title-hover)] mr-1 tabular-nums">
                                                {subIdx + 1}.
                                            </b>
                                            {sub.title.replace(/\s*\([Rr]elleno\)\s*/g, "").trim()}
                                        </span>
                                        <span className="text-white/60 font-mono tabular-nums shrink-0">
                                            Ep. {sub.startEp}–{sub.endEp}
                                        </span>
                                    </div>
                                ))}
                                {hiddenSubSagasCount > 0 && (
                                    <div className="text-xs font-mono text-white/55 pt-0.5">
                                        +{hiddenSubSagasCount} {hiddenSubSagasCount === 1 ? "arco más" : "arcos más"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </m.div>
    )
})
