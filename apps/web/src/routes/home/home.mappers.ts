    Anime_Episode,
    Anime_LibraryCollectionEntry,
    Continuity_WatchHistory,
    Models_LibraryMedia,
} from "@/api/generated/types"
import type { HeroBannerItem } from "@/components/ui/hero-banner"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { IntelligentEntry } from "@/hooks/use-home-intelligence"
import { getTitle, getProgress, getBackdrop } from "./home.helpers"

/**
 * Maps an episode and its media to a SwimlaneItem (Continue Watching).
 */
export function mapEpisodeToSwimlaneItem(
    episode: Anime_Episode,
    media: Models_LibraryMedia,
    availabilityType: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE" | undefined,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    return {
        id: `continue-${media.id}-${episode.episodeNumber}`,
        title: getTitle(media),
        image: episode.episodeMetadata?.image || getBackdrop(media),
        subtitle: episode.displayTitle || `Episodio ${episode.episodeNumber}`,
        badge: media.format,
        availabilityType,
        description:
            episode.episodeMetadata?.summary ||
            episode.episodeMetadata?.overview ||
            media.description,
        progress: getProgress(media.id, watchHistory),
        aspect: "wide",
        year: media.year || undefined,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        onClick: () => onNavigate(media.id),
        backdropUrl: episode.episodeMetadata?.image || getBackdrop(media),
    }
}

/**
 * Maps an intelligent entry to a HeroBannerItem.
 */
export function mapEntryToHeroItem(
    entry: IntelligentEntry,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): HeroBannerItem | null {
    if (!entry.media) return null
    const media = entry.media
    const intel = entry.intelligence
    return {
        id: `hero-entry-${media.id}`,
        title: getTitle(media),
        synopsis: media.description,
        backdropUrl: getBackdrop(media),
        posterUrl: media.posterImage,
        year: media.year || undefined,
        format: media.format,
        episodeCount: media.totalEpisodes || undefined,
        progress: getProgress(media.id, watchHistory),
        arcName: intel?.arcName || undefined,
        contentTag: intel?.tag,
        rating: intel?.rating,
        mediaId: media.id,
        trailerUrl: (media as Models_LibraryMedia & { trailer?: { site: string; id: string } }).trailer?.site === "youtube" ? undefined : ((media as Models_LibraryMedia & { trailer?: { site: string; id: string } }).trailer?.id),
        onPlay: () => onNavigate(media.id),
        onMoreInfo: () => onNavigate(media.id),
    }
}

/**
 * Maps a single episode to a HeroBannerItem.
 */
export function mapEpisodeToHeroItem(
    episode: Anime_Episode,
    media: Models_LibraryMedia,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): HeroBannerItem {
    return {
        id: `hero-continue-${media.id}-${episode.episodeNumber}`,
        title: getTitle(media),
        synopsis:
            episode.episodeMetadata?.summary ||
            episode.episodeMetadata?.overview ||
            media.description,
        backdropUrl: episode.episodeMetadata?.image || getBackdrop(media),
        posterUrl: media.posterImage,
        year: media.year || undefined,
        format: media.format,
        episodeCount: media.totalEpisodes || undefined,
        progress: getProgress(media.id, watchHistory),
        mediaId: media.id,
        trailerUrl: (media as Models_LibraryMedia & { trailer?: { site: string; id: string } }).trailer?.site === "youtube" ? undefined : ((media as Models_LibraryMedia & { trailer?: { site: string; id: string } }).trailer?.id),
        onPlay: () => onNavigate(media.id),
        onMoreInfo: () => onNavigate(media.id),
    }
}
/**
 * Maps a library collection entry to a SwimlaneItem.
 */
export function mapLibraryEntryToSwimlaneItem(
    entry: Anime_LibraryCollectionEntry,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    const media = entry.media!
    return {
        id: `lib-entry-${media.id}`,
        title: getTitle(media),
        image: media.posterImage || "",
        subtitle: `${media.year || ""} · ${media.format || ""}`,
        badge: media.format,
        availabilityType: entry.availabilityType as any,
        description: media.description,
        aspect: "poster",
        year: media.year || undefined,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        onClick: () => onNavigate(media.id),
        backdropUrl: getBackdrop(media),
    }
}
