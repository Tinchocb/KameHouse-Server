import { createFileRoute } from '@tanstack/react-router';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchChronologyProgress, fetchChronologyMomentTimes } from '@/api/hooks/chronology.hooks';
import { fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { chronologyEpisodeFilesQueryOptions } from '@/api/hooks/library-episode.hooks';


interface ChronologySearchParams {
  era?: string;
  highlight?: string;
  q?: string;
}

export const Route = createFileRoute('/chronology/')({
  validateSearch: (search: Record<string, unknown>): ChronologySearchParams => ({
    era: typeof search.era === 'string' ? search.era : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  // Prefetch no bloqueante (alineado con home, movies y series): la navegación es instantánea
  // sin congelar la interfaz ni esperar hasta 600ms. Si el usuario hizo hover sobre el enlace,
  // el router ya habrá disparado la precarga en background.
  loader: ({ context }) => {
    const qc = context.queryClient;
    void qc.prefetchQuery({
      queryKey: [API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.key],
      queryFn: fetchChronologyMomentTimes,
    });
    void qc.prefetchQuery({
      queryKey: [API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.key],
      queryFn: fetchChronologyProgress,
    });
    void qc.prefetchQuery({
      queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
      queryFn: fetchLibraryCollection,
    });
    void qc.prefetchQuery(chronologyEpisodeFilesQueryOptions);
  },
  errorComponent: AppErrorBoundary,
});
