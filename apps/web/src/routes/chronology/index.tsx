import { createFileRoute } from '@tanstack/react-router';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchChronologyProgress, fetchChronologyMomentTimes } from '@/api/hooks/chronology.hooks';
import { fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { chronologyEpisodeFilesQueryOptions } from '@/api/hooks/library-episode.hooks';

/** Tope de espera del loader: con el server local responde en decenas de ms; si tarda, se entra igual. */
const LOADER_WAIT_CAP_MS = 600;

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
  // Espera lo que define la primera pintura (biblioteca, avance y archivos de episodio) para que la
  // página entre ya armada en vez de re-renderizar las 40 tarjetas cuando llegan los datos. Con el
  // preload por intent del router esto corre al apuntar el enlace, así que al hacer clic ya está.
  loader: async ({ context }) => {
    const qc = context.queryClient;
    void qc.prefetchQuery({
      queryKey: [API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.key],
      queryFn: fetchChronologyMomentTimes,
    });
    const essentials = Promise.all([
      qc.ensureQueryData({
        queryKey: [API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.key],
        queryFn: fetchChronologyProgress,
      }),
      qc.ensureQueryData({
        queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
        queryFn: fetchLibraryCollection,
      }),
      qc.ensureQueryData(chronologyEpisodeFilesQueryOptions),
    ]).catch(() => undefined);
    await Promise.race([essentials, new Promise((resolve) => setTimeout(resolve, LOADER_WAIT_CAP_MS))]);
  },
  errorComponent: AppErrorBoundary,
});
