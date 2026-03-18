import { Platform_UnifiedMedia, Platform_UnifiedCollectionEntry, Nullish } from "@/api/generated/types"

export function media_getTotalEpisodes(media: Nullish<Platform_UnifiedMedia>) {
    if (!media) return -1
    let maxEp = media?.episodes ?? -1
    if (maxEp === -1) {
        if (media.nextAiringEpisode && media.nextAiringEpisode.episode) {
            maxEp = media.nextAiringEpisode.episode - 1
        }
    }
    if (maxEp === -1) {
        return 0
    }
    return maxEp
}

export function media_getCurrentEpisodes(media: Nullish<Platform_UnifiedMedia>) {
    if (!media) return -1
    let maxEp = -1
    if (media.nextAiringEpisode && media.nextAiringEpisode.episode) {
        maxEp = media.nextAiringEpisode.episode - 1
    }
    if (maxEp === -1) {
        maxEp = media.episodes ?? 0
    }
    return maxEp
}

export function media_getListDataFromEntry(entry: Nullish<Platform_UnifiedCollectionEntry>) {
    return {
        progress: entry?.progress,
        score: entry?.score,
        status: entry?.status,
        startedAt: new Date(entry?.startedAt?.year || 0,
            entry?.startedAt?.month ? entry?.startedAt?.month - 1 : 0,
            entry?.startedAt?.day || 0).toUTCString(),
        completedAt: new Date(entry?.completedAt?.year || 0,
            entry?.completedAt?.month ? entry?.completedAt?.month - 1 : 0,
            entry?.completedAt?.day || 0).toUTCString(),
    }
}


export function media_isMovie(media: Nullish<Platform_UnifiedMedia>) {
    if (!media) return false
    return media?.format === "MOVIE"

}

export function media_isSingleEpisode(media: Nullish<Platform_UnifiedMedia>) {
    if (!media) return false
    return media?.format === "MOVIE" || media?.episodes === 1
}


export function media_getUnwatchedCount(media: Nullish<Platform_UnifiedMedia>, progress: Nullish<number>) {
    if (!media) return 0
    const maxEp = media_getCurrentEpisodes(media)
    return maxEp - (progress ?? 0)
}

