import * as React from "react"
import { m } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { spotlightCardItemVariants } from "./spotlight-movie-card"
import { useMotionTier, cardMotionProps } from "@/components/ui/kinetics"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useIsClassicMode, useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

interface SagaColorConfig {
    accent: string
    border: string
    glow: string
    text: string
}

/**
 * Acentos cromáticos temáticos por saga.
 * Las variantes (border, glow, text) se calculan dinámicamente vía color-mix().
 */
const SAGA_ACCENT_COLORS: Record<string, string> = {
    saiyajin: "var(--color-rose-500, #f43f5e)",
    "namek-freezer": "var(--color-cyan-500, #06b6d4)",
    "garlic-jr": "var(--color-emerald-500, #10b981)",
    "trunks-androides-cell": "var(--color-emerald-500, #10b981)",
    "androides-cell": "var(--color-emerald-500, #10b981)",
    "torneo-otro-mundo": "var(--color-sky-500, #38bdf8)",
    "majin-buu": "var(--color-pink-500, #ec4899)",
    pilaf: "var(--color-orange-500, #f97316)",
    "torneo-21": "var(--color-yellow-500, #eab308)",
    "red-ribbon": "var(--color-red-500, #ef4444)",
    "torneo-22": "var(--color-amber-500, #f59e0b)",
    "piccolo-daimaku": "var(--color-emerald-600, #059669)",
    "torneo-23": "var(--color-yellow-500, #eab308)",
    "batalla-dioses": "var(--color-purple-500, #a855f7)",
    "resurreccion-f": "var(--color-cyan-500, #06b6d4)",
    champa: "var(--color-amber-500, #f59e0b)",
    "trunks-futuro": "var(--color-sky-500, #38bdf8)",
    "torneo-poder": "var(--color-indigo-500, #6366f1)",
    "black-star": "var(--color-orange-500, #f97316)",
    baby: "var(--color-rose-600, #e11d48)",
    "super-17": "var(--color-cyan-500, #06b6d4)",
    "shadow-dragons": "var(--color-blue-500, #3b82f6)",
    daima: "var(--color-purple-500, #a855f7)",
}

function createSagaColorConfig(accent: string): SagaColorConfig {
    return {
        accent,
        border: `color-mix(in srgb, ${accent} 35%, transparent)`,
        glow: `color-mix(in srgb, ${accent} 22%, transparent)`,
        text: `color-mix(in srgb, ${accent} 70%, white)`,
    }
}

function getSagaColors(sagaId: string, eraColors?: typeof ERA_COLOR_MAP[EraId]): SagaColorConfig {
    const specificAccent = SAGA_ACCENT_COLORS[sagaId]
    if (specificAccent) return createSagaColorConfig(specificAccent)

    if (eraColors) {
        return {
            accent: eraColors.accent,
            border: `color-mix(in srgb, ${eraColors.glowStrong} 35%, rgba(255,255,255,0.12))`,
            glow: `color-mix(in srgb, ${eraColors.glow} 25%, transparent)`,
            text: eraColors.ambientGlow1 || eraColors.accent,
        }
    }

    return createSagaColorConfig("var(--brand-accent, #F59E0B)")
}

interface SpotlightSagaCardProps {
    saga: SagaDefinition
    thumbnailUrl?: string | null
    seriesId: number
    index?: number
    progressPercent?: number
    colors: typeof ERA_COLOR_MAP[EraId]
    onNavigateSaga: (seriesId: number, sagaId: string) => void
    onHover: () => void
    className?: string
}

/**
 * SpotlightSagaCard — Tarjeta de saga limpia y minimalista para el Home (Bento Style).
 *
 * Características:
 * - Miniatura panorámica 16:9 con arte 100% visible (cero degradados opacos centrales).
 * - Borde y halo tonal suave que identifica temáticamente a cada saga.
 * - En hover: botón Play en la esquina inferior derecha.
 * - Bloque de texto exterior (título y metadatos) con alta legibilidad.
 */
