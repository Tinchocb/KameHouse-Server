
/**
 * Checks if a given ID represents a TMDB ID (usually >= 1,000,000 in KameHouse system).
 */
export function isTmdbId(id?: number | null): boolean {
    if (id == null) return false
    return id >= 1000000
}
