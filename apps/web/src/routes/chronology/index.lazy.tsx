import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { createLazyFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { VOLUMES_DATA, LEGACY_VOLUME_TO_SPANS } from '@/components/chronology/data/volumes';
import type { VolumeData, EraFilter } from '@/components/chronology/types';
import type { EraProgress } from '@/components/chronology/ChronologyEraNav';
import { compareInUniverse } from '@/components/chronology/data/spansToVolumes';
import { compareRelease, type TimelineOrder } from '@/components/chronology/data/releaseOrder';
import { CompactTimeline } from '@/components/chronology/CompactTimeline';
import { TimelineControls } from '@/components/chronology/TimelineControls';
import { YearScale, accentByEraFrom } from '@/components/chronology/YearScale';
import { useChronologyProgress, useShowInterludes, useTimelineView, useTimelineZVariant } from './-hooks/use-timeline-prefs';
import { useMarathonFromHere } from './-hooks/use-marathon';
import { useInspectorFocusReturn } from './-hooks/use-inspector-focus-return';
import { MarathonDialog } from '@/components/chronology/MarathonDialog';
import { Header } from '@/components/chronology/Header';
import { ChronologyBackdrop } from '@/components/chronology/ChronologyBackdrop';
import { AlternatingTimeline } from '@/components/chronology/AlternatingTimeline';
import { groupVolumesByEra } from '@/components/chronology/data/spansToVolumes';
import { neutralizeVolume } from '@/components/chronology/data/neutralChrome';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';
import { type MomentPlayInfo } from '@/components/chronology/types';
import { useSpringPreset, useReducedMotion, useMotionTier } from '@/components/ui/kinetics/hooks';

const VolumeInspectorModal = React.lazy(() =>
  import('@/components/chronology/VolumeInspectorModal').then((mod) => ({ default: mod.VolumeInspectorModal }))
);
import { useGetChronologyMomentTimes } from '@/api/hooks/chronology.hooks';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { DRAGON_BALL_SERIES } from '@/lib/config/dragonball_sagas';
import { DRAGON_BALL_STORY_SPANS } from '@/lib/config/dragonball_story_spans';
import { getVolumeLoreEnrichment } from '@/components/chronology/data/loreEnrichment';
import { computeEraBar, eraOfSectionId, ERA_FILTER_BY_SERIES, sectionIdForEra, type EraKey } from '@/components/chronology/data/eraBar';
import { useSectionSpy } from '@/components/chronology/utils/sectionSpy';
import { scrollToSection } from '@/components/chronology/utils/scrollToSection';
import { ScrollProgress } from '@/components/ui/kinetics/scroll-progress';
import { DeferredMount } from '@/components/shared/deferred-mount';
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

function getEraForVolumeId(id: string): EraFilter | null {
  const vol = VOLUMES_DATA.find((v) => v.id === id);
  if (!vol) return null;
  return ERA_BY_SERIES_TAG[vol.seriesTag] ?? null;
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

/** Lapso enriquecido por (id, mediaId, arte): la misma entrada devuelve el mismo objeto entre renders. */
const ENRICHED_VOLUME_CACHE = new Map<string, VolumeData>();

/** Sin secciones: el espía de eras no mide nada mientras la lista todavía no está montada. */
const NO_SECTIONS: readonly string[] = [];

function ChronologyPage() {
  const searchParams = Route.useSearch();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  const initialTargetVolumeId = searchParams.highlight ? resolveHighlightId(searchParams.highlight) : null;

  // Highlight state for deep-linking
  const [highlightedVolumeId, setHighlightedVolumeId] = useState<string | null>(initialTargetVolumeId);
  // Cursor de j/k: el último lapso resaltado (por teclado o por URL). No se borra cuando el
  // resaltado se apaga a los 3,5 s, así j/k siguen desde ahí y no saltan al primero o al último.
  const keyboardCursorRef = React.useRef<string | null>(null);

  // Independent Era filter state
  const [eraFilter, setEraFilter] = useState<EraFilter>(() => {
    if (searchParams.era) return parseEraParam(searchParams.era);
    if (initialTargetVolumeId) {
      const targetEra = getEraForVolumeId(initialTargetVolumeId);
      if (targetEra) return targetEra;
    }
    return 'all';
  });

  // Sincronización en render según directrices oficiales de React (storing information from previous renders)
  const [prevEraParam, setPrevEraParam] = React.useState(searchParams.era);
  if (searchParams.era !== prevEraParam) {
    setPrevEraParam(searchParams.era);
    if (searchParams.era) {
      setEraFilter(parseEraParam(searchParams.era));
    }
  }

  const [prevHighlightParam, setPrevHighlightParam] = React.useState(searchParams.highlight);
  if (searchParams.highlight !== prevHighlightParam) {
    setPrevHighlightParam(searchParams.highlight);
    if (searchParams.highlight) {
      const targetId = resolveHighlightId(searchParams.highlight);
      setHighlightedVolumeId(targetId);
      const targetEra = getEraForVolumeId(targetId);
      if (targetEra && eraFilter !== 'all' && eraFilter !== targetEra) {
        setEraFilter(targetEra);
      }
    }
  }

  const searchQuery = searchParams.q ?? '';
  const { data: serverMomentTimes } = useGetChronologyMomentTimes();

  // La lista se monta después del primer pintado (DeferredMount) salvo con ?highlight: el deep-link necesita
  // su fila en el DOM al hacer el salto. Si el resaltado llega con la instancia ya montada y la lista todavía
  // sin montar, el salto se repite cuando la lista monta (listMounted cambia y el efecto vuelve a correr).
  const [deferList] = useState(() => !searchParams.highlight);
  const [listMounted, setListMounted] = useState(!deferList);
  const handleListMounted = useCallback(() => setListMounted(true), []);

  // Resaltado que llega por URL (p. ej. al volver del reproductor): salto instantáneo a la
  // tarjeta antes del primer pintado. El rAF, agendado desde el layout effect, corre después
  // de que PageTransition reinicia el scroll y de que el router restaura el suyo, así que el
  // primer cuadro ya muestra la tarjeta. j/k hacen su propio scroll en el manejador de teclado.
  useLayoutEffect(() => {
    if (!searchParams.highlight || !listMounted) return;
    const targetId = resolveHighlightId(searchParams.highlight);
    const raf = requestAnimationFrame(() => {
      // 'start' + el scroll-margin del nodo: la tarjeta queda entera debajo de la barra superior
      // (con 'center' las tarjetas más altas que la ventana quedaban con el tope afuera).
      document.getElementById(`timeline-node-${targetId}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [searchParams.highlight, listMounted]);

  // El resaltado se apaga a los 3,5 s; el cursor de j/k queda en el último lapso resaltado.
  useEffect(() => {
    if (!highlightedVolumeId) return;
    keyboardCursorRef.current = highlightedVolumeId;

    const clearTimer = setTimeout(() => {
      setHighlightedVolumeId(null);
      // Se quita el resaltado de la URL: elegir de nuevo el mismo lapso (desde el buscador) vuelve a resaltarlo.
      navigate({ to: '/chronology', search: (prev) => ({ ...prev, highlight: undefined }), replace: true });
    }, 3500);

    return () => clearTimeout(clearTimer);
  }, [highlightedVolumeId, navigate]);

  // Thumbnail Inspection Modal State
  // La apertura va aparte del lapso: al cerrar, el lapso sigue montado para que el Modal corra
  // su salida (data-state=closed) y se limpia recién al terminarla (onCloseAutoFocus).
  const [inspectedVolume, setInspectedVolume] = useState<VolumeData | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { showInterludes } = useShowInterludes();
  // Vista (Detallada/Compacta): se recuerda en este dispositivo.
  const [view, setView] = useTimelineView();
  const order: TimelineOrder = 'release';
  const [zVariant] = useTimelineZVariant();

  const router = useRouter();
  // Pantalla de carga desde el toque en reproducir hasta que la serie abre el reproductor.
  const [launching, setLaunching] = useState<{ label: string; sublabel: string } | null>(null);
  const { data: libraryCollection } = useGetLibraryCollection();

  // Serie de la biblioteca por era: mediaId para reproducir y arte para el inspector.
  const seriesMediaMap = useMemo(() => {
    const map = new Map<NonNullable<VolumeData['seriesId']>, { mediaId: number; posterUrl?: string; backdropUrl?: string }>();
    const entries = getSafeCollectionEntries(libraryCollection);
    for (const entry of entries) {
      const tmdbId = entry.media?.tmdbId;
      if (!tmdbId) continue;
      const info = {
        mediaId: entry.mediaId,
        posterUrl: entry.media?.posterImage || undefined,
        backdropUrl: entry.media?.bannerImage || undefined,
      };
      if (tmdbId === DRAGON_BALL_SERIES.ORIGINAL) map.set('classic', info);
      else if (tmdbId === DRAGON_BALL_SERIES.SUPER) map.set('super', info);
      else if (tmdbId === DRAGON_BALL_SERIES.DAIMA) map.set('daima', info);
      else if (tmdbId === DRAGON_BALL_SERIES.GT) map.set('gt', info);
    }

    const isKaiTmdb = (tmdbId?: number) =>
      tmdbId === DRAGON_BALL_SERIES.KAI ||
      tmdbId === DRAGON_BALL_SERIES.KAI_FINAL_CHAPTERS ||
      tmdbId === 42705 ||
      tmdbId === 61709;

    let zSelected: { mediaId: number; posterUrl?: string; backdropUrl?: string } | undefined;
    if (zVariant === 'kai') {
      const kaiEntry = entries.find((e) => isKaiTmdb(e.media?.tmdbId));
      if (kaiEntry) {
        zSelected = {
          mediaId: kaiEntry.mediaId,
          posterUrl: kaiEntry.media?.posterImage || undefined,
          backdropUrl: kaiEntry.media?.bannerImage || undefined,
        };
      }
    }

    if (!zSelected) {
      const dbzEntry = entries.find((e) => e.media?.tmdbId === DRAGON_BALL_SERIES.Z);
      if (dbzEntry) {
        zSelected = {
          mediaId: dbzEntry.mediaId,
          posterUrl: dbzEntry.media?.posterImage || undefined,
          backdropUrl: dbzEntry.media?.bannerImage || undefined,
        };
      } else {
        const fallbackKai = entries.find((e) => isKaiTmdb(e.media?.tmdbId));
        if (fallbackKai) {
          zSelected = {
            mediaId: fallbackKai.mediaId,
            posterUrl: fallbackKai.media?.posterImage || undefined,
            backdropUrl: fallbackKai.media?.bannerImage || undefined,
          };
        }
      }
    }
    if (zSelected) map.set('z', zSelected);

    return map;
  }, [libraryCollection, zVariant]);

  // Lapsos con serie de la biblioteca y lore de catch-up, ordenados in-universe.
  // Adapta dinámicamente episodios y relleno si la variante Z elegida es Kai.
  const enrichedVolumes: VolumeData[] = useMemo(() => {
    return VOLUMES_DATA.map((vol) => {
      const series = vol.seriesId ? seriesMediaMap.get(vol.seriesId) : undefined;
      const mediaId = series?.mediaId ?? vol.mediaId;
      const posterUrl = series?.posterUrl || vol.posterUrl;
      const backdropUrl = series?.backdropUrl || vol.backdropUrl;
      const cacheKey = `${vol.id}|${mediaId ?? ''}|${posterUrl ?? ''}|${backdropUrl ?? ''}|${zVariant}`;
      const cached = ENRICHED_VOLUME_CACHE.get(cacheKey);
      if (cached) return cached;

      const rawSpan = DRAGON_BALL_STORY_SPANS.find((s) => s.id === vol.id);
      const isKai = zVariant === 'kai' && vol.seriesId === 'z';
      const isKaiFiller = isKai && Boolean(rawSpan?.kaiFiller);
      const kaiStart = isKai && rawSpan?.kaiStartEpisode != null ? rawSpan.kaiStartEpisode : undefined;
      const kaiEnd = isKai && rawSpan?.kaiEndEpisode != null ? rawSpan.kaiEndEpisode : undefined;

      const startEpisode = kaiStart ?? vol.startEpisode;
      const endEpisode = kaiEnd ?? vol.endEpisode;
      const episodesCount = isKaiFiller
        ? 0
        : (kaiStart != null && kaiEnd != null)
          ? (kaiEnd - kaiStart + 1)
          : vol.episodesCount;
      const episodesRange = isKaiFiller
        ? 'Omitido en Kai'
        : (kaiStart != null && kaiEnd != null)
          ? `Caps ${String(kaiStart).padStart(3, '0')} al ${String(kaiEnd).padStart(3, '0')}`
          : vol.episodesRange;
      const seriesTag = vol.seriesTag;
      const subtitle = isKaiFiller
        ? `${vol.sagaLabel} • Omitido en Kai (Relleno)`
        : isKai
          ? `${vol.sagaLabel} • ${vol.subtitle.includes('•') ? vol.subtitle.split(' • ').slice(1).join(' • ') : vol.subtitle}`
          : vol.subtitle;

      const lore = getVolumeLoreEnrichment(vol.id);
      const fillerEpisodes = isKai ? [] : (lore?.fillerEpisodes ?? vol.fillerEpisodes);
      const recommendedStartEpisode = isKaiFiller
        ? undefined
        : (kaiStart ?? lore?.recommendedStartEpisode ?? vol.recommendedStartEpisode);

      const enriched: VolumeData = {
        ...vol,
        mediaId,
        posterUrl,
        backdropUrl,
        seriesTag,
        subtitle,
        startEpisode,
        endEpisode,
        episodesCount,
        episodesRange,
        fillerEpisodes,
        recommendedStartEpisode,
        previouslyOn: lore?.previouslyOn ?? vol.previouslyOn,
        quickCatchUpKeys: lore?.quickCatchUpKeys ?? vol.quickCatchUpKeys,
      };
      ENRICHED_VOLUME_CACHE.set(cacheKey, enriched);
      return enriched;
    }).sort(compareInUniverse);
  }, [seriesMediaMap, zVariant]);

  // Avance por lapso (historial + marcas manuales), guardado en el servidor.
  const {
    progressById,
    readVolumeIds,
    handleToggleRead,
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
      const handle = window.requestIdleCallback(run, { timeout: 6000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(run, 3500);
    return () => clearTimeout(timer);
  }, [enrichedVolumes, preloadSeries]);

  // Playback navigation handler directly from chronology to player/series/movies
  const handlePlayVolume = useCallback(
    (vol: VolumeData, targetEpisodeNum?: number, momentInfo?: MomentPlayInfo) => {
      // Serie de TV
      const resolvedEp = targetEpisodeNum ?? vol.recommendedStartEpisode ?? vol.startEpisode ?? 1;
      if (vol.mediaId) {
        setLaunching({ label: `Preparando el episodio ${resolvedEp}`, sublabel: momentInfo?.title || vol.title });
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
          description: 'Revisa tus carpetas en Ajustes › Biblioteca.',
        });
      }
    },
    [navigate]
  );

  // Sync URL search params with era and search query (solo cuando difieren de la URL actual)
  useEffect(() => {
    const currentEra = searchParams.era;
    const currentQ = searchParams.q ?? '';
    const targetEra = eraFilter !== 'all' ? eraFilter : undefined;
    const targetQ = searchQuery.trim() || undefined;

    // Evitar navegación redundante y llamada a history.replaceState si ya está sincronizado
    if (currentEra === targetEra && currentQ === (targetQ ?? '')) {
      return;
    }

    navigate({
      to: '/chronology',
      search: (prev) => ({
        ...prev,
        era: targetEra,
        q: targetQ,
      }),
      replace: true,
    });
  }, [eraFilter, searchQuery, searchParams.era, searchParams.q, navigate]);

  // Avance por era y global (lapsos y episodios): alimenta el tramo relleno de la barra de eras.
  const eraProgress = useMemo(
    () => computeEraBar(enrichedVolumes, progressById) as Record<EraFilter, EraProgress>,
    [enrichedVolumes, progressById]
  );

  // Lapsos en el orden de estreno de cada serie.
  const orderedVolumes = useMemo(() => [...enrichedVolumes].sort(compareRelease), [enrichedVolumes]);

  // Maratón desde un lapso: arma Mi Lista (pregunta antes de tocar una Mi Lista con contenido).
  const { startMarathon, busyId: marathonBusyId, pending: pendingMarathon, resolvePending } = useMarathonFromHere(orderedVolumes, progressById);

  // Filter volumes by Era and Search query
  const matchingVolumes = useMemo(() => {
    return orderedVolumes.filter((vol) => {
      // 1. Era filter
      if (eraFilter !== 'all' && ERA_BY_SERIES_TAG[vol.seriesTag] !== eraFilter) return false;

      // 2. Search query (passive from URL if provided)
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
  }, [orderedVolumes, eraFilter, searchQuery]);

  // Neutro: el color de saga queda como identidad del contenido; el cromo va en grises.
  const isClassic = useIsClassicMode();
  const filteredVolumes = useMemo(
    () => (isClassic ? matchingVolumes.map(neutralizeVolume) : matchingVolumes),
    [isClassic, matchingVolumes]
  );
  const eraGroups = useMemo(() => groupVolumesByEra(filteredVolumes), [filteredVolumes]);

  // Era visible al desplazarse: la barra de eras resalta esa y no la del filtro.
  const sectionIds = useMemo(
    () => eraGroups.map((g) => sectionIdForEra(ERA_FILTER_BY_SERIES[g.seriesId])),
    [eraGroups]
  );
  // El espía de eras arranca cuando las secciones ya existen (el estado de la lista está arriba).
  const spySectionId = useSectionSpy(listMounted ? sectionIds : NO_SECTIONS);
  const spyEraId: EraFilter | undefined = eraOfSectionId(spySectionId) ?? undefined;

  // Cambiar el filtro y asegurar que la vista comience al tope del contenido de la era elegida.
  const applyEraFilter = useCallback(
    (next: EraFilter) => {
      setEraFilter(next);
      const scroller = document.getElementById('main-content');
      if (scroller) {
        scroller.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    },
    [reduceMotion]
  );

  // Al cambiar de era elegida (o volver a todas), asegura que el scroll quede al inicio del nuevo contenido
  useEffect(() => {
    const scroller = document.getElementById('main-content');
    if (scroller && scroller.scrollTop > 0) {
      scroller.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }, [eraFilter, reduceMotion]);

  /**
   * Barra de eras: tocar una era filtra la línea de tiempo a esa era y comienza desde el primer lapso.
   * "Todas" vuelve a la línea completa desde el inicio.
   */
  const handleSelectEra = useCallback(
    (era: EraFilter) => {
      applyEraFilter(era);
    },
    [applyEraFilter]
  );

  /** Botón de la cabecera de cada era: ver solo esa era o volver a todas. */
  const handleToggleSoloEra = useCallback(
    (era: EraKey) => {
      applyEraFilter(eraFilter === 'all' ? era : 'all');
    },
    [eraFilter, applyEraFilter]
  );


  const inspectedIndex = useMemo(() => {
    if (!inspectedVolume) return -1;
    return filteredVolumes.findIndex((v) => v.id === inspectedVolume.id);
  }, [inspectedVolume, filteredVolumes]);

  const handlePrevVolume = useCallback(() => {
    if (inspectedIndex > 0) {
      setInspectedVolume(filteredVolumes[inspectedIndex - 1]);
    }
  }, [inspectedIndex, filteredVolumes]);

  const handleNextVolume = useCallback(() => {
    if (inspectedIndex >= 0 && inspectedIndex < filteredVolumes.length - 1) {
      setInspectedVolume(filteredVolumes[inspectedIndex + 1]);
    }
  }, [inspectedIndex, filteredVolumes]);

  const { capture: captureInspectorFocus, restore: restoreInspectorFocus } = useInspectorFocusReturn();
  const handleCloseInspectorAutoFocus = useCallback((event: Event) => {
    restoreInspectorFocus(event);
    setInspectedVolume(null);
  }, [restoreInspectorFocus]);

  const handleOpenInspector = useCallback((vol: VolumeData) => {
    captureInspectorFocus(vol.id);
    setInspectedVolume(vol);
    setInspectorOpen(true);
  }, [captureInspectorFocus]);
  const handleVolumeIntent = useCallback((vol: VolumeData) => preloadSeries(vol.mediaId), [preloadSeries]);

  // Keyboard navigation: j/k move, Enter plays, v toggles watched
  // j/k parten del resaltado o, si ya se apagó, del cursor, y hacen el scroll en el acto:
  // suave solo con el tier "full"; con TV, hardware bajo o movimiento reducido, inmediato.
  const motionTier = useMotionTier();
  useEffect(() => {
    const moveKeyboardCursor = (step: 1 | -1) => {
      const anchorId = highlightedVolumeId ?? keyboardCursorRef.current;
      const currentIdx = filteredVolumes.findIndex((v) => v.id === anchorId);
      const targetIdx =
        step === 1
          ? (currentIdx < filteredVolumes.length - 1 ? currentIdx + 1 : 0)
          : (currentIdx > 0 ? currentIdx - 1 : filteredVolumes.length - 1);
      const targetVol = filteredVolumes[targetIdx];
      if (!targetVol) return;
      keyboardCursorRef.current = targetVol.id;
      setHighlightedVolumeId(targetVol.id);
      // 'start' + el scroll-margin del nodo: la tarjeta queda entera debajo de la barra superior.
      document.getElementById(`timeline-node-${targetVol.id}`)?.scrollIntoView({
        behavior: motionTier === 'full' ? 'smooth' : 'auto',
        block: 'start',
      });
    };

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
        moveKeyboardCursor(1);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        moveKeyboardCursor(-1);
      } else if (e.key === 'v' || e.key === 'V') {
        if (highlightedVolumeId) {
          e.preventDefault();
          handleToggleRead(highlightedVolumeId);
        }
      } else if (e.key === 'Enter') {
        if (highlightedVolumeId) {
          const targetVol = filteredVolumes.find((v) => v.id === highlightedVolumeId);
          if (targetVol) {
            e.preventDefault();
            handlePlayVolume(targetVol);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredVolumes, highlightedVolumeId, handleToggleRead, handlePlayVolume, motionTier]);

  // Vacío y error entran con el preset canónico (guía §5.7).
  const emptyStateSpring = useSpringPreset('entrance');
  // Colores de cada era tal como los usa la línea de tiempo (Neutro los apaga) y salto desde el eje de años.
  const yearScaleAccents = useMemo(() => accentByEraFrom(filteredVolumes), [filteredVolumes]);
  const handleJumpToScaleVolume = useCallback(
    (volumeId: string) => scrollToSection(`timeline-node-${volumeId}`, !reduceMotion),
    [reduceMotion]
  );

  return (
    <div className="neutro-sentence relative min-h-screen text-on-surface overflow-x-hidden selection:bg-brand-accent/30 font-sans">
      {/* Fondo cinematográfico inmersivo de la cronología con aura y transición de eras */}
      <ChronologyBackdrop eraFilter={spyEraId ?? eraFilter} />

      {/* Cuánto de la línea de tiempo se recorrió (página muy larga). */}
      <ScrollProgress />
      <div className="relative z-10 flex flex-col">
        {/* Simplified Header with independent Era Chips */}
        <Header
          currentEraFilter={eraFilter}
          onSelectEraFilter={handleSelectEra}
          spyEraId={eraFilter === 'all' ? spyEraId : undefined}
          eraProgress={eraProgress}
          order={order}
          actions={
            <TimelineControls
              view={view}
              onViewChange={setView}
            />
          }
        />

        {/* La línea de tiempo queda en una columna de lectura */}
        <div className="page-container space-y-4 pt-4 pb-8 relative">
          {/* Eje de años con escala real (cuando no hay búsqueda activa y hay lapsos) */}
          {!searchQuery && filteredVolumes.length > 1 && (
            <YearScale
              volumes={filteredVolumes}
              accentByEra={yearScaleAccents}
              onJumpToVolume={handleJumpToScaleVolume}
              className="mb-2"
            />
          )}

          {/* Main Single-Focus Content: The Alternating Timeline */}
          <DeferredMount
            heightKey="chronology-list"
            fallbackHeight="70vh"
            immediate={!deferList}
            onMount={handleListMounted}
          >
          <AnimatePresence initial={false}>
          <m.div
            // Al cambiar de era o vista la lista entra con un fundido corto, solo de opacidad
            // (--duration-quick y --ease-out): el desplazamiento lo dan las filas, sin doble entrada.
            // `initial={false}` en AnimatePresence: la primera vez no anima, y con movimiento reducido tampoco.
            key={`${view}|${eraFilter}|${zVariant}`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 w-full py-2 flex flex-col gap-6"
          >
            {filteredVolumes.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center px-4">
                <m.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={emptyStateSpring}
                  className="glass-card rounded-3xl p-8 max-w-md w-full text-center border border-[var(--glass-border-side)] shadow-elevation-2 space-y-3"
                >
                  <h3 className="font-display text-lg font-bold text-on-surface">Sin resultados</h3>
                  <p className="text-sm text-label-2">
                    No hay lapsos para los filtros elegidos
                    {searchQuery && ` con la búsqueda «${searchQuery}»`}.
                  </p>
                  <div className="pt-2">
                    <Button intent="primary" onClick={() => { applyEraFilter('all'); }}>
                      Restablecer filtros
                    </Button>
                  </div>
                </m.div>
              </div>
            ) : (
              <>
                {view === 'compact' ? (
                  <CompactTimeline
                    volumes={filteredVolumes}
                    order={order}
                    progressById={progressById}
                    readVolumeIds={readVolumeIds}
                    showInterludes={showInterludes}
                    highlightedVolumeId={highlightedVolumeId}
                    eraFilter={eraFilter}
                    onOpenVolume={handleOpenInspector}
                    onPlayVolume={handlePlayVolume}
                    onToggleSoloEra={handleToggleSoloEra}
                  />
                ) : (
              <AlternatingTimeline
                order={order}
                volumes={filteredVolumes}
                readVolumeIds={readVolumeIds}
                progressById={progressById}
                serverMomentTimes={serverMomentTimes}
                onToggleRead={handleToggleRead}
                showInterludes={showInterludes}
                onInspectThumbnail={handleOpenInspector}
                onPlayVolume={handlePlayVolume}
                onVolumeIntent={handleVolumeIntent}
                onMarathon={startMarathon}
                marathonBusyId={marathonBusyId}
                highlightedVolumeId={highlightedVolumeId}
                searchQuery={searchQuery}
                eraFilter={eraFilter}
                onToggleSoloEra={handleToggleSoloEra}
              />
                )}
              </>
            )}
          </m.div>
          </AnimatePresence>
          </DeferredMount>

          {/* Modal Inspector for Full Artwork View */}
          {inspectedVolume && (
              <React.Suspense fallback={null}>
                <VolumeInspectorModal
                  volume={inspectedVolume}
                  isOpen={inspectorOpen}
                  onClose={() => setInspectorOpen(false)}
                  onCloseAutoFocus={handleCloseInspectorAutoFocus}
                  onPlayVolume={handlePlayVolume}
                  hasPrev={inspectedIndex > 0}
                  hasNext={inspectedIndex >= 0 && inspectedIndex < filteredVolumes.length - 1}
                  onPrevVolume={handlePrevVolume}
                  onNextVolume={handleNextVolume}
                />
              </React.Suspense>
          )}

          <MarathonDialog
            open={pendingMarathon !== null}
            existingCount={pendingMarathon?.existingCount ?? 0}
            episodeCount={pendingMarathon?.plan.items.length ?? 0}
            onChoose={resolvePending}
          />

          {launching && <PlayerFallback label={launching.label} sublabel={launching.sublabel} />}

          {/* Clean, Minimalist Footer */}
          <footer className="border-t border-[var(--neutral-separator)] bg-transparent py-5 px-4 text-center text-xs text-label-2">
            <div className="page-container flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-semibold">Dragon Ball: línea de tiempo oficial</span>
              <span className="text-label-3 tabular-nums">Por sagas y lapsos · años 749–790 · {enrichedVolumes.length} lapsos · Basada en la obra de Akira Toriyama</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
