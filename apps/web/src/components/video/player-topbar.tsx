import React from "react"
import { m } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cleanMediaTitle } from "@/lib/helpers/media"
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
}

export function PlayerTopBar({ title, episodeLabel, episodeNumber, mediaFormat, onClose, onOpenInMpv }: PlayerTopBarProps) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

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
            <div className="flex flex-col min-w-0 pl-1 pt-1 gap-1 pointer-events-auto select-none">
                <span className={cn(PLAYER_EYEBROW, "tabular-nums truncate")}>
                    {isMovie ? "Película" : (episodeNumber != null ? `Episodio ${episodeNumber}` : (cleanTitle || "Serie"))}
                </span>
                <h2 className="font-display text-white text-lg sm:text-xl font-medium tracking-tight leading-tight truncate [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
                    {displayTitle}
                </h2>
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
