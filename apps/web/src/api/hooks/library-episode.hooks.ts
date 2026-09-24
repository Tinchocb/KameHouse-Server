import { useServerQuery } from "@/api/client/requests"
import { getServerBaseUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export interface LibraryEpisodeFileResponse {
    path: string
    hasImage: boolean
    absoluteEpisode: number
    title?: string
    sagaName?: string
}

/**
 * Obtiene el path del archivo local o la imagen ya extraída para un episodio
 * de la biblioteca local, dado su TMDB ID y número absoluto.
 *
 * Usado como fallback 2 (frame local) en EpisodeThumbnailImg:
 * 1. Local curado (/episodes/<slug>/<abs>.webp)
 * 2. TMDB still
 * 3. **Local file frame** (este hook → THUMBNAIL.GetVideoThumbnail)
 * 4. AniList streaming
 * 5. Saga fallback
 */
export function useGetLibraryEpisodeFile(
    tmdbId: number | undefined | null,
    absoluteEpisode: number | undefined | null,
) {
    const valid = typeof tmdbId === "number" && tmdbId > 0 && typeof absoluteEpisode === "number" && absoluteEpisode > 0
    const base = getServerBaseUrl()

    const { data } = useServerQuery<LibraryEpisodeFileResponse, { tmdbId: number | undefined | null; absoluteEpisode: number | undefined | null }>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.methods[0],
        params: { tmdbId, absoluteEpisode },
        queryKey: [API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.key, tmdbId, absoluteEpisode],
        enabled: Boolean(valid),
        staleTime: 24 * 60 * 60 * 1000, // 24h caché
        muteError: true,
    })

    const d = data as LibraryEpisodeFileResponse | undefined
    const thumbnailUrl = d?.hasImage
        ? d.path // Already extracted thumbnail
        : d?.path
            ? `${base}${API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.endpoint}?path=${encodeURIComponent(d.path)}`
            : undefined

    return {
        thumbnailUrl,
        source: d?.hasImage ? "library" : "local-file",
        episode: d
            ? {
                  absoluteEpisode: d.absoluteEpisode,
                  title: d.title,
                  sagaName: d.sagaName,
              }
            : undefined,
    }
}