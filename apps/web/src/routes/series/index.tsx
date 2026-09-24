import { createFileRoute } from '@tanstack/react-router';
import { fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';

export type SeriesViewMode = 'shelf' | 'etapas';

export const Route = createFileRoute('/series/')({
    validateSearch: (search: Record<string, unknown>): { view?: SeriesViewMode } => ({
        view: search.view === 'etapas' ? 'etapas' : undefined,
    }),
    // prefetch no bloqueante: nunca congela la navegación ni lanza en el router;
    // unificado con home y movies.
    loader: ({ context }) => {
        void context.queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
            staleTime: 5 * 60 * 1000,
        });
    },
    errorComponent: AppErrorBoundary,
});
