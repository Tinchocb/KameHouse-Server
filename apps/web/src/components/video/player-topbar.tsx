import React from "react"
import { m } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cleanMediaTitle } from "@/lib/helpers/media"
import { toast } from "sonner"
import { IconTimeClock, IconUiRotateCcw } from "@/components/ui/icons"
import { useSaveChronologyMomentTime } from "@/api/hooks/chronology.hooks"
import { formatSecondsToTime } from "@/components/chronology/data/spansToVolumes"
import { IconStatusMonitorPlay, IconUiClose, IconUiSpinner } from "@/components/ui/icons"
import { AnimatedTooltip } from "@/components/ui/kinetics/animated-tooltip"
import { LoadSwap } from "@/components/ui/kinetics/load-swap"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { PLAYER_EYEBROW, PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    mediaFormat?: string | null
    onClose: () => void
    onOpenInMpv?: () => void
    /** mpv está conectando (hasta ~10 s): el botón se bloquea y muestra carga en vez de aceptar otro clic. */
    mpvPending?: boolean
    momentKey?: string
    momentTitle?: string
    mediaElementRef?: React.RefObject<HTMLVideoElement | null>
}

function MomentTimeLabel({ mediaElementRef }: { mediaElementRef?: React.RefObject<HTMLVideoElement | null> }) {
    const [seconds, setSeconds] = React.useState(0)

    React.useEffect(() => {
        const tick = () => {
            const next = Math.floor(mediaElementRef?.current?.currentTime ?? 0)
            setSeconds((prev) => (prev === next ? prev : next))
        }
        tick()
        const id = window.setInterval(tick, 500)
        return () => window.clearInterval(id)
    }, [mediaElementRef])

    return <>Fijar aquí ({formatSecondsToTime(seconds)})</>
}

export const PlayerTopBar = React.memo(function PlayerTopBar({
    title,
    episodeLabel,
    episodeNumber,
    mediaFormat,
    onClose,
    onOpenInMpv,
    mpvPending,
    momentKey,
    momentTitle,
    mediaElementRef,
}: PlayerTopBarProps) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()
    const saveMomentMutation = useSaveChronologyMomentTime()

    const handleFixMoment = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (!momentKey) return
        const roundedSec = Math.round(mediaElementRef?.current?.currentTime || 0)
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
    }, [momentKey, mediaElementRef, saveMomentMutation])

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
            className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 sm:px-8 pt-4 pb-8 pointer-events-none z-player-ui bg-gradient-to-b from-black/65 via-black/25 to-transparent"
        >
            <div className="flex flex-col min-w-0 pl-1 pt-1 gap-1.5 pointer-events-auto select-none">
                <span className={cn(PLAYER_EYEBROW, "tabular-nums truncate")}>
                    {/* Serie · E5 (AVKit): contexto arriba, título del episodio debajo */}
                    {isMovie
                        ? "Película"
                        : [cleanTitle && cleanTitle !== displayTitle ? cleanTitle : null, episodeNumber != null ? `E${episodeNumber}` : null]
                            .filter(Boolean).join(" · ") || "Serie"}
                </span>
                <h2 className="font-display text-label-1 text-lg sm:text-xl font-medium tracking-tight leading-tight truncate [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
                    {displayTitle}
                </h2>
                {momentKey && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className={cn("inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-label-1 text-xs font-semibold", PLAYER_GLASS)}>
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse motion-reduce:animate-none" />
                            <span className="truncate max-w-[200px] sm:max-w-xs">
                                {momentTitle ? `Momento: ${momentTitle}` : "Momento de la cronología"}
                            </span>
                        </span>
                        <Button
                            intent="glass"
                            size="xs"
                            onClick={handleFixMoment}
                            disabled={saveMomentMutation.isPending}
                            leftIcon={
                                <LoadSwap
                                    loading={saveMomentMutation.isPending}
                                    skeleton={<IconUiSpinner className="w-3.5 h-3.5 animate-spin" />}
                                >
                                    <IconTimeClock className="w-3.5 h-3.5" />
                                </LoadSwap>
                            }
                            iconSpacing="0.375rem"
                        >
                            <MomentTimeLabel mediaElementRef={mediaElementRef} />
                        </Button>
                        <Button
                            intent="glass"
                            size="xs"
                            onClick={handleResetMoment}
                            disabled={saveMomentMutation.isPending}
                            title="Volver al minuto original del momento"
                            leftIcon={<IconUiRotateCcw className="w-3 h-3" />}
                            iconSpacing="0.25rem"
                        >
                            Restablecer
                        </Button>
                    </div>
                )}
            </div>
            <div className={cn("flex items-center shrink-0 gap-0.5 p-1 rounded-full pointer-events-auto", PLAYER_GLASS)}>
                {onOpenInMpv && (
                    <AnimatedTooltip content={mpvPending ? "Abriendo en mpv…" : "Abrir en mpv"} side="bottom">
                        <button
                            type="button"
                            tabIndex={0}
                            disabled={mpvPending}
                            aria-busy={mpvPending || undefined}
                            onClick={(e) => { e.stopPropagation(); onOpenInMpv(); }}
                            aria-label={mpvPending ? "Abriendo en mpv" : "Abrir en mpv"}
                            className={cn(iconBtn, "player-mpv-btn", mpvPending && "cursor-wait")}
                        >
                            {mpvPending
                                ? <IconUiSpinner className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                                : <IconStatusMonitorPlay className="w-4 h-4" />}
                        </button>
                    </AnimatedTooltip>
                )}
                <AnimatedTooltip content="Cerrar reproductor [Esc]" side="bottom">
                    <button
                        type="button"
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
})
