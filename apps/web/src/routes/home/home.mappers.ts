import type {
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
 * Maps an episode and its media to SwimlaneItem (Continue Watching).
 */
export function mapEpisodeToMediaCard(
    episode: Anime_Episode,
    media: Models_LibraryMedia,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    return {
        id: `cw-${media.id}`,
        image: episode.episodeMetadata?.image || getBackdrop(media) || "",
        title: getTitle(media),
        subtitle: episode.displayTitle || `Episodio ${episode.episodeNumber}`,
        badge: media.format,
        description: episode.episodeMetadata?.summary || media.description,
        progress: getProgress(media.id, watchHistory),
        aspect: "wide",
        year: media.year || undefined,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        onClick: () => onNavigate(media.id),
        backdropUrl: getBackdrop(media) || undefined,
    }
}

/**
 * Maps a library entry to SwimlaneItem.
 */
export function mapLibraryEntryToMediaCard(
    entry: Anime_LibraryCollectionEntry | IntelligentEntry,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    const media = entry.media!
    return {
        id: `media-${media.id}`,
        image: media.posterImage || getBackdrop(media) || "",
        title: getTitle(media),
        subtitle: `${media.year || ""} · ${media.format || ""}`,
        badge: media.format,
        description: media.description,
        aspect: "poster",
        year: media.year || undefined,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        onClick: () => onNavigate(media.id),
        backdropUrl: getBackdrop(media) || undefined,
    }
}

/**
 * Maps an entry to HeroBannerItem.
 */
export function mapToHeroItem(
    media: Models_LibraryMedia,
    onNavigate: (mediaId: number) => void,
    synopsis?: string,
): HeroBannerItem {
    return {
        id: `hero-${media.id}`,
        title: getTitle(media),
        synopsis: synopsis || media.description || "",
        backdropUrl: getBackdrop(media) || "",
        posterUrl: media.posterImage,
        year: media.year || undefined,
        format: media.format,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        mediaId: media.id,
        onPlay: () => onNavigate(media.id),
        onMoreInfo: () => onNavigate(media.id),
    }
}
