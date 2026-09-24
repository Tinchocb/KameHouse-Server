import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { VOLUMES_DATA } from '@/components/chronology/data/volumes';
import { VolumeData, EraFilter, AspectRatioType, MovieFilterOption } from '@/components/chronology/types';
import { compareInUniverse } from '@/components/chronology/data/spansToVolumes';
import { getMoviesForFilter, CHRONOLOGY_MOVIES_DATA } from '@/components/chronology/data/moviesData';
import { useReadVolumeIds } from './-hooks/use-timeline-prefs';
import { Header } from '@/components/chronology/Header';
import { SimplifiedTimeline } from '@/components/chronology/SimplifiedTimeline';
import { VolumeInspectorModal } from '@/components/chronology/VolumeInspectorModal';
import { SectionBar } from '@/components/ui/sectionbar';
import { useSpring, useReducedMotion } from '@/components/ui/kinetics/hooks';
import { useGetChronologyTimeline } from '@/api/hooks/chronology.hooks';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { DRAGON_BALL_SERIES } from '@/lib/config/dragonball_sagas';
import { getVolumeLoreEnrichment } from '@/components/chronology/data/loreEnrichment';
import { sounds } from '@/components/chronology/utils/audio';

export const Route = createLazyFileRoute('/chronology/')({
  component: ChronologyPage,
});

const MILESTONE_TO_VOLUME_MAP: Record<string, string | string[]> = {
  m_db_pilaf_21tb: ['db-pilaf', 'db-torneo-21'],
  m_db_red_ribbon: ['db-red-ribbon', 'db-uranai-baba'],
  m_db_22tb_piccolo: ['db-torneo-22', 'db-piccolo-daimaku'],
  m_db_23tb_piccolojr: ['db-piccolo-jr'],
  m_dbz_saiyans: ['dbz-saiyajin-raditz', 'dbz-saiyajin-vegeta'],
  m_dbz_saiyajin: ['dbz-saiyajin-raditz', 'dbz-saiyajin-vegeta'],
  m_dbz_namek_frieza: ['dbz-namek-viaje', 'dbz-namek-ginyu-freezer', 'dbz-freezer-super-saiyajin'],
  m_dbz_freezer: ['dbz-namek-viaje', 'dbz-namek-ginyu-freezer', 'dbz-freezer-super-saiyajin', 'dbz-garlic-jr'],
  m_dbz_androids_cell: ['dbz-androides-trunks', 'dbz-cell-imperfecto-perfeccion'],
  m_dbz_cell_games: ['dbz-juegos-de-cell', 'dbz-torneo-otro-mundo'],
  m_dbz_majin_buu: ['dbz-buu-majin-vegeta', 'dbz-buu-ssj3-fusion', 'dbz-buu-gotenks-gohan-mistico', 'dbz-buu-vegetto-kidbuu-final'],
  m_db_daima: ['db-daima-conspiracion', 'db-daima-climax'],
  m_dbs_gods_frieza: ['dbs-batalla-dioses', 'dbs-resurreccion-f'],
  m_dbs_u6_black: ['dbs-torneo-u6', 'dbs-copy-vegeta', 'dbs-goku-black'],
  // Nuevos hitos finos del backend (cuando existan)
  m_dbs_u6: ['dbs-torneo-u6'],
  m_dbs_copy_vegeta: ['dbs-copy-vegeta'],
  m_dbs_black: ['dbs-goku-black'],
  m_dbs_exhibicion: ['dbs-exhibicion-zen'],
  m_dbs_reclutamiento: ['dbs-reclutamiento-u7'],
  m_dbs_top: ['dbs-torneo-del-poder'],
  m_db_gt: ['dbgt-black-star', 'dbgt-baby-ssj4', 'dbgt-super-17', 'dbgt-dragones-malignos'],
  m_db_gt_black_star: ['dbgt-black-star'],
  m_db_gt_baby: ['dbgt-baby-ssj4'],
  m_db_gt_super17: ['dbgt-super-17'],
  m_db_gt_dragons: ['dbgt-dragones-malignos'],
  // Aliases legacy (13 tomos) → primer lapso del grupo para deep-links antiguos
  'vol-clasico-origen': 'db-pilaf',
  'vol-clasico-redribbon': 'db-red-ribbon',
  'vol-clasico-piccolo': 'db-piccolo-daimaku',
  'vol-saiyan-choque': 'dbz-saiyajin-raditz',
  'vol-freezer-ssj': 'dbz-namek-viaje',
  'vol-cell-trunks': 'dbz-androides-trunks',
  'vol-cell-games': 'dbz-juegos-de-cell',
  'vol-buu-caos': 'dbz-buu-majin-vegeta',
  'vol-daima-reino': 'db-daima-conspiracion',
  'vol-super-dioses': 'dbs-batalla-dioses',
  'vol-super-black': 'dbs-goku-black',
  'vol-super-torneo': 'dbs-torneo-del-poder',
  'vol-gt-viaje': 'dbgt-black-star',
};

