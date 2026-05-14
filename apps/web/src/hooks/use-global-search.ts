import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetUnlinkedFiles } from "@/api/hooks/unlinked.hooks"
import { useState, useMemo } from "react"
import { useDebounce } from "react-use"

export function useGlobalSearch() {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    const { data: collection, isLoading: isLoadingCol } = useGetLibraryCollection()
    const { data: unlinkedFiles, isLoading: isLoadingUnlinked } = useGetUnlinkedFiles()

    const isLoading = isLoadingCol || isLoadingUnlinked

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

    const syntheticUnlinked = useMemo(() => {
        if (!unlinkedFiles) return []
        return unlinkedFiles.filter(f => !f.userResolved).map(file => {
            const filename = file.path.split(/[\\/]/).pop() ?? file.path
            return {
                mediaId: `unlinked-${file.id}`,
                isUnlinked: true,
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

    const results = useMemo(() => {
        const combined: any[] = [...allEntries, ...syntheticUnlinked]
        if (!isSearchActive) {
            return combined.slice(0, 10)
        }
        
        const q = debouncedQuery.toLowerCase()
        return combined
            .filter(entry => {
                const media = entry.media
                const title = media 
                    ? `${media.titleRomaji || ""} ${media.titleEnglish || ""} ${media.titleOriginal || ""}`.toLowerCase()
                    : `desconocido ${entry.mediaId}`
                
                return title.includes(q)
            })
            .slice(0, 10)
    }, [allEntries, syntheticUnlinked, debouncedQuery, isSearchActive])

    return {
        query,
        setQuery,
        results,
        isLoading,
        isSearchActive,
    }
}

