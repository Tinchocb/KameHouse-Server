import { useServerQuery, buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { ChronologyEpisodeFile } from "@/api/generated/types"
import { buildVideoThumbnailUrl } from "@/lib/helpers/images"
import { TMDB_ID_BY_SERIES_SLUG } from "@/components/chronology/data/episodeMapping"

export interface LibraryEpisodeFileResponse {
    path: string
    hasImage: boolean
    absoluteEpisode: number
    title?: string
    sagaName?: string
    /** Solo cuando hasImage=false: versionan la URL del frame (`v`). */
    fileModTime?: number
    fileSize?: number
}

/** Series de Dragon Ball de la cronología: sus episodios se resuelven en un solo pedido. */
const CHRONOLOGY_TMDB_IDS = [...new Set(Object.values(TMDB_ID_BY_SERIES_SLUG))].sort((a, b) => a - b)
const CHRONOLOGY_TMDB_ID_SET = new Set(CHRONOLOGY_TMDB_IDS)

export const CHRONOLOGY_EPISODE_FILES_QUERY_KEY = [
    API_ENDPOINTS.CHRONOLOGY_FRAMES.GetChronologyEpisodeFiles.key,
    CHRONOLOGY_TMDB_IDS.join(","),
]
const EPISODE_FILES_STALE_MS = 24 * 60 * 60 * 1000

export const fetchChronologyEpisodeFiles = async () => {
    return buildSeaQuery<ChronologyEpisodeFile[], { tmdbIds: string }>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetChronologyEpisodeFiles.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetChronologyEpisodeFiles.methods[0],
        params: { tmdbIds: CHRONOLOGY_TMDB_IDS.join(",") },
    })
}

export const chronologyEpisodeFilesQueryOptions = {
    queryKey: CHRONOLOGY_EPISODE_FILES_QUERY_KEY,
    queryFn: fetchChronologyEpisodeFiles,
    staleTime: EPISODE_FILES_STALE_MS,
}

// Índice "tmdbId:episodio" por respuesta: cada miniatura busca en O(1) sin rearmarlo.
const indexCache = new WeakMap<ChronologyEpisodeFile[], Map<string, ChronologyEpisodeFile>>()
function indexEpisodeFiles(files: ChronologyEpisodeFile[]) {
    let index = indexCache.get(files)
    if (!index) {
        index = new Map(files.map((f) => [`${f.tmdbId}:${f.absoluteEpisode}`, f]))
        indexCache.set(files, index)
    }
    return index
}

/**
 * Obtiene el path del archivo local o la imagen ya extraída para un episodio
 * de la biblioteca local, dado su TMDB ID y número absoluto.
 *
 * Las series de la cronología comparten una sola consulta con todos sus episodios
 * (antes era un pedido por miniatura, cientos al abrir la página); cualquier otra
 * serie usa el endpoint por episodio.
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
    startSec?: number | null,
) {
    const valid = typeof tmdbId === "number" && tmdbId > 0 && typeof absoluteEpisode === "number" && absoluteEpisode > 0
    const batched = valid && CHRONOLOGY_TMDB_ID_SET.has(tmdbId)

    const batch = useServerQuery<ChronologyEpisodeFile[], { tmdbIds: string }, LibraryEpisodeFileResponse | null>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetChronologyEpisodeFiles.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetChronologyEpisodeFiles.methods[0],
        params: { tmdbIds: CHRONOLOGY_TMDB_IDS.join(",") },
        queryKey: CHRONOLOGY_EPISODE_FILES_QUERY_KEY,
        enabled: batched,
        staleTime: EPISODE_FILES_STALE_MS,
        muteError: true,
        select: (files) => (files ? indexEpisodeFiles(files).get(`${tmdbId}:${absoluteEpisode}`) ?? null : null),
    })

    const single = useServerQuery<LibraryEpisodeFileResponse, { tmdbId: number | undefined | null; absoluteEpisode: number | undefined | null }>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.methods[0],
        params: { tmdbId, absoluteEpisode },
        queryKey: [API_ENDPOINTS.CHRONOLOGY_FRAMES.GetLibraryEpisodeFile.key, tmdbId, absoluteEpisode],
        enabled: valid && !batched,
        staleTime: EPISODE_FILES_STALE_MS,
        muteError: true,
    })

    const d = (batched ? batch.data : single.data) ?? undefined
    const isFetched = batched ? batch.isFetched : single.isFetched
    // Con imagen del episodio (still de TMDB guardado en la biblioteca) se usa esa: `path` es
    // una URL de imagen, no un video, y pedirle un frame a ffmpeg solo daba error.
    const isExactFrame = Boolean(d?.path) && !d?.hasImage
    const thumbnailUrl = d?.hasImage ? d.path : d?.path ? buildVideoThumbnailUrl(d, { startSec }) : undefined

    return {
        thumbnailUrl,
        /** thumbnailUrl es un frame del archivo en el segundo pedido (no una imagen fija del episodio). */
        isExactFrame,
        /** La consulta terminó (con o sin archivo), o no aplica para este episodio. */
        settled: !valid || isFetched,
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
