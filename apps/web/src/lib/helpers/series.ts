interface MediaForSeriesId {
    tmdbId?: number | null
    titleRomaji?: string | null
    titleEnglish?: string | null
    titleOriginal?: string | null
}

const TMDB_SERIES_MAP: Record<number, string> = {
    12609: "dragon_ball",
    12971: "dragon_ball_z",
    12697: "dragon_ball_gt",
    62715: "dragon_ball_super",
    236994: "dragon_ball_daima",
}

const TITLE_SERIES_MAP: [RegExp, string][] = [
    [/dragonballz|^dbz$/, "dragon_ball_z"],
    [/dragonballgt/, "dragon_ball_gt"],
    [/dragonballsuper/, "dragon_ball_super"],
    [/dragonballdaima/, "dragon_ball_daima"],
    [/^dragonball$/, "dragon_ball"],
]

/**
 * Maps a media object to a Dragon Ball series ID string.
 * Used for spine config, lore, and character images.
 */
export const getSeriesIdFromMedia = (media: MediaForSeriesId | null | undefined): string => {
    if (!media) return ""
    const tmdbId = media.tmdbId || 0
    const title = (media.titleRomaji || media.titleEnglish || media.titleOriginal || "").toLowerCase().replace(/\s+/g, "")

    if (TMDB_SERIES_MAP[tmdbId]) return TMDB_SERIES_MAP[tmdbId]

    for (const [pattern, seriesId] of TITLE_SERIES_MAP) {
        if (pattern.test(title)) return seriesId
    }
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
