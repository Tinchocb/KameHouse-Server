import { createFileRoute } from "@tanstack/react-router"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { BentoDetailsSkeleton } from "@/components/ui/shimmer-skeleton"

export const Route = createFileRoute("/movies/$movieId")({
    loader: async ({ params: { movieId }, context }) => {
        const qc = context.queryClient
        await qc.ensureQueryData({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, movieId],
            queryFn: () => fetchAnimeEntry(movieId),
        })
    },
    errorComponent: AppErrorBoundary,
    pendingComponent: BentoDetailsSkeleton,
})