export const SpotlightSagaCard = React.memo(function SpotlightSagaCard({
    saga,
    thumbnailUrl,
    seriesId,
    index = 0,
    progressPercent,
    colors,
    onNavigateSaga,
    onHover,
    className,
}: SpotlightSagaCardProps) {
    const sagaImage = thumbnailUrl || ""
    const epRange = `Episodios ${saga.startEp}–${saga.endEp}`

    const isFiller = saga.title.toLowerCase().includes("relleno")
    const cleanTitle = saga.title.replace(/\s*\([Rr]elleno\)\s*/g, "").trim()
    const subSagas = saga.subSagas ?? []
    const hasSubSagas = subSagas.length > 0

    const detectedTier = useMotionTier()
    const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")
    const isMinimalist = useIsMinimalistMode()
    const motionProps = cardMotionProps(detectedTier, canHover, { isMinimalist })
    const isClassic = useIsClassicMode()

    const sagaColor = React.useMemo(() => {
        if (isClassic) {
            return {
                accent: "var(--label-1)",
                border: "var(--neutral-separator)",
                glow: "transparent",
                text: "var(--label-1)",
            }
        }
        return getSagaColors(saga.id, colors)
    }, [isClassic, saga.id, colors])

    return (
        <m.article
            variants={spotlightCardItemVariants}
            custom={index}
            {...motionProps}
            animate={detectedTier === "off" ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } } : undefined}
            onMouseEnter={onHover}
            className={cn("spotlight-saga-card group relative flex flex-col overflow-hidden border border-[var(--surface-content-border)] bg-[color-mix(in_srgb,var(--surface-content)_82%,transparent)] backdrop-blur-[var(--blur-overlay-sm)] focus-within:ring-2 focus-within:ring-brand-accent cursor-pointer select-none rounded-2xl outline-none shrink-0 w-full", className)}
            style={{
                "--saga-accent": sagaColor.accent,
                "--saga-border": sagaColor.border,
                "--saga-glow": sagaColor.glow,
                "--saga-text": sagaColor.text,
            } as React.CSSProperties}
        >
            {/* Destino de teclado y lectores de pantalla (overlay canónico) */}
            <button
                type="button"
                aria-label={`Ver ${cleanTitle}`}
                onClick={() => onNavigateSaga(seriesId, saga.id)}
                onFocus={onHover}
                className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
            />
            <div className="saga-card-media relative w-full overflow-hidden bg-[var(--md-sys-color-surface-container)] aspect-[16/9]">
                <DeferredImage
                    src={sagaImage}
                    alt=""
                    objectPosition="50% 40%"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
                />

                {/* Botón Play esquinado en hover (sin degradados oscuros ni chips que tapen el dibujo) */}
                <div
                    aria-hidden
                    className="absolute right-3 bottom-3 opacity-0 translate-y-1.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-y-0 group-focus-visible:opacity-100 group-has-[:focus-visible]:opacity-100 motion-safe:group-focus-visible:translate-y-0 motion-safe:group-has-[:focus-visible]:translate-y-0 transition-[opacity,transform] duration-200 z-20 pointer-events-none"
                >
                    <span
                        className="saga-play-cta w-10 h-10 rounded-full flex items-center justify-center bg-white text-black shadow-[shadow:var(--shadow-play-cta)] transition-transform duration-fast ease-out-strong motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
                    >
                        <IconMediaPlay size={15} fill="currentColor" className="ml-0.5 text-black" />
                    </span>
                </div>

                {progressPercent != null && progressPercent > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/55 z-20 pointer-events-none overflow-hidden">
                        <div
                            className="watch-progress-fill h-full w-full origin-left transition-transform duration-base ease-smooth-out"
                            style={{
                                transform: `scaleX(${Math.min(1, Math.max(0, progressPercent / 100))})`,
                                backgroundColor: "var(--saga-accent)",
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Bloque de Información Exterior (debajo de la miniatura) */}
            <div className="px-4 py-3 space-y-1 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--saga-accent)_10%,transparent),transparent)]">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="card-title text-base font-bold text-on-surface tracking-tight leading-snug line-clamp-2 text-balance font-display [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[var(--saga-text)] group-has-[:focus-visible]:text-[var(--saga-text)] transition-colors duration-fast">
                        {cleanTitle}
                    </h3>

                </div>

                <div className="card-metadata flex items-center gap-1.5 text-xs text-label-2 font-medium tabular-nums">
                    <span className="card-episode-range text-label-2">{epRange}</span>
                    {hasSubSagas && (
                        <>
                            <span aria-hidden="true" className="text-label-3">·</span>
                            <span className="text-label-2 font-medium">
                                {subSagas.length} {subSagas.length === 1 ? "arco" : "arcos"}
                            </span>
                        </>
                    )}
                    {isFiller && (
                        <>
                            <span aria-hidden="true" className="text-label-3">·</span>
                            <span className="text-amber-400 font-semibold">Relleno</span>
                        </>
                    )}
                </div>
            </div>
        </m.article>
    )
})
