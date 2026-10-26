import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetUnlinkedFiles } from "@/api/hooks/unlinked.hooks"
import { useServerQuery } from "@/api/client/requests"
import { keepPreviousData } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { IntelligentEntry } from "@/api/types/intelligence.types"
import { useState, useMemo, useEffect } from "react"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import type { VolumeData } from "@/components/chronology/types"
import { searchTimeline } from "@/components/chronology/data/timelineSearch"

// Los volúmenes de la Cronología (historias, lore y spans: ~300 KB) se cargan
// recién cuando se usa el buscador. Importados arriba viajaban en el JS inicial
// de TODAS las pantallas, porque el buscador vive en la barra de navegación.
let volumesCache: VolumeData[] | null = null
let volumesPromise: Promise<VolumeData[]> | null = null
function loadVolumes(): Promise<VolumeData[]> {
    volumesPromise ??= import("@/components/chronology/data/volumes").then((m) => (volumesCache = m.VOLUMES_DATA))
    return volumesPromise
}

interface SemanticSearchResult {
    entity: {
        id: string
        name: string
        type: "CHARACTER" | "TRANSFORMATION" | "SAGA" | "MOVIE" | "TECHNIQUE"
        keywords: string[]
        mediaId: number
        tmdbId: number
        mediaType: "SHOW" | "MOVIE"
        era: string
        description: string
        episodes?: string
        badgeLabel: string
    }
    score: number
    matchLabel: string
}

interface SearchResultMedia {
    titleRomaji: string
    titleEnglish: string
    titleOriginal: string
    titleSpanish?: string
    year?: string | number
    format?: string
    posterImage?: string
    description?: string
    score?: number
    totalEpisodes?: number
}

export type GlobalSearchResultItem =
    | {
          mediaId: string | number
          isUnlinked?: false
          isSemantic?: false
          isChronology?: false
          semanticData?: never
          badgeLabel?: string
          path?: string
          media?: SearchResultMedia | null
          vibes?: string[] | null
          [key: string]: unknown
      }
    | {
          mediaId: string
          isUnlinked: true
          isSemantic?: false
          isChronology?: false
          semanticData?: never
          badgeLabel?: string
          path: string
          media: SearchResultMedia
          vibes?: string[]
          [key: string]: unknown
      }
    | {
          mediaId: string
          isSemantic: true
          isUnlinked?: false
          isChronology?: false
          semanticData: SemanticSearchResult["entity"]
          media: SearchResultMedia
          badgeLabel: string
          [key: string]: unknown
      }
    | {
          mediaId: string
          isChronology: true
          isUnlinked?: false
          isSemantic?: false
          volumeId: string
          era?: string
          /** Por qué coincidió ("Personaje", "Esferas"…) y el fragmento donde aparece. */
          matchLabel?: string
          matchSnippet?: string
          badgeLabel: "CRONOLOGÍA"
          media: SearchResultMedia
          [key: string]: unknown
      }

/** Resultados que muestra el modo «@» (en el modo normal la cronología aporta 4). */
const CHRONO_MODE_LIMIT = 20

