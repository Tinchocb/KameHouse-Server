import { useQuery } from "@tanstack/react-query"
import { buildSeaQuery } from "@/api/client/requests"

export interface TorrentioStreamResult {
    name: string
    title: string
    infoHash: string
    fileIdx: number
    quality: string
    releaseGroup: string
    filename: string
    seeders?: number
    magnetUri?: string
}

export const torrentioKeys = {
    all: ["torrentio"] as const,
    streams: (kitsuId: number, episode: number) => [...torrentioKeys.all, "streams", kitsuId, episode] as const,
}

/**
 * Hook to fetch torrentio streams for a specific episode.
 */
export function useGetTorrentioStreams(kitsuId: number | undefined, episode: number | undefined) {
    return useQuery({
        queryKey: torrentioKeys.streams(kitsuId!, episode!),
        queryFn: () => buildSeaQuery<TorrentioStreamResult[]>({
            endpoint: "/api/v1/torrentio/streams",
            method: "GET",
            params: { kitsuId, episode } as any,
        }) as Promise<TorrentioStreamResult[]>,
        enabled: !!kitsuId && !!episode,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
