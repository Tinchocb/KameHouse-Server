import React from "react"
import { m } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cleanMediaTitle } from "@/lib/helpers/media"
import { toast } from "sonner"
import { Clock, RotateCcw } from "lucide-react"
import { useSaveChronologyMomentTime } from "@/api/hooks/chronology.hooks"
import { formatSecondsToTime } from "@/components/chronology/data/spansToVolumes"
import { IconStatusMonitorPlay, IconUiClose } from "@/components/ui/icons"
import { AnimatedTooltip } from "@/components/ui/kinetics/animated-tooltip"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_EYEBROW, PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    mediaFormat?: string | null
    onClose: () => void
    onOpenInMpv?: () => void
    momentKey?: string
    momentTitle?: string
    currentTime?: number
}

export function PlayerTopBar({
    title,
    episodeLabel,
    episodeNumber,
    mediaFormat,
    onClose,
    onOpenInMpv,
    momentKey,
    momentTitle,
    currentTime,
}: PlayerTopBarProps) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()
    const saveMomentMutation = useSaveChronologyMomentTime()
    const formattedCurrentTime = formatSecondsToTime(currentTime || 0)

    const handleFixMoment = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (!momentKey) return
        const roundedSec = Math.round(currentTime || 0)
        saveMomentMutation.mutate(
            { momentKey, seconds: roundedSec },
            {
                onSuccess: () => {
                    toast.success("Momento actualizado")
                },
                onError: () => {
                    toast.error("No se pudo actualizar el momento")
                },
            }
        )
    }, [momentKey, currentTime, saveMomentMutation])

    const handleResetMoment = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (!momentKey) return
        saveMomentMutation.mutate(
            { momentKey, seconds: -1 },
            {
                onSuccess: () => {
                    toast.success("Momento restablecido")
                },
                onError: () => {
                    toast.error("No se pudo restablecer el momento")
                },
            }
        )
    }, [momentKey, saveMomentMutation])

    const isMovie = React.useMemo(() => {
        const formatUpper = mediaFormat?.toUpperCase()
        if (formatUpper === "MOVIE" || formatUpper === "SPECIAL" || formatUpper === "OVA") {
            return true
        }
        const searchText = `${title || ""} ${episodeLabel || ""}`.toLowerCase()
        return searchText.includes("pelicula") || searchText.includes("película")
    }, [mediaFormat, title, episodeLabel])

    const cleanTitle = React.useMemo(() => cleanMediaTitle(title, isMovie), [title, isMovie])
    const cleanLabel = React.useMemo(() => cleanMediaTitle(episodeLabel, isMovie), [episodeLabel, isMovie])

    const displayTitle = React.useMemo(() => {
        if (isMovie) {
            return cleanTitle || cleanLabel || "Reproduciendo"
        }
        return cleanLabel || cleanTitle || "Reproduciendo"
    }, [isMovie, cleanTitle, cleanLabel])

    const iconBtn = PLAYER_ICON_BTN

    return (
        <m.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0.15 } : entranceSpring}
            className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-12 pointer-events-none z-player-ui bg-gradient-to-b from-black/75 via-black/30 to-transparent"
        >
            <div className="flex flex-col min-w-0 pl-1 pt-1 gap-1.5 pointer-events-auto select-none">
                <span className={cn(PLAYER_EYEBROW, "tabular-nums truncate")}>
                    {isMovie ? "Película" : (episodeNumber != null ? `Episodio ${episodeNumber}` : (cleanTitle || "Serie"))}
                </span>
                <h2 className="font-display text-white text-lg sm:text-xl font-medium tracking-tight leading-tight truncate [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
                    {displayTitle}
                </h2>
                {momentKey && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent text-xs font-semibold backdrop-blur-md shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                            <span className="truncate max-w-[200px] sm:max-w-xs">
                                Momento: {momentTitle || "Hito seleccionado"}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={handleFixMoment}
                            disabled={saveMomentMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-white/20 text-xs font-medium cursor-pointer active:scale-95 transition duration-150 backdrop-blur-md shadow-elevation-1 disabled:opacity-50"
                        >
                            <Clock className="w-3.5 h-3.5 text-brand-accent" />
                            <span>Fijar este momento aquí ({formattedCurrentTime})</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetMoment}
                            disabled={saveMomentMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium cursor-pointer active:scale-95 transition duration-150 backdrop-blur-md shadow-sm disabled:opacity-50"
                            title="Restablecer minuto original"
                        >
                            <RotateCcw className="w-3 h-3 text-zinc-400" />
                            <span>Restablecer</span>
                        </button>
                    </div>
                )}
            </div>
            <div className={cn("flex items-center shrink-0 gap-0.5 p-1 rounded-full pointer-events-auto", PLAYER_GLASS)}>
                {onOpenInMpv && (
                    <AnimatedTooltip content="Abrir en MPV" side="bottom">
                        <button
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onOpenInMpv(); }}
                            aria-label="Abrir en mpv"
                            className={iconBtn}
                        >
                            <IconStatusMonitorPlay className="w-4 h-4" />
                        </button>
                    </AnimatedTooltip>
                )}
                <AnimatedTooltip content="Cerrar reproductor [Esc]" side="bottom">
                    <button
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        aria-label="Cerrar reproductor"
                        className={iconBtn}
                    >
                        <IconUiClose className="w-4 h-4" />
                    </button>
                </AnimatedTooltip>
            </div>
        </m.div>
    )
}
