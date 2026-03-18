import { createFileRoute } from "@tanstack/react-router"
import React from "react"
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query"
import { fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { LibraryClientGrid } from "./-library-client-grid"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export const Route = createFileRoute("/library/")({
    component: LibraryPage,
    loader: async ({ context }) => {
        const queryClient = new QueryClient()
        await queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
        return { dehydrateState: dehydrate(queryClient) }
    },
})

function LibraryPage() {
    const { dehydrateState } = Route.useLoaderData()
    return (
        <HydrationBoundary state={dehydrateState}>
            <LibraryClientGrid />
        </HydrationBoundary>
    )
}