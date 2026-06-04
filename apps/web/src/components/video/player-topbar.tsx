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
        <div className={cn(
            "absolute top-4 inset-x-4 md:top-5 md:inset-x-5 max-w-5xl mx-auto flex items-center justify-between pointer-events-auto",
            "bg-[#09090b] border border-white/5 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] px-4 py-2.5",
            "z-[100]"
        )}>
            <div className="flex gap-3 items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-7 h-7 text-white/40 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-lg transition-all duration-300 group"
                >
                    <FiX className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
                
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-white font-bebas text-lg md:text-xl tracking-[0.02em] uppercase leading-none truncate max-w-[50vw]">
                        {displayTitle}
                    </h1>
                    {!isMovie && (
                        <span className="text-zinc-500 font-bold tracking-[0.1em] uppercase text-[8px] md:text-[9px] flex items-center gap-2 opacity-80">
                            {cleanTitle} {episodeNumber ? `• Episodio ${episodeNumber}` : ""}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

