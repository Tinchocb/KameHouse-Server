import { fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { createFileRoute } from "@tanstack/react-router"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { whenCacheRestored } from "@/lib/query-persister"

export const Route = createFileRoute("/home/")({
    // prefetch (no ensureQueryData): nunca lanza, así un backend que aún arranca
    // no tumba la ruta; el componente muestra HomeSkeleton hasta tener datos.
    loader: async ({ context }) => {
        // Esperar a la caché persistida: si no, la colección se pide a red aunque ya esté guardada.
        await whenCacheRestored()
        void context.queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
    },
    errorComponent: AppErrorBoundary,
})
