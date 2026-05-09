import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useState, useMemo } from "react"
import { useDebounce } from "react-use"

export function useGlobalSearch() {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    const { data: collection, isLoading } = useGetLibraryCollection()

    useDebounce(
        () => {
            setDebouncedQuery(query)
        },
        500,
        [query],
    )

    const isSearchActive = debouncedQuery.length > 2

    const allEntries = useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries || [])
    }, [collection])

    const results = useMemo(() => {
        if (!isSearchActive) {
            // Return some "recent" or just first 10 if not searching
            return allEntries.slice(0, 10)
        }
        
        const q = debouncedQuery.toLowerCase()
        return allEntries
            .filter(entry => {
                const media = entry.media
                const title = media 
                    ? `${media.titleRomaji || ""} ${media.titleEnglish || ""} ${media.titleOriginal || ""}`.toLowerCase()
                    : `desconocido ${entry.mediaId}`
                
                return title.includes(q)
            })
            .slice(0, 10)
    }, [allEntries, debouncedQuery, isSearchActive])

    return {
        query,
        setQuery,
        results,
        isLoading,
        isSearchActive,
    }
}
