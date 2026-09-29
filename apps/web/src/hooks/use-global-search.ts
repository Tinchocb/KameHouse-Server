import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetUnlinkedFiles } from "@/api/hooks/unlinked.hooks"
import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { IntelligentEntry } from "@/api/types/intelligence.types"
import { useState, useMemo, useEffect } from "react"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import type { VolumeData } from "@/components/chronology/types"

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

export type GlobalSearchResultItem =
    | {
          mediaId: string | number
          isUnlinked?: false
          isSemantic?: false
          isChronology?: false
          semanticData?: never
          badgeLabel?: string
          path?: string
          media?: {
              titleRomaji?: string
              titleEnglish?: string
              titleOriginal?: string
              titleSpanish?: string
              year?: string | number
              format?: string
              posterImage?: string
              description?: string
              score?: number
          } | null
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
          media: {
              titleRomaji: string
              titleEnglish: string
              titleOriginal: string
              titleSpanish?: string
              year: string | number
              format: string
              posterImage: string
              description?: string
              score?: number
          }
          vibes?: string[]
          [key: string]: unknown
      }
    | {
          mediaId: string
          isSemantic: true
          isUnlinked?: false
          isChronology?: false
          semanticData: SemanticSearchResult["entity"]
          media: {
              titleRomaji: string
              titleEnglish: string
              titleOriginal: string
              titleSpanish?: string
              year: string | number
              format: string
              posterImage: string
              description: string
          }
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
          badgeLabel: "CRONOLOGÍA"
          media: {
              titleRomaji: string
              titleEnglish: string
              titleOriginal: string
              titleSpanish: string
              year: string
              format: "CRONOLOGÍA"
              posterImage: string
              description?: string
          }
          [key: string]: unknown
      }

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

    const isSearchActive = debouncedQuery.length >= 2
    // La paleta usa prefijo ">" para comandos: no disparar búsqueda semántica.
    const isSemanticEnabled = isSearchActive && !debouncedQuery.startsWith(">")

    // Semantic intelligence search query
    const { data: semanticResults, isLoading: isLoadingSemantic } = useServerQuery<SemanticSearchResult[], { q: string }>({
        endpoint: API_ENDPOINTS.INTELLIGENCE.SemanticSearch.endpoint,
        method: "GET",
        params: { q: debouncedQuery },
        queryKey: [API_ENDPOINTS.INTELLIGENCE.SemanticSearch.key, debouncedQuery],
        staleTime: 60000,
        enabled: isSemanticEnabled,
        muteError: true,
    })

    const isLoading = isLoadingCol || isLoadingUnlinked || (isSemanticEnabled && isLoadingSemantic)

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
        if (!isSearchActive) {
            const combined: GlobalSearchResultItem[] = [...allEntries, ...syntheticUnlinked]
            return combined.slice(0, 10)
        }

        const q = debouncedQuery.toLowerCase().trim()

        const chronologyMatches: GlobalSearchResultItem[] = []
        if (isSearchActive) {
            const directMatches: GlobalSearchResultItem[] = []
            const secondaryMatches: GlobalSearchResultItem[] = []

            for (const vol of volumes ?? []) {
                const title = vol.title.toLowerCase()
                const subtitle = (vol.subtitle ?? "").toLowerCase()
                const sagaLabel = (vol.sagaLabel ?? "").toLowerCase()
                const sagaId = (vol.sagaId ?? "").toLowerCase()
                const volNum = vol.volumeNumber.toLowerCase()
                const seriesTag = vol.seriesTag.toLowerCase()
                const inYears = (vol.officialYear ?? "").toLowerCase()

                const isDirect =
                    title.includes(q) ||
                    subtitle.includes(q) ||
                    sagaLabel.includes(q) ||
                    sagaId.includes(q) ||
                    volNum.includes(q) ||
                    seriesTag.includes(q) ||
                    inYears.includes(q)

                const isSecondary =
                    !isDirect &&
                    (vol.characters?.some((c) => c.toLowerCase().includes(q)) ||
                        vol.narrative?.climax?.decisiveBattle?.toLowerCase().includes(q) ||
                        vol.narrative?.detonante?.title?.toLowerCase().includes(q))

                if (isDirect || isSecondary) {
                    const item: GlobalSearchResultItem = {
                        mediaId: `chrono-${vol.id}`,
                        isChronology: true,
                        isUnlinked: false,
                        isSemantic: false,
                        volumeId: vol.id,
                        era: vol.seriesTag,
                        badgeLabel: "CRONOLOGÍA",
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
                    }
                    if (isDirect) {
                        directMatches.push(item)
                    } else {
                        secondaryMatches.push(item)
                    }
                }
            }

            chronologyMatches.push(...directMatches, ...secondaryMatches)
        }
        
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
    }, [allEntries, syntheticUnlinked, semanticResults, debouncedQuery, isSearchActive, volumes])

    return {
        query,
        setQuery,
        results,
        isLoading,
        isSearchActive,
    }
}


