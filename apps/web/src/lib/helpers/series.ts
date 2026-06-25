/**
 * Maps a media object to a Dragon Ball series ID string.
 * Used for spine config, lore, and character images.
 */
export const getSeriesIdFromMedia = (media: any): string => {
    if (!media) return ""
    const tmdbId = media.tmdbId || 0
    const title = (media.titleRomaji || media.titleEnglish || media.titleOriginal || "").toLowerCase().replace(/\s+/g, "")
    
    if (tmdbId === 12971 || title.includes("dragonballz") || title === "dbz") return "dragon_ball_z"
    if (tmdbId === 12697 || title.includes("dragonballgt")) return "dragon_ball_gt"
    if (tmdbId === 62715 || title.includes("dragonballsuper")) return "dragon_ball_super"
    if (tmdbId === 236994 || title.includes("dragonballdaima")) return "dragon_ball_daima"
    if (tmdbId === 12609 || title === "dragonball") return "dragon_ball"
    return ""
}

/**
 * Resolves the release year for a Dragon Ball series.
 * Uses hardcoded values for known series, then falls back to API data.
 */
export const getSeriesYear = (title: string, mediaYear?: number, startDate?: string): number | string => {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('daima')) return 2024;
    if (titleLower.includes('super')) return 2015;
    if (titleLower.includes('gt')) return 1996;
    if (titleLower.includes('kai') || titleLower.includes('seldion')) return 2009;
    if (titleLower.includes('dbz') || (titleLower.includes('dragon ball') && titleLower.match(/\bz\b/))) return 1989;
    if (titleLower.includes('dragon ball') || titleLower.includes('original')) {
        if (!titleLower.includes('daima') && !titleLower.includes('super') && !titleLower.includes('gt') && !titleLower.includes('kai') && !titleLower.match(/\bz\b/)) {
            return 1986;
        }
    }

    if (startDate) {
        const match = startDate.match(/^(\d{4})/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > 1900) {
                return parsed;
            }
        }
    }

    if (mediaYear && mediaYear > 0) {
        return mediaYear;
    }

    return 'N/A';
}
