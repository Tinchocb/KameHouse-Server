/**
 * AniSkip API hook
 * Fetches community-sourced skip times (OP/ED) for anime episodes.
 * API docs: https://api.aniskip.com/v2
 *
 * Strategy: KameHouse uses Platform IDs (AniList). AniSkip requires MAL IDs.
 * We use `idMal` from `Platform_BaseAnime` if available.
 * If not available, we fall back to undefined (no skip times).
 */

import { useQuery } from "@tanstack/react-query"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AniSkipType = "op" | "ed" | "mixed-ed" | "mixed-op" | "recap"

export interface AniSkipInterval {
    startTime: number
    endTime: number
}

export interface AniSkipResult {
    interval: AniSkipInterval
    skipType: AniSkipType
    episodeLength: number
}

export interface AniSkipResponse {
    found: boolean
    results?: AniSkipResult[]
    statusCode: number
    message?: string
    error?: string
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchAniSkipTimes(
    malId: number,
    episodeNumber: number,
    episodeDuration?: number,
): Promise<AniSkipResponse> {
    const types = ["op", "ed"].join("&types[]=")
    let url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=${types}`

    // If we have a known episode duration, pass it for better matching
    if (episodeDuration && episodeDuration > 0) {
        url += `&episodeLength=${Math.round(episodeDuration)}`
    }

    const res = await fetch(url)

    if (!res.ok) {
        // AniSkip returns 404 when no skip times found — that is not a real error
        if (res.status === 404) {
            return { found: false, statusCode: 404 } as AniSkipResponse
        }
        throw new Error(`AniSkip API error: ${res.status}`)
    }

    return res.json() as Promise<AniSkipResponse>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAniSkipTimesOptions {
    /** MAL (MyAnimeList) ID — required for AniSkip queries */
    malId?: number | null
    /** 1-indexed episode number */
    episodeNumber?: number | null
    /** Duration of the video in seconds (optional, improves accuracy) */
    episodeDuration?: number
    /** Set to false to disable fetching */
    enabled?: boolean
}

export interface AniSkipTimes {
    /** Intro / Opening timestamps */
    op?: AniSkipInterval
    /** Outro / Ending timestamps */
    ed?: AniSkipInterval
    /** Whether any skip times were found */
    hasSkipTimes: boolean
}

export function useAniSkipTimes({
    malId,
    episodeNumber,
    episodeDuration,
    enabled = true,
}: UseAniSkipTimesOptions) {
    return useQuery<AniSkipTimes>({
        queryKey: ["aniskip", malId, episodeNumber, Math.round((episodeDuration ?? 0) / 30)],
        queryFn: async (): Promise<AniSkipTimes> => {
            if (!malId || !episodeNumber) {
                return { hasSkipTimes: false }
            }

            const data = await fetchAniSkipTimes(malId, episodeNumber, episodeDuration)

            if (!data.found || !data.results?.length) {
                return { hasSkipTimes: false }
            }

            const op = data.results.find(r => r.skipType === "op" || r.skipType === "mixed-op")
            const ed = data.results.find(r => r.skipType === "ed" || r.skipType === "mixed-ed")

            return {
                op: op?.interval,
                ed: ed?.interval,
                hasSkipTimes: !!(op || ed),
            }
        },
        enabled: enabled && !!malId && !!episodeNumber,
        staleTime: 1000 * 60 * 60 * 24, // Cache for 24h — skip times don't change
        retry: 1,
        refetchOnWindowFocus: false,
    })
}
