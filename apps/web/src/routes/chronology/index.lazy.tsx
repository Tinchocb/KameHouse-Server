import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { createLazyFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { VOLUMES_DATA, LEGACY_VOLUME_TO_SPANS } from '@/components/chronology/data/volumes';
import { VolumeData, EraFilter, AspectRatioType } from '@/components/chronology/types';
import type { EraProgress } from '@/components/chronology/ChronologyEraNav';
import { compareInUniverse } from '@/components/chronology/data/spansToVolumes';
import { useChronologyProgress, useShowInterludes } from './-hooks/use-timeline-prefs';
import { Header, type StatusFilter } from '@/components/chronology/Header';
import { AlternatingTimeline } from '@/components/chronology/AlternatingTimeline';
import { ChronologyViewMenu } from '@/components/chronology/ChronologyViewMenu';
import { type MomentPlayInfo } from '@/components/chronology/MomentStrip';
import { SectionBar } from '@/components/ui/sectionbar';
import { useSpring, useReducedMotion } from '@/components/ui/kinetics/hooks';

const VolumeInspectorModal = React.lazy(() =>
  import('@/components/chronology/VolumeInspectorModal').then((mod) => ({ default: mod.VolumeInspectorModal }))
);
const LoreEncyclopediaModal = React.lazy(() =>
  import('@/components/chronology/LoreEncyclopediaModal').then((mod) => ({ default: mod.LoreEncyclopediaModal }))
);
import { useGetChronologyMomentTimes } from '@/api/hooks/chronology.hooks';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { DRAGON_BALL_SERIES } from '@/lib/config/dragonball_sagas';
import { getVolumeLoreEnrichment } from '@/components/chronology/data/loreEnrichment';
import { sounds } from '@/components/chronology/utils/audio';
import { PlayerFallback } from '@/components/video/player-fallback';

export const Route = createLazyFileRoute('/chronology/')({
  component: ChronologyPage,
});

/** Deep-links viejos (`vol-*`, 13 tomos) apuntan al primer lapso de su grupo. */
function resolveHighlightId(id: string): string {
  return LEGACY_VOLUME_TO_SPANS[id]?.[0] ?? id;
}

const ERA_BY_SERIES_TAG: Record<VolumeData['seriesTag'], Exclude<EraFilter, 'all'>> = {
  'Dragon Ball Clásico': 'db-clasico',
  'Dragon Ball Z': 'db-z',
  'Dragon Ball Daima': 'db-daima',
  'Dragon Ball Super': 'db-super',
  'Dragon Ball GT': 'db-gt',
};

function parseEraParam(rawEra?: string): EraFilter {
  if (!rawEra) return 'all';
  const raw = rawEra.toLowerCase().trim();
  if (raw === 'classic' || raw === 'db' || raw === 'db-clasico' || raw === 'db-classic') return 'db-clasico';
  if (raw === 'z' || raw === 'dbz' || raw === 'db-z') return 'db-z';
  if (raw === 'daima' || raw === 'dbdaima' || raw === 'db-daima') return 'db-daima';
  if (raw === 'super' || raw === 'dbs' || raw === 'db-super') return 'db-super';
  if (raw === 'gt' || raw === 'dbgt' || raw === 'db-gt') return 'db-gt';
  if (raw === 'kai' || raw === 'dbkai' || raw === 'db-kai') return 'db-z';
  const validEras: EraFilter[] = ['all', 'db-clasico', 'db-z', 'db-daima', 'db-super', 'db-gt'];
  return validEras.includes(raw as EraFilter) ? (raw as EraFilter) : 'all';
}

/** Lapso enriquecido por (id, mediaId, arte): la misma entrada devuelve el mismo objeto entre renders. */
const ENRICHED_VOLUME_CACHE = new Map<string, VolumeData>();

function ChronologyPage() {
  const searchParams = Route.useSearch();
  const reduceMotion = useReducedMotion();

  const initialTargetVolumeId = searchParams.highlight ? resolveHighlightId(searchParams.highlight) : null;

  // Highlight state for deep-linking
  const [highlightedVolumeId, setHighlightedVolumeId] = useState<string | null>(initialTargetVolumeId);
  const [prevHighlight, setPrevHighlight] = useState(searchParams.highlight);
  // Resaltado que llega por URL (p. ej. al volver del reproductor): se salta directo a la tarjeta,
  // sin recorrer la página con scroll suave.
  const highlightFromUrlRef = React.useRef(Boolean(initialTargetVolumeId));

  if (searchParams.highlight !== prevHighlight) {
    setPrevHighlight(searchParams.highlight);
    if (searchParams.highlight) {
      highlightFromUrlRef.current = true;
      setHighlightedVolumeId(resolveHighlightId(searchParams.highlight));
    }
  }

  // Independent Era filter state
  const [eraFilter, setEraFilter] = useState<EraFilter>(() => parseEraParam(searchParams.era));
  const [prevSearchEra, setPrevSearchEra] = useState(searchParams.era);

  if (searchParams.era !== prevSearchEra) {
    setPrevSearchEra(searchParams.era);
    if (searchParams.era) {
      setEraFilter(parseEraParam(searchParams.era));
    }
  }

  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.q ?? '');
  const { data: serverMomentTimes } = useGetChronologyMomentTimes();

  // Handle highlight and auto-scroll
  useEffect(() => {
    if (!highlightedVolumeId) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`timeline-node-${highlightedVolumeId}`);
      if (el) {
        // 'start' + el scroll-margin del nodo: la tarjeta queda entera debajo de la barra superior
        // (con 'center' las tarjetas más altas que la ventana quedaban con el tope afuera).
        el.scrollIntoView({
          behavior: reduceMotion || highlightFromUrlRef.current ? 'auto' : 'smooth',
          block: 'start',
        });
        highlightFromUrlRef.current = false;
      }
    }, 350);

    const clearTimer = setTimeout(() => {
      setHighlightedVolumeId(null);
    }, 3500);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [highlightedVolumeId, reduceMotion]);

  // Thumbnail Inspection Modal State
  const [inspectedVolume, setInspectedVolume] = useState<VolumeData | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('2:3');
  const [isFlipped, setIsFlipped] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { showInterludes, handleToggleInterludes } = useShowInterludes();
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);

  const navigate = useNavigate();
  const router = useRouter();
  // Pantalla de carga desde el toque en reproducir hasta que la serie abre el reproductor.
  const [launching, setLaunching] = useState<{ label: string; sublabel: string } | null>(null);
  const { data: libraryCollection } = useGetLibraryCollection();

  // Serie de la biblioteca por era: mediaId para reproducir y arte para el inspector.
  const seriesMediaMap = useMemo(() => {
    const map = new Map<NonNullable<VolumeData['seriesId']>, { mediaId: number; posterUrl?: string; backdropUrl?: string }>();
    for (const entry of getSafeCollectionEntries(libraryCollection)) {
      const tmdbId = entry.media?.tmdbId;
      if (!tmdbId) continue;
      const info = {
        mediaId: entry.mediaId,
        posterUrl: entry.media?.posterImage || undefined,
        backdropUrl: entry.media?.bannerImage || undefined,
      };
      if (tmdbId === DRAGON_BALL_SERIES.ORIGINAL) map.set('classic', info);
      else if (
        tmdbId === DRAGON_BALL_SERIES.Z ||
        tmdbId === DRAGON_BALL_SERIES.KAI ||
        tmdbId === DRAGON_BALL_SERIES.KAI_FINAL_CHAPTERS ||
        tmdbId === 42705
      ) {
        if (!map.has('z')) map.set('z', info);
      } else if (tmdbId === DRAGON_BALL_SERIES.SUPER) map.set('super', info);
      else if (tmdbId === DRAGON_BALL_SERIES.DAIMA) map.set('daima', info);
      else if (tmdbId === DRAGON_BALL_SERIES.GT) map.set('gt', info);
    }
    return map;
  }, [libraryCollection]);

  // Lapsos con serie de la biblioteca y lore de catch-up, ordenados in-universe.
  // Un lapso cuyo arte y mediaId no cambiaron conserva el mismo objeto: así una
  // actualización de la biblioteca no re-renderiza las 40 tarjetas.
  const enrichedVolumes: VolumeData[] = useMemo(() => {
    return VOLUMES_DATA.map((vol) => {
      const series = vol.seriesId ? seriesMediaMap.get(vol.seriesId) : undefined;
      const mediaId = series?.mediaId ?? vol.mediaId;
      const posterUrl = series?.posterUrl || vol.posterUrl;
      const backdropUrl = series?.backdropUrl || vol.backdropUrl;
      const cacheKey = `${vol.id}|${mediaId ?? ''}|${posterUrl ?? ''}|${backdropUrl ?? ''}`;
      const cached = ENRICHED_VOLUME_CACHE.get(cacheKey);
      if (cached) return cached;
      const lore = getVolumeLoreEnrichment(vol.id);
      const enriched: VolumeData = {
        ...vol,
        mediaId,
        posterUrl,
        backdropUrl,
        fillerEpisodes: lore?.fillerEpisodes ?? vol.fillerEpisodes,
        previouslyOn: lore?.previouslyOn ?? vol.previouslyOn,
        quickCatchUpKeys: lore?.quickCatchUpKeys ?? vol.quickCatchUpKeys,
        recommendedStartEpisode: lore?.recommendedStartEpisode ?? vol.recommendedStartEpisode,
      };
      ENRICHED_VOLUME_CACHE.set(cacheKey, enriched);
      return enriched;
    }).sort(compareInUniverse);
  }, [seriesMediaMap]);

  // Avance por lapso (historial + marcas manuales), guardado en el servidor.
  const {
    progressById,
    readVolumeIds,
    handleToggleRead,
    setWatched,
    snapshotOverrides,
    restoreOverrides,
  } = useChronologyProgress(enrichedVolumes);

  // Precarga de la página de cada serie (código + datos) para que reproducir no espere:
  // en segundo plano al abrir la cronología y otra vez al apuntar una tarjeta, porque la
  // precarga del router vence a los 30 s.
  const preloadedAtRef = React.useRef(new Map<number, number>());
  const preloadSeries = useCallback(
    (mediaId: number | undefined) => {
      if (!mediaId) return;
      const last = preloadedAtRef.current.get(mediaId) ?? 0;
      if (Date.now() - last < 25_000) return;
      preloadedAtRef.current.set(mediaId, Date.now());
      router
        .preloadRoute({ to: '/series/$seriesId', params: { seriesId: String(mediaId) }, search: { saga: '', subSaga: '' } })
        .catch(() => preloadedAtRef.current.delete(mediaId));
    },
    [router]
  );

  useEffect(() => {
    const mediaIds = [...new Set(enrichedVolumes.map((v) => v.mediaId).filter((id): id is number => !!id))];
    if (mediaIds.length === 0) return;
    const run = () => mediaIds.forEach(preloadSeries);
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(run, 1500);
    return () => clearTimeout(timer);
  }, [enrichedVolumes, preloadSeries]);

  // Playback navigation handler directly from chronology to player/series/movies
  const handlePlayVolume = useCallback(
    (vol: VolumeData, targetEpisodeNum?: number, momentInfo?: MomentPlayInfo) => {
      sounds.playSelect();
      // Serie de TV
      const resolvedEp = targetEpisodeNum ?? vol.recommendedStartEpisode ?? vol.startEpisode ?? 1;
      if (vol.mediaId) {
        setLaunching({ label: `Preparando Cap. ${resolvedEp}`, sublabel: momentInfo?.title || vol.title });
        navigate({
          to: '/series/$seriesId',
          params: { seriesId: String(vol.mediaId) },
          search: {
            saga: vol.sagaId ?? '',
            autoplay: String(resolvedEp),
            ...(momentInfo?.seconds != null && momentInfo.seconds > 0 ? { t: momentInfo.seconds } : {}),
            ...(momentInfo?.key ? { moment: momentInfo.key } : {}),
            ...(momentInfo?.title ? { momentTitle: momentInfo.title } : {}),
            // Al cerrar el reproductor, la serie vuelve a este lapso de la cronología.
            chrono: vol.id,
          },
        });
      } else {
        toast.info(`La serie ${vol.seriesTag} no está en tu biblioteca.`, {
          description: 'Verifica tu carpeta escaneada en Ajustes > Biblioteca.',
        });
      }
    },
    [navigate]
  );

  // "Marcar todos" y "Reiniciar" se aplican al instante y se pueden deshacer.
  const applyBulkWithUndo = useCallback(
    (watched: boolean) => {
      const snapshot = snapshotOverrides();
      setWatched(enrichedVolumes.map((v) => v.id), watched);
      toast.success(watched ? 'Todos los lapsos marcados como vistos' : 'Progreso de la cronología reiniciado', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            restoreOverrides(snapshot);
            toast.info('Progreso restaurado');
          },
        },
      });
    },
    [enrichedVolumes, setWatched, snapshotOverrides, restoreOverrides]
  );
  const handleMarkAllReadHere = useCallback(() => applyBulkWithUndo(true), [applyBulkWithUndo]);
  const handleResetReadWithUndo = useCallback(() => applyBulkWithUndo(false), [applyBulkWithUndo]);

  // Sync URL search params with era and search query
  useEffect(() => {
    navigate({
      to: '/chronology',
      search: (prev) => ({
        ...prev,
        era: eraFilter !== 'all' ? eraFilter : undefined,
        q: searchQuery.trim() || undefined,
      }),
      replace: true,
    });
  }, [eraFilter, searchQuery, navigate]);

  // Lapsos y vistos por era: alimenta las pestañas de era (única navegación por eras).
  const eraProgress = useMemo(() => {
    const out = Object.fromEntries(
      (['all', 'db-clasico', 'db-z', 'db-daima', 'db-super', 'db-gt'] as const).map((era) => [era, { count: 0, read: 0 }])
    ) as Record<EraFilter, EraProgress>;
    for (const vol of enrichedVolumes) {
      const isRead = readVolumeIds.has(vol.id);
      for (const era of ['all', ERA_BY_SERIES_TAG[vol.seriesTag]] as const) {
        out[era].count += 1;
        if (isRead) out[era].read += 1;
      }
    }
    return out;
  }, [enrichedVolumes, readVolumeIds]);

  // Filter volumes by Era, Status, Saga, and Search query
  const filteredVolumes = useMemo(() => {
    return enrichedVolumes.filter((vol) => {
      // 1. Era filter
      if (eraFilter !== 'all' && ERA_BY_SERIES_TAG[vol.seriesTag] !== eraFilter) return false;

      // 2. Status filter
      const isRead = readVolumeIds.has(vol.id);
      if (statusFilter === 'pending' && isRead) return false;
      if (statusFilter === 'watched' && !isRead) return false;

      // 3. Search query
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const matchesQuery =
        vol.title.toLowerCase().includes(q) ||
        vol.subtitle.toLowerCase().includes(q) ||
        vol.sagaLabel.toLowerCase().includes(q) ||
        (vol.sagaId ?? '').toLowerCase().includes(q) ||
        vol.episodesRange.toLowerCase().includes(q) ||
        vol.volumeNumber.toLowerCase().includes(q) ||
        vol.officialYear.toLowerCase().includes(q) ||
        vol.characters.some((c) => c.toLowerCase().includes(q)) ||
        vol.narrative.climax.decisiveBattle.toLowerCase().includes(q) ||
        vol.narrative.detonante.title.toLowerCase().includes(q);

      return matchesQuery;
    });
  }, [enrichedVolumes, eraFilter, statusFilter, readVolumeIds, searchQuery]);

  const inspectedIndex = useMemo(() => {
    if (!inspectedVolume) return -1;
    return filteredVolumes.findIndex((v) => v.id === inspectedVolume.id);
  }, [inspectedVolume, filteredVolumes]);

  const handlePrevVolume = useCallback(() => {
    if (inspectedIndex > 0) {
      setInspectedVolume(filteredVolumes[inspectedIndex - 1]);
      setIsFlipped(false);
    }
  }, [inspectedIndex, filteredVolumes]);

  const handleNextVolume = useCallback(() => {
    if (inspectedIndex >= 0 && inspectedIndex < filteredVolumes.length - 1) {
      setInspectedVolume(filteredVolumes[inspectedIndex + 1]);
      setIsFlipped(false);
    }
  }, [inspectedIndex, filteredVolumes]);

  const handleOpenInspector = useCallback((vol: VolumeData) => {
    setInspectedVolume(vol);
    setIsFlipped(false);
  }, []);
  const handleVolumeIntent = useCallback((vol: VolumeData) => preloadSeries(vol.mediaId), [preloadSeries]);

  // Keyboard navigation: j/k move, Enter plays, v toggles watched
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        sounds.playSelect();
        const currentIdx = filteredVolumes.findIndex((v) => v.id === highlightedVolumeId);
        const nextIdx = currentIdx < filteredVolumes.length - 1 ? currentIdx + 1 : 0;
        const targetVol = filteredVolumes[nextIdx];
        if (targetVol) {
          setHighlightedVolumeId(targetVol.id);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        sounds.playSelect();
        const currentIdx = filteredVolumes.findIndex((v) => v.id === highlightedVolumeId);
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : filteredVolumes.length - 1;
        const targetVol = filteredVolumes[prevIdx];
        if (targetVol) {
          setHighlightedVolumeId(targetVol.id);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        if (highlightedVolumeId) {
          e.preventDefault();
          sounds.playSelect();
          handleToggleRead(highlightedVolumeId);
        }
      } else if (e.key === 'Enter') {
        if (highlightedVolumeId) {
          const targetVol = filteredVolumes.find((v) => v.id === highlightedVolumeId);
          if (targetVol) {
            e.preventDefault();
            sounds.playSelect();
            handlePlayVolume(targetVol);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredVolumes, highlightedVolumeId, handleToggleRead, handlePlayVolume]);

  const emptyStateSpring = useSpring(320, 28, 0.8);

  return (
    <div className="relative min-h-screen text-on-surface overflow-x-hidden selection:bg-brand-accent/30 font-sans">
      <div className="relative z-10 flex flex-col">
        {/* Simplified Header with independent Era Chips and Movie Filter */}
        <Header
          currentEraFilter={eraFilter}
          onSelectEraFilter={(era) => {
            setEraFilter(era);
          }}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          eraProgress={eraProgress}
          onOpenEncyclopedia={() => setIsEncyclopediaOpen(true)}
          actions={
            <ChronologyViewMenu
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              showInterludes={showInterludes}
              onToggleInterludes={handleToggleInterludes}
              totalVolumes={eraProgress.all.count}
              readCount={eraProgress.all.read}
              onMarkAllRead={handleMarkAllReadHere}
              onResetRead={handleResetReadWithUndo}
            />
          }
        />

        {/* La línea de tiempo queda en una columna de lectura */}
        <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 space-y-4 pt-4 pb-8">

          {/* Main Single-Focus Content: The Alternating Timeline */}
          <main className="flex-1 w-full py-2 flex flex-col gap-6">
            {filteredVolumes.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center px-4">
                <m.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={emptyStateSpring}
                  className="glass-card rounded-3xl p-8 max-w-md w-full text-center border border-[var(--glass-border-side)] shadow-elevation-2 space-y-3"
                >
                  <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">Sin resultados</h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    No se encontraron lapsos para los filtros seleccionados
                    {searchQuery && ` con la búsqueda «${searchQuery}»`}.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEraFilter('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="min-h-[44px] px-6 py-2 rounded-full bg-brand-accent hover:brightness-110 text-xs font-display tracking-widest font-black uppercase text-black shadow-brand-primary cursor-pointer active:scale-95 transition"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                </m.div>
              </div>
            ) : (
              <AlternatingTimeline
                volumes={filteredVolumes}
                readVolumeIds={readVolumeIds}
                progressById={progressById}
                serverMomentTimes={serverMomentTimes}
                onToggleRead={handleToggleRead}
                showInterludes={showInterludes}
                onInspectThumbnail={handleOpenInspector}
                onPlayVolume={handlePlayVolume}
                onVolumeIntent={handleVolumeIntent}
                highlightedVolumeId={highlightedVolumeId}
                searchQuery={searchQuery}
              />
            )}
          </main>

          {/* Modal Inspector for Full Artwork View */}
          <AnimatePresence>
            {inspectedVolume && (
              <React.Suspense fallback={null}>
                <VolumeInspectorModal
                  volume={inspectedVolume}
                  isOpen={true}
                  onClose={() => setInspectedVolume(null)}
                  aspectRatio={aspectRatio}
                  onChangeAspectRatio={setAspectRatio}
                  isFlipped={isFlipped}
                  onToggleFlip={() => setIsFlipped((f) => !f)}
                  isRead={readVolumeIds.has(inspectedVolume.id)}
                  onToggleRead={() => handleToggleRead(inspectedVolume.id)}
                  onPlayVolume={handlePlayVolume}
                  hasPrev={inspectedIndex > 0}
                  hasNext={inspectedIndex >= 0 && inspectedIndex < filteredVolumes.length - 1}
                  onPrevVolume={handlePrevVolume}
                  onNextVolume={handleNextVolume}
                />
              </React.Suspense>
            )}
          </AnimatePresence>

          {/* Enciclopedia: artefactos, líneas temporales y glosario */}
          {isEncyclopediaOpen && (
            <React.Suspense fallback={null}>
              <LoreEncyclopediaModal
                isOpen={isEncyclopediaOpen}
                onClose={() => setIsEncyclopediaOpen(false)}
              />
            </React.Suspense>
          )}

          {launching && <PlayerFallback label={launching.label} sublabel={launching.sublabel} />}

          {/* Clean, Minimalist Footer */}
          <footer className="border-t border-white/10 bg-transparent py-5 px-4 text-center text-xs font-mono text-on-surface-variant/70">
            <div className="page-container flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="tracking-widest font-semibold uppercase">DRAGON BALL: LÍNEA DE TIEMPO OFICIAL</span>
              <span className="text-on-surface-variant/50">CRONOLOGÍA POR SAGAS Y LAPSOS (AÑO 749 - 790) • {enrichedVolumes.length} LAPSOS • POR AKIRA TORIYAMA</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