function resolveVolumeIds(milestoneId: string): string[] {
  const mapped = MILESTONE_TO_VOLUME_MAP[milestoneId];
  if (!mapped) return [milestoneId];
  return Array.isArray(mapped) ? mapped : [mapped];
}

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

function ChronologyPage() {
  const searchParams = Route.useSearch();
  const { data: chronologyData, isLoading } = useGetChronologyTimeline();
  const reduceMotion = useReducedMotion();

  const initialTargetVolumeId = searchParams.highlight
    ? (resolveVolumeIds(searchParams.highlight)[0] ?? searchParams.highlight)
    : null;

  // Highlight state for deep-linking
  const [highlightedVolumeId, setHighlightedVolumeId] = useState<string | null>(initialTargetVolumeId);
  const [prevHighlight, setPrevHighlight] = useState(searchParams.highlight);

  if (searchParams.highlight !== prevHighlight) {
    setPrevHighlight(searchParams.highlight);
    if (searchParams.highlight) {
      setHighlightedVolumeId(resolveVolumeIds(searchParams.highlight)[0] ?? searchParams.highlight);
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

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Handle highlight and auto-scroll
  useEffect(() => {
    if (!highlightedVolumeId) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`timeline-node-${highlightedVolumeId}`);
      if (el) {
        el.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center',
        });
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

  // Mark as Read Persistence State (Synchronized with localStorage & server)
  // Migra IDs legacy vol-* a span ids (35 lapsos) una sola vez.
  const { readVolumeIds, handleToggleRead, handleMarkAllRead, handleResetRead, mergeServerWatched } = useReadVolumeIds();

  // Sync watched status from server into local read status
  useEffect(() => {
    if (chronologyData?.milestones) {
      const serverWatchedIds = new Set<string>();
      for (const m of chronologyData.milestones) {
        if (m.isWatched) {
          for (const volId of resolveVolumeIds(m.id)) serverWatchedIds.add(volId);
        }
      }
      if (serverWatchedIds.size > 0) {
        mergeServerWatched(serverWatchedIds);
      }
    }
  }, [chronologyData, mergeServerWatched]);

  const navigate = useNavigate();
  const { data: libraryCollection } = useGetLibraryCollection();
  const [movieFilter, setMovieFilter] = useState<MovieFilterOption>('none');

  const movieCounts = useMemo(() => {
    return {
      none: VOLUMES_DATA.length,
      canon: VOLUMES_DATA.length + CHRONOLOGY_MOVIES_DATA.filter((m) => m.isCanonMovie).length,
      all: VOLUMES_DATA.length + CHRONOLOGY_MOVIES_DATA.length,
    };
  }, []);

  // Map user library entries to resolved mediaId
  const { seriesMediaMap, moviesMediaMap } = useMemo(() => {
    const safeEntries = getSafeCollectionEntries(libraryCollection);
    const seriesMap = new Map<'classic' | 'z' | 'super' | 'daima' | 'gt', number>();
    const moviesMap = new Map<number, number>();

    for (const entry of safeEntries) {
      const tmdbId = entry.media?.tmdbId;
      if (!tmdbId) continue;

      // Series mapping
      if (tmdbId === DRAGON_BALL_SERIES.ORIGINAL) seriesMap.set('classic', entry.mediaId);
      else if (
        tmdbId === DRAGON_BALL_SERIES.Z ||
        tmdbId === DRAGON_BALL_SERIES.KAI ||
        tmdbId === DRAGON_BALL_SERIES.KAI_FINAL_CHAPTERS ||
        tmdbId === 42705
      ) {
        if (!seriesMap.has('z')) seriesMap.set('z', entry.mediaId);
      } else if (tmdbId === DRAGON_BALL_SERIES.SUPER) seriesMap.set('super', entry.mediaId);
      else if (tmdbId === DRAGON_BALL_SERIES.DAIMA) seriesMap.set('daima', entry.mediaId);
      else if (tmdbId === DRAGON_BALL_SERIES.GT) seriesMap.set('gt', entry.mediaId);

      // Movie mapping
      if (
        entry.media?.format === 'MOVIE' ||
        entry.media?.format === 'SPECIAL' ||
        entry.media?.format === 'ONA' ||
        entry.media?.format === 'OVA'
      ) {
        moviesMap.set(tmdbId, entry.mediaId);
      }
    }

    return { seriesMediaMap: seriesMap, moviesMediaMap: moviesMap };
  }, [libraryCollection]);

  // Combine TV volumes + Movies according to selected filter
  const baseVolumes = useMemo(() => {
    const movies = getMoviesForFilter(movieFilter);
    return [...VOLUMES_DATA, ...movies];
  }, [movieFilter]);

  // Enrich volumes with backend media, poster data, and lore catch-up keys, ordenados in-universe
  const enrichedVolumes: VolumeData[] = useMemo(() => {
    type BackendMilestone = NonNullable<NonNullable<typeof chronologyData>['milestones']>[number];
    const milestonesByVolumeId = new Map<string, BackendMilestone>();
    if (chronologyData?.milestones) {
      for (const m of chronologyData.milestones) {
        for (const volId of resolveVolumeIds(m.id)) {
          if (!milestonesByVolumeId.has(volId)) {
            milestonesByVolumeId.set(volId, m);
          }
        }
      }
    }

    return baseVolumes.map((vol) => {
      const m = milestonesByVolumeId.get(vol.id);
      const lore = getVolumeLoreEnrichment(vol.id);

      // Resolve mediaId from local library if not provided by backend
      let resolvedMediaId = m?.mediaId ?? vol.mediaId;
      if (!resolvedMediaId) {
        if (vol.isMovie && vol.tmdbId) {
          resolvedMediaId = moviesMediaMap.get(vol.tmdbId);
        } else if (vol.seriesId) {
          resolvedMediaId = seriesMediaMap.get(vol.seriesId);
        }
      }

      return {
        ...vol,
        mediaId: resolvedMediaId,
        tmdbId: m?.tmdbId ?? vol.tmdbId,
        canonStatus: m?.canonStatus ?? vol.canonStatus,
        importance: m?.importance ?? vol.importance,
        posterUrl: m?.posterImage || vol.posterUrl,
        backdropUrl: m?.backdropImage || vol.backdropUrl,
        isWatched: m?.isWatched ?? vol.isWatched,
        fillerEpisodes: lore?.fillerEpisodes ?? vol.fillerEpisodes,
        previouslyOn: lore?.previouslyOn ?? vol.previouslyOn,
        quickCatchUpKeys: lore?.quickCatchUpKeys ?? vol.quickCatchUpKeys,
        recommendedStartEpisode: lore?.recommendedStartEpisode ?? vol.recommendedStartEpisode,
      };
    }).sort(compareInUniverse);
  }, [baseVolumes, chronologyData, seriesMediaMap, moviesMediaMap]);

  // Playback navigation handler directly from chronology to player/series/movies
  const handlePlayVolume = useCallback(
    (vol: VolumeData, targetEpisodeNum?: number) => {
      sounds.playSelect();
      if (vol.isMovie) {
        if (vol.mediaId) {
          navigate({
            to: '/movies/$movieId',
            params: { movieId: String(vol.mediaId) },
          });
        } else {
          toast.info(`"${vol.title}" no está disponible en tu biblioteca.`, {
            description: 'Puedes escanearla o vincularla desde Ajustes > Biblioteca.',
          });
        }
        return;
      }

      // Serie de TV
      const resolvedEp = targetEpisodeNum ?? vol.recommendedStartEpisode ?? vol.startEpisode ?? 1;
      if (vol.mediaId) {
        navigate({
          to: '/series/$seriesId',
          params: { seriesId: String(vol.mediaId) },
          search: {
            saga: vol.sagaId ?? '',
            autoplay: String(resolvedEp),
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

  const handleMarkAllReadHere = () => {
    handleMarkAllRead(enrichedVolumes.map((v) => v.id));
  };

  // Count volumes per narrative Era
  const volumeCountsByEra = useMemo(() => {
    return {
      all: enrichedVolumes.length,
      'db-clasico': enrichedVolumes.filter((v) => v.seriesTag === 'Dragon Ball Clásico').length,
      'db-z': enrichedVolumes.filter((v) => v.seriesTag === 'Dragon Ball Z').length,
      'db-daima': enrichedVolumes.filter((v) => v.seriesTag === 'Dragon Ball Daima').length,
      'db-super': enrichedVolumes.filter((v) => v.seriesTag === 'Dragon Ball Super').length,
      'db-gt': enrichedVolumes.filter((v) => v.seriesTag === 'Dragon Ball GT').length,
    };
  }, [enrichedVolumes]);

  // Filter volumes by Era, Saga, and Search query
  const filteredVolumes = useMemo(() => {
    return enrichedVolumes.filter((vol) => {
      // 1. Era filter
      if (eraFilter === 'db-clasico' && vol.seriesTag !== 'Dragon Ball Clásico') return false;
      if (eraFilter === 'db-z' && vol.seriesTag !== 'Dragon Ball Z') return false;
      if (eraFilter === 'db-daima' && vol.seriesTag !== 'Dragon Ball Daima') return false;
      if (eraFilter === 'db-super' && vol.seriesTag !== 'Dragon Ball Super') return false;
      if (eraFilter === 'db-gt' && vol.seriesTag !== 'Dragon Ball GT') return false;

      // 2. Search query
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
  }, [enrichedVolumes, eraFilter, searchQuery]);

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

  const handleOpenInspector = (vol: VolumeData) => {
    setInspectedVolume(vol);
    setIsFlipped(false);
  };

  const emptyStateSpring = useSpring(320, 28, 0.8);

  if (isLoading && !chronologyData) {
    return (
      <div className="relative min-h-screen text-on-surface overflow-x-hidden font-sans">
        <div className="relative z-10 flex flex-col">
          {/* Header Skeleton inside full-width container */}
          <div className="w-full px-4 sm:px-6 md:px-8 xl:px-12 2xl:px-16 pt-4 md:pt-12 pb-4 space-y-4 animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high shrink-0" />
                <div className="space-y-2">
                  <div className="h-6 w-56 sm:w-72 bg-surface-container-high rounded-lg" />
                  <div className="h-3 w-44 sm:w-60 bg-surface-container-high/60 rounded-md" />
                </div>
              </div>
              <div className="h-10 w-full sm:w-72 bg-surface-container-low rounded-full border border-white/10" />
            </div>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 pt-1">
              <div className="flex-1 w-full flex items-center gap-2 bg-bg-primary/65 border border-white/15 rounded-full p-1.5 sm:p-2 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-9 sm:h-10 w-24 sm:w-32 bg-surface-container-low rounded-full shrink-0" />
                ))}
              </div>
              <div className="h-10 w-48 bg-surface-container-low rounded-full border border-white/10 shrink-0 self-start lg:self-auto" />
            </div>
          </div>

          {/* SectionBar Skeleton & Grid Skeleton inside page-container */}
          <div className="page-container space-y-4 pb-12 animate-pulse">
            {/* Eje cronológico Skeleton (espeja la pista de nodos) */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-16 w-20 rounded-xl bg-surface-container-low shrink-0" />
                ))}
              </div>
            </div>
            <SectionBar variant="minimal" label="Línea de Tiempo" className="bg-transparent text-on-surface">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                  <div key={i} className="aspect-[2/3] bg-surface-container/60 border border-white/10 rounded-2xl" />
                ))}
              </div>
            </SectionBar>
          </div>
        </div>
      </div>
    );
  }

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
          volumeCountsByEra={volumeCountsByEra}
          movieFilter={movieFilter}
          onSelectMovieFilter={setMovieFilter}
          movieCounts={movieCounts}
        />

        <div className="w-full px-4 sm:px-6 md:px-8 xl:px-12 2xl:px-16 space-y-4 pb-8">
          {/* Main Single-Focus Content: The Simplified Timeline */}
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
                    No se encontraron episodios o películas para los filtros seleccionados
                    {searchQuery && ` con la búsqueda «${searchQuery}»`}.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEraFilter('all');
                        setSearchQuery('');
                      }}
                      className="min-h-[44px] px-6 py-2 rounded-full bg-brand-accent hover:brightness-110 text-xs font-display tracking-widest font-black uppercase text-black shadow-brand-primary cursor-pointer active:scale-95 transition-all"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                </m.div>
              </div>
            ) : (
              <SimplifiedTimeline
                volumes={filteredVolumes}
                totalVolumesCount={enrichedVolumes.length}
                readVolumeIds={readVolumeIds}
                onToggleRead={handleToggleRead}
                onMarkAllRead={handleMarkAllReadHere}
                onResetRead={handleResetRead}
                onInspectThumbnail={handleOpenInspector}
                onPlayVolume={handlePlayVolume}
                highlightedVolumeId={highlightedVolumeId}
                searchQuery={searchQuery}
              />
            )}
          </main>

          {/* Modal Inspector for Full Artwork View */}
          <AnimatePresence>
            {inspectedVolume && (
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
            )}
          </AnimatePresence>

          {/* Clean, Minimalist Footer */}
          <footer className="border-t border-white/10 bg-transparent py-5 px-4 text-center text-xs font-mono text-on-surface-variant/70">
            <div className="w-full px-4 sm:px-6 md:px-8 xl:px-12 2xl:px-16 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="tracking-widest font-semibold uppercase">DRAGON BALL: LÍNEA DE TIEMPO OFICIAL</span>
              <span className="text-on-surface-variant/50">CRONOLOGÍA POR SAGAS Y LAPSOS (AÑO 749 - 790) • {enrichedVolumes.length} ENTREGAS • POR AKIRA TORIYAMA</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