export function useGlobalSearch(enabled = true) {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    const { data: collection, isLoading: isLoadingCol } = useGetLibraryCollection({ enabled })
    const { data: unlinkedFiles, isLoading: isLoadingUnlinked } = useGetUnlinkedFiles({ enabled })

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(t)
    }, [query])

    const [volumes, setVolumes] = useState<VolumeData[] | null>(volumesCache)
    useEffect(() => {
        if (!enabled || volumes) return
        let cancelled = false
        loadVolumes().then((v) => { if (!cancelled) setVolumes(v) }).catch(() => {})
        return () => { cancelled = true }
    }, [enabled, volumes])

    // Prefijo «@»: busca solo en la cronología (personaje, saga, esferas, lapso…).
    const isChronoMode = debouncedQuery.startsWith("@")
    const chronoQuery = isChronoMode ? debouncedQuery.slice(1).trim() : ""
    const isSearchActive = isChronoMode ? chronoQuery.length >= 1 : debouncedQuery.length >= 2
    // La paleta usa prefijo ">" para comandos: no disparar búsqueda semántica.
    const isSemanticEnabled = isSearchActive && !isChronoMode && !debouncedQuery.startsWith(">")

    // Semantic intelligence search query
    const { data: semanticResults, isLoading: isLoadingSemantic } = useServerQuery<SemanticSearchResult[], { q: string }>({
        endpoint: API_ENDPOINTS.INTELLIGENCE.SemanticSearch.endpoint,
        method: "GET",
        params: { q: debouncedQuery },
        queryKey: [API_ENDPOINTS.INTELLIGENCE.SemanticSearch.key, debouncedQuery],
        staleTime: 60000,
        enabled: isSemanticEnabled,
        muteError: true,
        // Mientras llega la consulta nueva se conservan los resultados anteriores: sin esto,
        // cada pausa al escribir volvía a `isLoading` y la paleta cambiaba la lista por el orbe.
        placeholderData: keepPreviousData,
    })

    // En modo «@» solo importan los lapsos (se cargan al abrir el buscador).
    const isLoading = isChronoMode
        ? !volumes
        : isLoadingCol || isLoadingUnlinked || (isSemanticEnabled && isLoadingSemantic)

    const allEntries = useMemo(() => {
        return getSafeCollectionEntries(collection)
    }, [collection])

    const syntheticUnlinked = useMemo(() => {
        if (!unlinkedFiles) return []
        return unlinkedFiles.filter(f => !f.userResolved).map(file => {
            const filename = (file.path ?? "").split(/[\\/]/).pop() || file.path || "Archivo huérfano"
            return {
                mediaId: `unlinked-${file.id}`,
                isUnlinked: true as const,
                unlinkedId: file.id,
                path: file.path,
                media: {
                    titleRomaji: filename,
                    titleEnglish: filename,
                    titleOriginal: filename,
                    year: "LOCAL",
                    format: "ARCHIVO HUÉRFANO",
                    posterImage: "",
                }
            }
        })
    }, [unlinkedFiles])

    const results = useMemo<GlobalSearchResultItem[]>(() => {
        // «@» sin texto todavía: no hay nada que mostrar (la paleta explica qué escribir).
        if (isChronoMode && !isSearchActive) return []

        if (!isSearchActive) {
            const combined: GlobalSearchResultItem[] = [...allEntries, ...syntheticUnlinked]
            return combined.slice(0, 10)
        }

        const q = debouncedQuery.toLowerCase().trim()

        const chronologyMatches: GlobalSearchResultItem[] = []
        const volumeById = new Map((volumes ?? []).map((v) => [v.id, v]))
        for (const hit of searchTimeline(volumes ?? [], isChronoMode ? chronoQuery : q, isChronoMode ? CHRONO_MODE_LIMIT : 4)) {
            const vol = volumeById.get(hit.volumeId)
            if (!vol) continue
            chronologyMatches.push({
                mediaId: `chrono-${vol.id}`,
                isChronology: true,
                isUnlinked: false,
                isSemantic: false,
                volumeId: vol.id,
                era: vol.seriesTag,
                badgeLabel: "CRONOLOGÍA",
                // Si coincidió el título, repetirlo no aporta: se muestra la saga.
                matchLabel: hit.field === "title" && hit.snippet === vol.title ? "Saga" : hit.label,
                matchSnippet: hit.field === "title" && hit.snippet === vol.title ? vol.sagaLabel : hit.snippet,
                media: {
                    titleRomaji: vol.title,
                    titleSpanish: vol.title,
                    titleEnglish: vol.subtitle || vol.sagaLabel,
                    titleOriginal: vol.volumeNumber,
                    year: vol.officialYear,
                    format: "CRONOLOGÍA",
                    posterImage: vol.posterUrl || "",
                    description: vol.subtitle || `${vol.seriesTag} • ${vol.episodesRange}`,
                },
            })
        }

        // Modo «@»: solo la cronología.
        if (isChronoMode) return chronologyMatches

        const semanticConverted: GlobalSearchResultItem[] = (semanticResults || []).map(sr => {
            const ent = sr.entity
            return {
                mediaId: `semantic-${ent.id}-${ent.mediaId}`,
                isSemantic: true as const,
                semanticData: ent,
                media: {
                    titleRomaji: ent.name,
                    titleEnglish: ent.name,
                    titleOriginal: ent.name,
                    year: ent.episodes || ent.era.toUpperCase(),
                    format: ent.badgeLabel,
                    posterImage: "",
                    description: ent.description,
                },
                badgeLabel: ent.badgeLabel,
            }
        })

        const filteredEntries = allEntries.filter(entry => {
            if (!entry) return false
            const e = entry as IntelligentEntry
            const media = e?.media
            const vibes = e.vibes?.join(" ") || ""
            const title = media 
                ? `${media.titleRomaji || ""} ${media.titleEnglish || ""} ${media.titleOriginal || ""} ${media.titleSpanish || ""} ${vibes}`.toLowerCase()
                : `desconocido ${e.mediaId} ${vibes}`
            
            return title.includes(q)
        })

        // Combine: Chronology spans, Semantic lore entities, matching library media entries, unlinked
        const combined: GlobalSearchResultItem[] = [
            ...chronologyMatches.slice(0, 4),
            ...semanticConverted,
            ...filteredEntries,
            ...syntheticUnlinked.filter(u => (u.media?.titleRomaji?.toLowerCase() ?? "").includes(q))
        ]

        return combined.slice(0, 12)
    }, [allEntries, syntheticUnlinked, semanticResults, debouncedQuery, isSearchActive, isChronoMode, chronoQuery, volumes])

    return {
        query,
        setQuery,
        results,
        isLoading,
        isSearchActive,
        isChronoMode,
    }
}


