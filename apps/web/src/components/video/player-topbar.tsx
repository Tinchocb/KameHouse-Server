import React from "react"
import { FiX } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"
import { cleanMediaTitle } from "@/lib/helpers/media"

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
        <div className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto z-[100]">
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Cerrar reproductor"
                className="flex items-center justify-center w-10 h-10 text-white/70 bg-zinc-950/40 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-md rounded-2xl transition-all duration-300 active:scale-95 group shrink-0"
            >
                <FiX className="w-5 h-5 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-300" />
            </button>
        </div>
    )
}

