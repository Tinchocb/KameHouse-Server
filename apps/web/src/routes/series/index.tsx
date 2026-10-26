import { createFileRoute } from '@tanstack/react-router';
import { fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { prewarmImages } from '@/lib/helpers/images';
import { shelfImageUrls } from '@/lib/helpers/series-images';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';

export type SeriesViewMode = 'shelf' | 'etapas';

export const Route = createFileRoute('/series/')({
    validateSearch: (search: Record<string, unknown>): { view?: SeriesViewMode } => ({
        view: search.view === 'etapas' || search.view === 'shelf' ? search.view : undefined,
    }),
    // prefetch no bloqueante: nunca congela la navegación ni lanza en el router;
    // unificado con home y movies.
    loader: ({ context }) => {
        void context.queryClient
            .fetchQuery({
                queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
                queryFn: fetchLibraryCollection,
                staleTime: 5 * 60 * 1000,
            })
            // Pósters y banners de la estantería: se bajan en idle cuando la ruta
            // se precarga (al arrancar la app o al apuntar el link), no al entrar.
            .then((collection) => prewarmImages(shelfImageUrls(getSafeCollectionEntries(collection))))
            .catch(() => {});
    },
    errorComponent: AppErrorBoundary,
});
