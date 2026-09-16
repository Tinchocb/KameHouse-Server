import { useMemo } from "react"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { indexEntriesByTmdb, type StageCollectionEntry } from "@/lib/config/dragonball_stages"
import { DRAGON_BALL_STORY_SPANS } from "@/lib/config/dragonball_story_spans"
import { getSpanDefaultArt, type SpanStill } from "@/components/chronology/CinematicChronologyTimeline"
import { getServerBaseUrl } from "@/api/client/server-url"

// Misma plomería de datos que el modal de cronología (mapa por TMDB +
// still real del episodio si está descargado, si no arte editorial).
export function useChronologyData() {
    const { data: libraryCollection, isLoading } = useGetLibraryCollection()

    const tmdbMap = useMemo(() => {
        if (!libraryCollection?.lists) return new Map<number, StageCollectionEntry>()
        const allEntries = libraryCollection.lists.flatMap((list) => list.entries || [])
        return indexEntriesByTmdb(allEntries as unknown as StageCollectionEntry[])
    }, [libraryCollection])

    const stills = useMemo(() => {
        const map = new Map<string, SpanStill>()
        const cw = libraryCollection?.continueWatchingList ?? []
        const serverBase = typeof window !== "undefined" ? getServerBaseUrl() || window.location.origin : ""
        for (const span of DRAGON_BALL_STORY_SPANS) {
            const entry = tmdbMap.get(span.tmdbId)
            const downloaded = !!entry?.mediaId
            const ep = cw.find(
                (e) =>
                    (e.baseAnime?.tmdbId === span.tmdbId || e.baseAnime?.id === entry?.mediaId) &&
                    e.absoluteEpisodeNumber >= span.startEpisode &&
                    e.absoluteEpisodeNumber <= span.endEpisode &&
                    (e.episodeMetadata?.image || (e.isDownloaded && e.localFile?.path))
            )
            if (ep) {
                const url = ep.episodeMetadata?.image
                    ? ep.episodeMetadata.image
                    : `${serverBase}/api/v1/video-thumbnail?path=${encodeURIComponent(ep.localFile?.path ?? "")}`
                map.set(span.id, {
                    src: url,
                    isEpisode: true,
                    downloaded: true,
                    episodeLabel: `Still EP ${ep.absoluteEpisodeNumber}`,
                })
            } else {
                map.set(span.id, {
                    src: getSpanDefaultArt(span.id, span.seriesId),
                    isEpisode: false,
                    downloaded,
                })
            }
        }
        return map
    }, [libraryCollection, tmdbMap])

    return { libraryCollection, isLoading, tmdbMap, stills }
}
