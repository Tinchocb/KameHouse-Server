import { useServerQuery, buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LibraryCollection, Anime_LibraryCollectionEntry } from "@/api/generated/types"

export interface ExtendedMediaEntry extends Anime_LibraryCollectionEntry {
    customReleaseGroup?: string
    customVersion?: string
    isCustomOverride?: boolean
}

export interface ExtendedLibraryCollection extends Omit<Anime_LibraryCollection, "lists"> {
    lists?: Array<{
        type: string
        status: string
        entries?: Array<ExtendedMediaEntry>
    }>
}

export const fetchLibraryCollection = async () => {
    return buildSeaQuery<Anime_LibraryCollection>({
        endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
        method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[0],
    })
}

export function useGetLibraryCollection({ enabled }: { enabled?: boolean } = { enabled: true }) {
    return useServerQuery<Anime_LibraryCollection, void, ExtendedLibraryCollection>({
        endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
        method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[0],
        queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
        enabled: enabled,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
        select: (data: Anime_LibraryCollection | undefined): ExtendedLibraryCollection => {
            const start = performance.now()
            if (!data) return {} as ExtendedLibraryCollection;
            const result = {
                ...data,
                lists: data.lists?.map(list => ({
                    ...list,
                    entries: list.entries?.map(entry => {
                        return {
                            ...entry,
                            customReleaseGroup: entry.mediaId === 6033 ? "Seldion Fan-Edit" : undefined,
                            isCustomOverride: entry.mediaId === 6033 || entry.mediaId === 534
                        }
                    }).sort((a, b) => (a.media?.titleRomaji || "").localeCompare(b.media?.titleRomaji || ""))
                }))
            }
            // #region agent log
            fetch('http://127.0.0.1:7902/ingest/3db04ea9-77c9-4bed-a20f-e86e950dde6c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'549c87'},body:JSON.stringify({sessionId:'549c87',location:'anime_collection.hooks.ts:select',message:'library select transform',data:{durationMs:Math.round(performance.now()-start),entryCount:data.lists?.reduce((n,l)=>n+(l.entries?.length??0),0)??0,hypothesisId:'E'},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return result
        }
    })
}



