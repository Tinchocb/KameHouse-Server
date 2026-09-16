import React from "react"
import { cleanMediaTitle } from "@/lib/helpers/media"
import { IconStatusMonitorPlay, IconUiClose } from "@/components/ui/icons";

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    mediaFormat?: string | null
    onClose: () => void
    onOpenInMpv?: () => void
}

export function PlayerTopBar({ title, episodeLabel, episodeNumber, mediaFormat, onClose, onOpenInMpv }: PlayerTopBarProps) {
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

return (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6 md:p-8 pt-[max(1rem,env(safe-area-inset-top,0px))] pointer-events-none z-player-ui bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex flex-col ml-2 pointer-events-auto select-none [&>*:not(:first-child)]:mt-1">
                <span className="text-brand-accent/50 text-label-sm font-black uppercase tracking-cinema" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {isMovie ? "Película" : `Episodio ${episodeNumber ?? ""}`}
                </span>
                <h2 className="text-on-surface text-lg md:text-xl font-bold uppercase tracking-wider truncate max-w-[250px] sm:max-w-md md:max-w-xl lg:max-w-3xl">
                    {displayTitle}
                </h2>
            </div>
            <div className="flex items-center gap-3 shrink-0 pointer-events-auto">
            {onOpenInMpv && (
                <button
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onOpenInMpv(); }}
                    aria-label="Abrir en mpv"
                    title="Abrir en mpv"
                    className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 text-zinc-300 bg-zinc-950/60 backdrop-blur-overlay-2xl will-change-[backdrop-filter] [transform:translateZ(0)] hover:text-white hover:bg-zinc-900/80 border border-white/20 border-t-white/40 border-b-white/10 rounded-full transition-all duration-base active:scale-[0.95] group shrink-0 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer"
                >
                    <IconStatusMonitorPlay className="w-5 h-5 group-hover:scale-110 transition-transform duration-base" />
                </button>
            )}
            <button
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Cerrar reproductor"
                className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 text-zinc-300 bg-zinc-950/60 backdrop-blur-overlay-2xl will-change-[backdrop-filter] [transform:translateZ(0)] hover:text-white hover:bg-zinc-900/80 border border-white/20 border-t-white/40 border-b-white/10 rounded-full transition-all duration-base active:scale-[0.95] group shrink-0 pointer-events-auto focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer"
            >
                <IconUiClose className="w-5 h-5 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-base" />
            </button>
            </div>
        </div>
    )
}