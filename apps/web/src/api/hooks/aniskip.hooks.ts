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
import { buildSeaQuery } from "@/api/client/requests"

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
    /** Local Media ID */
    mediaId?: number | null
}

export interface AniSkipTimes {
    /** Intro / Opening timestamps */
    op?: AniSkipInterval
    /** Outro / Ending timestamps */
    ed?: AniSkipInterval
    /** Whether any skip times were found */
    hasSkipTimes: boolean
}

interface LocalSkipTimeResponse {
    id: number
    mediaId: number
    episodeNumber: number
    opStart: number
    opEnd: number
    edOffset: number
}

export async function getAniSkipTimes({
    malId,
    mediaId,
    episodeNumber,
    episodeDuration,
}: {
    malId?: number | null
    mediaId?: number | null
    episodeNumber: number
    episodeDuration?: number
}): Promise<AniSkipTimes> {
    if ((!malId && !mediaId) || !episodeNumber) {
        return { hasSkipTimes: false }
    }

    // 1. Try local KameHouse server database first
    try {
        const localData = await buildSeaQuery<LocalSkipTimeResponse, any>({
            endpoint: "/api/v1/mediastream/skip-times",
            method: "GET",
            params: {
                mediaId: mediaId || undefined,
                malId: malId || undefined,
                episodeNumber,
            }
        })

        if (localData) {
            const op = localData.opStart > 0 || localData.opEnd > 0 ? {
                startTime: localData.opStart,
                endTime: localData.opEnd,
            } : undefined

            let ed: AniSkipInterval | undefined = undefined
            if (localData.edOffset > 0 && episodeDuration && episodeDuration > 0) {
                ed = {
                    startTime: episodeDuration - localData.edOffset,
                    endTime: episodeDuration,
                }
            }

            if (op || ed) {
                return {
                    op,
                    ed,
                    hasSkipTimes: true,
                }
            }
        }
    } catch (e) {
        console.warn("Failed to check local skip times:", e)
    }

    // 2. Fallback to AniSkip API
    if (!malId) {
        return { hasSkipTimes: false }
    }

    const data = await fetchAniSkipTimes(malId, episodeNumber, episodeDuration)

    if (!data.found || !data.results?.length) {
        return { hasSkipTimes: false }
    }

    const opResult = data.results.find(r => r.skipType === "op" || r.skipType === "mixed-op")
    const edResult = data.results.find(r => r.skipType === "ed" || r.skipType === "mixed-ed")

    const op = opResult?.interval
    const ed = edResult?.interval

    // 3. Cache AniSkip times on our local server as a side-effect
    if (op || ed) {
        let resolvedEdOffset = 0
        if (ed && episodeDuration && episodeDuration > 0) {
            resolvedEdOffset = Math.max(0, episodeDuration - ed.startTime)
        }

        buildSeaQuery<any, any>({
            endpoint: "/api/v1/mediastream/skip-times",
            method: "POST",
            data: {
                mediaId: mediaId || undefined,
                malId: malId || undefined,
                episodeNumber,
                opStart: op?.startTime ?? 0,
                opEnd: op?.endTime ?? 0,
                edOffset: resolvedEdOffset,
                applyToSeason: false,
            }
        }).catch(err => console.warn("Failed to cache AniSkip times in KameHouse:", err))
    }

    return {
        op,
        ed,
        hasSkipTimes: !!(op || ed),
    }
}

export function useAniSkipTimes({
    malId,
    episodeNumber,
    episodeDuration,
    enabled = true,
    mediaId,
}: UseAniSkipTimesOptions) {
    return useQuery<AniSkipTimes>({
        queryKey: ["aniskip", malId, mediaId, episodeNumber, Math.round((episodeDuration ?? 0) / 30)],
        queryFn: () => getAniSkipTimes({
            malId,
            mediaId,
            episodeNumber: episodeNumber!,
            episodeDuration,
        }),
        enabled: enabled && !!(malId || mediaId) && !!episodeNumber,
        staleTime: 1000 * 60 * 60 * 24, // Cache for 24h
        retry: 1,
        refetchOnWindowFocus: false,
    })
}
