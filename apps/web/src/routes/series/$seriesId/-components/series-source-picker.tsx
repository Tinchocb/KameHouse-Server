import React from "react"
import { Link } from "@tanstack/react-router"
import { useGetAnimeEntrySource, useSetAnimeEntrySource, type MediaSourceChoice } from "@/api/hooks/anime_entries.hooks"
import { IconNavigationLayers } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"

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

            <div
                role="radiogroup"
                aria-label="Origen de reproducción"
                className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1"
            >
                {options.map(opt => {
                    const checked = info.preference === opt.value
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            disabled={opt.disabled || isPending}
                            onClick={() => !checked && setSource({ mediaId, source: opt.value })}
                            className={cn(
                                "flex min-w-[6.5rem] flex-col items-start rounded-lg px-3 py-1.5 text-left transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                checked
                                    ? "bg-white/10 text-on-surface"
                                    : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface",
                                (opt.disabled || isPending) && "cursor-not-allowed opacity-50 hover:bg-transparent",
                            )}
                        >
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-3xs font-mono opacity-80">{opt.detail}</span>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
