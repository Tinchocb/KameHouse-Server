import React from "react"
import { cleanMediaTitle } from "@/lib/helpers/media"
import { FiX } from "react-icons/fi"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    mediaFormat?: string | null
    onClose: () => void
}

export function PlayerTopBar({ title, episodeLabel, episodeNumber, mediaFormat, onClose }: PlayerTopBarProps) {
    const isMovie = React.useMemo(() => {
        const formatUpper = mediaFormat?.toUpperCase()
        if (formatUpper === "MOVIE" || formatUpper === "SPECIAL" || formatUpper === "OVA") {
            return true
        }
        // Fallback detection using text indicators
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
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6 md:p-8 pointer-events-none z-[100] bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex flex-col gap-1 pointer-events-auto select-none pl-2">
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em]" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {isMovie ? "Película" : `Episodio ${episodeNumber ?? ""}`}
                </span>
                <h2 className="text-white text-lg md:text-xl font-bold uppercase tracking-wider truncate max-w-[250px] sm:max-w-md md:max-w-xl lg:max-w-3xl">
                    {displayTitle}
                </h2>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Cerrar reproductor"
                className="flex items-center justify-center w-10 h-10 text-white/70 bg-zinc-950/40 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-md rounded-2xl transition-all duration-300 active:scale-95 group shrink-0 pointer-events-auto"
            >
                <FiX className="w-5 h-5 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-300" />
            </button>
        </div>
    )
}

