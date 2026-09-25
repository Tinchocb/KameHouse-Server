import React from "react"
import { Link } from "@tanstack/react-router"
import { useGetAnimeEntrySource, useSetAnimeEntrySource, type MediaSourceChoice } from "@/api/hooks/anime_entries.hooks"
import { IconNavigationLayers } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { MagneticIndicator } from "@/components/ui/kinetics/magnetic-indicator"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"

interface SourceOption {
    value: MediaSourceChoice
    label: string
    detail: string
    disabled: boolean
}

/**
 * Selector de origen de reproducción de la serie: Automático (local y, si
 * falta, la nube), Solo local o Solo nube. Solo aparece cuando la serie tiene
 * archivos en los dos orígenes; con uno solo no hay nada que elegir.
 */
export function SeriesSourcePicker({ mediaId, className }: { mediaId: number | undefined; className?: string }) {
    const { data: info } = useGetAnimeEntrySource(mediaId)
    const { mutate: setSource, isPending } = useSetAnimeEntrySource(mediaId)
    const reduceMotion = useReducedMotion()

    if (!info || !mediaId || info.localFiles === 0 || info.cloudFiles === 0) return null

    const options: SourceOption[] = [
        { value: "auto", label: "Automático", detail: "Local primero", disabled: false },
        {
            value: "local",
            label: "Local",
            detail: info.localEnabled ? `${info.localFiles} archivos` : "Apagado en Ajustes",
            disabled: !info.localEnabled,
        },
        {
            value: "cloud",
            label: "Nube",
            detail: info.cloudEnabled ? `${info.cloudFiles} archivos` : "Apagado en Ajustes",
            disabled: !info.cloudEnabled,
        },
    ]

    // La preferencia elegida apunta a un origen apagado: se está usando Automático.
    const overridden = info.preference !== "auto" && info.effective !== info.preference

    return (
        <section
            aria-label="Origen de reproducción"
            className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
        >
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <IconNavigationLayers className="h-4 w-4 text-brand-accent" aria-hidden />
                <span className="font-medium text-on-surface">Origen</span>
                {overridden && (
                    <span className="text-xs text-on-surface-variant">
                        · el origen elegido está apagado, se usa Automático (
                        <Link to="/settings" search={{ tab: "library" }} className="underline hover:text-on-surface">
                            Ajustes
                        </Link>
                        )
                    </span>
                )}
            </div>

            {/* Segmented control (§5.3): pill activa con layoutId + spring del sistema */}
            <div
                role="radiogroup"
                aria-label="Origen de reproducción"
                className="flex w-fit items-center gap-1 rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5"
            >
                {options.map(opt => {
                    const checked = info.preference === opt.value
                    const count = opt.value === "local" ? info.localFiles : opt.value === "cloud" ? info.cloudFiles : null
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={`${opt.label}, ${opt.detail}`}
                            title={opt.detail}
                            disabled={opt.disabled || isPending}
                            onClick={() => !checked && setSource({ mediaId, source: opt.value })}
                            className={cn(
                                "relative flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors duration-base",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                checked ? "text-zinc-950 font-bold" : "text-on-surface-variant hover:text-on-surface",
                                (opt.disabled || isPending) && "cursor-not-allowed opacity-50 hover:text-on-surface-variant",
                            )}
                        >
                            <MagneticIndicator
                                layoutId={`seriesSource-${mediaId}`}
                                active={checked}
                                disableAnimation={!!reduceMotion}
                                className="bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]"
                            />
                            <span className="relative z-10">{opt.label}</span>
                            {count != null && opt.disabled === false && (
                                <span className="relative z-10 font-mono text-3xs tabular-nums opacity-70">{count}</span>
                            )}
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
