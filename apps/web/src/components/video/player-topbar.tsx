import React from "react"
import { FiX } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    mediaFormat?: string | null
    onClose: () => void
}

function cleanMediaTitle(text?: string, isMovie?: boolean): string {
    if (!text) return ""
    // Remove extensions
    let cleaned = text.replace(/\.(mkv|mp4|avi|m4v|mov)$/i, "")
    // Remove duplicate extensions or trailing dots
    cleaned = cleaned.replace(/\.(mkv|mp4|avi|m4v|mov)/i, "").trim()
    
    // Strip common series prefixes for movies (e.g. "Dragon Ball: ", "Dragon Ball Z ", "Dragon Ball GT ")
    if (isMovie) {
        cleaned = cleaned.replace(/^(dragon\s*ball\s*(z|gt|super|kai)?\s*[:\-–—]?\s*)/i, "").trim()
    }
    
    // Capitalize nicely if it's all uppercase (e.g. "LA PRINCESA DURMIENTE..." -> "La Princesa Durmiente...")
    if (cleaned === cleaned.toUpperCase() && !/^[\d\s\W]+$/.test(cleaned)) {
        cleaned = cleaned
            .toLowerCase()
            .replace(/\b([a-z])/g, (c) => c.toUpperCase())
            // Capitalize common acronyms/words
            .replace(/\b(Dbz|Db|Gt|Ova|Saga)\b/g, (m) => m.toUpperCase())
            .replace(/\b(En|El|La|Lo|De|Y|Con|O|Para|Del|Al)\b/gi, (m) => m.toLowerCase());
        
        // Always capitalize the very first word
        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
        }
    }
    return cleaned
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

