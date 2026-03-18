import { usePlatformListAnime, usePlatformListRecentAiringAnime } from "@/api/hooks/platform.hooks"
import { useState } from "react"
import { useDebounce } from "react-use"

export function useGlobalSearch() {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useDebounce(
        () => {
            setDebouncedQuery(query)
        },
        500,
        [query],
    )

    const isSearchActive = debouncedQuery.length > 2

    const {
        data: searchResults,
        isLoading: isSearchLoading,
    } = usePlatformListAnime(
        {
            search: debouncedQuery,
            perPage: 10,
        },
        isSearchActive,
    )

    const {
        data: recentAnime,
        isLoading: isRecentLoading,
    } = usePlatformListRecentAiringAnime(
        {
            perPage: 10,
        },
        !isSearchActive,
    )

    return {
        query,
        setQuery,
        results: isSearchActive ? searchResults?.media || [] : recentAnime?.media || [],
        isLoading: isSearchActive ? isSearchLoading : isRecentLoading,
        isSearchActive,
    }
}
