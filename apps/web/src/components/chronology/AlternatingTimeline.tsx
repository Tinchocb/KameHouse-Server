import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from 'react';
import { m, AnimatePresence, type Transition } from 'framer-motion';
import type { EraFilter, VolumeData } from './types';
import { ERA_FILTER_BY_SERIES, type EraKey } from './data/eraBar';
import { AIR_YEARS_BY_ERA, type TimelineOrder } from './data/releaseOrder';
import { formatEpisodeRange } from './data/cardModel';
import { TimelineVolumeCard } from './TimelineVolumeCard';
import { TimelineCardSkeleton } from './TimelineCardSkeleton';
import { ContralateralDetailsCard, type DetailTab } from './ContralateralDetailsCard';
import { EraHero } from './EraHero';
import { InterludeDivider } from './InterludeDivider';
import { type MomentPlayInfo } from './types';
import { groupVolumesByEra, formatYearShort } from './data/spansToVolumes';
import type { SpanProgress } from './data/spanProgress';
import { CHRONOLOGY_INTERLUDES } from './data/interludes';
import { eraTextChannels, eraTextColor, hexToRgbChannels } from './utils/eraColor';
import { useMotionTier, useReducedMotion } from '@/components/ui/kinetics/hooks';
import { PresenceSurface } from '@/components/ui/kinetics/presence-surface';
import { useNearViewport } from './utils/useNearViewport';
import { useIsClassicMode, useIsMinimalistMode } from '@/lib/theme/use-classic-mode';
import { CheckCircle2 } from 'lucide-react';

interface AlternatingTimelineProps {
  volumes: VolumeData[];
  readVolumeIds: Set<string>;
  /** Avance por lapso (historial + marcas manuales). */
  progressById?: ReadonlyMap<string, SpanProgress>;
  /** Mostrar los separadores de interludio entre lapsos (preferencia de la página). */
  showInterludes: boolean;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  /** Se llama al apuntar o enfocar una tarjeta: momento para precargar lo que haría falta al reproducir. */
  onVolumeIntent?: (volume: VolumeData) => void;
  /** Maratón desde este lapso hasta el final de la era (arma Mi Lista). */
  onMarathon?: (volume: VolumeData) => void;
  /** Lapso para el que se están buscando los archivos del maratón. */
  marathonBusyId?: string | null;
  highlightedVolumeId?: string | null;
  searchQuery?: string;
  /** Filtro de era vigente: la cabecera de cada era ofrece ver solo esa o volver a todas. */
  eraFilter?: EraFilter;
  onToggleSoloEra?: (era: EraKey) => void;
  /** Cronológico (por la historia) o de estreno: el de estreno no usa años del universo ni interludios. */
  order?: TimelineOrder;
}

export const AlternatingTimeline: React.FC<AlternatingTimelineProps> = memo(({
  volumes,
  readVolumeIds,
  progressById,
  showInterludes,
  onInspectThumbnail,
  onPlayVolume,
  onVolumeIntent,
  onMarathon,
  marathonBusyId = null,
  highlightedVolumeId,
  searchQuery = '',
  eraFilter = 'all',
  onToggleSoloEra,
  order = 'chronological',
}) => {
  const isClassic = useIsClassicMode();
  const reduceMotion = useReducedMotion();
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null);
  const [volumeDetailTabs, setVolumeDetailTabs] = useState<Record<string, DetailTab>>({});

  const handleToggleDetails = useCallback((volumeId: string) => {
    setOpenDetailsId((prev) => (prev === volumeId ? null : volumeId));
  }, []);

  const handleDetailTabChange = useCallback((volumeId: string, tab: DetailTab) => {
    setVolumeDetailTabs((prev) => ({ ...prev, [volumeId]: tab }));
  }, []);

  // Group volumes by Era (Classic -> Z -> Daima -> Super -> GT)
  const eraGroups = useMemo(() => groupVolumesByEra(volumes), [volumes]);

  const volumesByEra = useMemo(
    () => eraGroups.map((eraGroup) => eraGroup.sagas.flatMap((s) => s.volumes)),
    [eraGroups],
  );

  // Posición global de cada lapso para alternar izquierda/derecha entre eras
  const globalIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of eraGroups) {
      for (const saga of group.sagas) for (const v of saga.volumes) map.set(v.id, map.size);
    }
    return map;
  }, [eraGroups]);

  // En la vista Detallada las tarjetas están expandidas por defecto (sin saltos de altura durante el scroll).
  // En vez de mutar alturas al scrollear, se mantiene un Set de colapsadas a mano si el usuario cierra alguna con 'x' o Esc.
  const [userCollapsedIds, setUserCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());

  const expand = useCallback((id: string) => {
    setUserCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: string) => {
    setUserCollapsedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setUserCollapsedIds(new Set(volumes.map((v) => v.id)));
  }, [volumes]);

  const isFocusedVolume = useCallback(
    (id: string) => !userCollapsedIds.has(id),
    [userCollapsedIds]
  );

  // Escape pliega las tarjetas abiertas
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Un Escape que ya cerró otra cosa (diálogo, menú, select de Radix: llaman preventDefault) no es para las tarjetas
      if (e.defaultPrevented) return;
      // Ignorar si el usuario está escribiendo en un input, textarea o modal de búsqueda
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true') {
        return;
      }
      // ...ni el que se aprieta con el foco dentro de un diálogo, menú o lista desplegable
      if (document.activeElement?.closest('[role="dialog"],[role="menu"],[role="listbox"],[aria-modal="true"]')) return;

      if (e.key === 'Escape') collapseAll();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapseAll]);

  // Interludes mapping
  const interludeMap = useMemo(() => {
    const map = new Map<string, (typeof CHRONOLOGY_INTERLUDES)[number]>();
    for (const il of CHRONOLOGY_INTERLUDES) {
      if (il.toVolumeId) map.set(`${il.fromVolumeId}::${il.toVolumeId}`, il);
    }
    return map;
  }, []);

  const epilogue = useMemo(
    () => CHRONOLOGY_INTERLUDES.find((il) => il.toVolumeId === null),
    []
  );

  const hasActiveSearch = Boolean(searchQuery && searchQuery.trim().length > 0);
  const showInterludeDividers = showInterludes && !hasActiveSearch && order === 'chronological';

  if (volumes.length === 0) {
    return (
      <div className="w-full py-16 text-center flex flex-col items-center justify-center gap-2">
        <p className="font-display font-bold text-base text-on-surface">
          No se encontraron lapsos en la línea de tiempo
        </p>
        <p className="text-xs text-label-2">
          Prueba con otra búsqueda o con otra era.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-6 py-2">
      {/* 2. Main Timeline: Era Groups with Alternating Spines */}
      <div className="flex flex-col w-full">
        {eraGroups.map((eraGroup, eraIndex) => {
          const prevAccent = eraIndex > 0 ? eraGroups[eraIndex - 1].accentHex : null;
          const eraVolumes = volumesByEra[eraIndex];
          const eraReadCount = eraVolumes.filter((v) => readVolumeIds.has(v.id)).length;

          return (
            <section
              key={`era-section-${eraGroup.seriesId}`}
              id={`era-section-${eraGroup.seriesId}`}
              className="relative isolate w-full flex flex-col scroll-mt-28"
              aria-label={`Era ${eraGroup.seriesTag}`}
            >
              {/* Hilo entre eras: el eje pasa del color de la era que termina al de la que empieza */}
              {prevAccent && (
                <div aria-hidden="true" className="relative h-16">
                  <div
                    className="absolute inset-y-0 left-3 lg:left-1/2 w-0.5 -translate-x-1/2"
                    style={{
                      background: isClassic
                        ? 'var(--neutral-separator)'
                        : `linear-gradient(to bottom, ${prevAccent}40, ${eraGroup.accentHex})`,
                    }}
                  />
                </div>
              )}

              {/* Era Hero Banner */}
              <EraHero
                seriesId={eraGroup.seriesId}
                seriesTag={eraGroup.seriesTag}
                yearsLabel={order === 'release' ? `Emitida en ${AIR_YEARS_BY_ERA[ERA_FILTER_BY_SERIES[eraGroup.seriesId]]}` : eraGroup.yearsLabel}
                accentHex={eraGroup.accentHex}
                totalVolumes={eraVolumes.length}
                readVolumes={eraReadCount}
                isSolo={eraFilter !== 'all'}
                onToggleSolo={onToggleSoloEra ? () => onToggleSoloEra(ERA_FILTER_BY_SERIES[eraGroup.seriesId]) : undefined}
                className={prevAccent ? 'mt-0' : ''}
              />

              {/* Spine Area for this Era */}
              <div className="relative w-full flex flex-col">
                {/* Central Spine Axis Line on lg+ */}
                <div
                  aria-hidden="true"
                  className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 pointer-events-none"
                  style={{
                    background: isClassic
                      ? 'var(--neutral-separator)'
                      : `linear-gradient(to bottom, ${eraGroup.accentHex}90, ${eraGroup.accentHex}30 85%, transparent)`,
                    boxShadow: isClassic ? 'none' : `0 0 12px ${eraGroup.accentHex}40`,
                  }}
                />

                {/* Left Spine Axis Line on < lg */}
                <div
                  aria-hidden="true"
                  className="lg:hidden absolute left-3 top-0 bottom-0 w-0.5 bg-white/10 pointer-events-none"
                />

                {/* Alternating Spans grouped by Saga */}
                {eraGroup.sagas.map((saga) => (
                  <div
                    key={`${eraGroup.seriesId}-${saga.sagaId}`}
                    className="relative z-10 my-4 rounded-2xl border px-3 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4"
                    style={{
                      borderColor: isClassic ? 'var(--neutral-separator)' : `${eraGroup.accentHex}38`,
                      backgroundColor: 'color-mix(in srgb, var(--neutral-elev-1) 72%, transparent)',
                      backgroundImage: isClassic
                        ? 'none'
                        : `linear-gradient(155deg, ${eraGroup.accentHex}14, transparent 22rem)`,
                    }}
                  >
                    <div
                      className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5"
                      style={{ borderColor: isClassic ? 'var(--neutral-separator)' : `${eraGroup.accentHex}26` }}
                    >
                      <h3 className="font-display text-base font-black tracking-tight text-on-surface">
                        {saga.sagaName}
                      </h3>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: isClassic ? undefined : eraGroup.accentHex }}
                      >
                        {saga.volumes.length} {saga.volumes.length === 1 ? 'lapso' : 'lapsos'}
                      </span>
                    </div>
                    {saga.volumes.map((vol) => {
                      const eraIdx = eraVolumes.indexOf(vol);
                      const prevVol = eraIdx > 0 ? eraVolumes[eraIdx - 1] : null;
                      const interlude = showInterludeDividers && prevVol ? interludeMap.get(`${prevVol.id}::${vol.id}`) : undefined;
                      const globalIndex = globalIndexById.get(vol.id) ?? 0;
                      const progress = progressById?.get(vol.id);

                      return (
                        <TimelineRow
                          key={vol.id}
                          volume={vol}
                          accentHex={eraGroup.accentHex}
                          interlude={interlude}
                          globalIndex={globalIndex}
                          order={order}
                          totalVolumes={volumes.length}
                          isRead={readVolumeIds.has(vol.id)}
                          isHighlighted={vol.id === highlightedVolumeId}
                          isFocused={isFocusedVolume(vol.id)}
                          hasAnyFocus={userCollapsedIds.size < volumes.length}
                          onFocusCard={expand}
                          onCollapseCard={collapse}
                          isDetailsOpen={openDetailsId === vol.id}
                          activeDetailTab={volumeDetailTabs[vol.id] ?? 'conflicto'}
                          progressPercent={progress?.percent ?? 0}
                          nextEpisode={progress?.nextEpisode}
                          seenEpisodes={progress?.seenEpisodes}
                          reduceMotion={Boolean(reduceMotion)}
                          onInspectThumbnail={onInspectThumbnail}
                          onPlayVolume={onPlayVolume}
                          onVolumeIntent={onVolumeIntent}
                          onMarathon={onMarathon}
                          marathonBusy={marathonBusyId === vol.id}
                          onToggleDetails={handleToggleDetails}
                          onDetailTabChange={handleDetailTabChange}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Global Epilogue (if present and interludes are on) */}
        {showInterludeDividers && epilogue && (
          <InterludeDivider interlude={epilogue} toVolume={null} />
        )}
      </div>
    </div>
  );
});

AlternatingTimeline.displayName = 'AlternatingTimeline';

/** Tiempo (ms) que una fila con la tarjeta recién abierta o plegada se dibuja aunque esté lejos de la pantalla. */
const LAYOUT_SETTLE_MS = 1200;

/** Filas que se arman de entrada: solo el primer lapso visible para garantizar 60 fps en la animación de entrada. */
const EAGER_ROWS = 1;

/**
 * Lapsos que ya hicieron su entrada en la sesión. La fila se suelta al alejarse y se vuelve a montar al
 * acercarse, y la lista entera se rearma al cambiar vista, orden o era (cambia su `key`): un Set de
 * módulo sobrevive a todo eso; uno en un ref de la lista se perdería con cada cambio de era.
 */
const revealedRows = new Set<string>();

/** Primera entrada: fundido y ascenso corto (--duration-base, --ease-smooth-out). */
const FIRST_ENTRANCE: Transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] };
/** Primera entrada en Minimalista: respuesta contenida sin recorrido largo. */
const FIRST_ENTRANCE_MINIMAL: Transition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] };
/** Lapso ya visto: solo un fundido corto (--duration-quick, --ease-out) que tapa el cambio de esqueleto a tarjeta. */
const REPEAT_ENTRANCE: Transition = { duration: 0.15, ease: [0.23, 1, 0.32, 1] };

interface CardEntranceProps {
  volumeId: string;
  delay: number;
  reduceMotion: boolean;
  className: string;
  onIntent: () => void;
  children: React.ReactNode;
}

/**
 * Envoltorio de la tarjeta con la entrada al aparecer con el scroll. Solo opacidad y transform: no
 * cambia ni el orden ni el alto de la fila.
 */
function CardEntrance({ volumeId, delay, reduceMotion, className, onIntent, children }: CardEntranceProps) {
  const isMinimalist = useIsMinimalistMode();
  // Se lee una vez, al montar la tarjeta: el Set cambia por fuera de React y solo importa la pose inicial.
  const [seen] = useState(() => revealedRows.has(volumeId));
  // Con tier "full" la tarjeta sube 16 px al entrar; en "subtle" (hardware justo) solo se funde.
  const rise = useMotionTier() === 'full' ? 16 : 0;
  const firstTransition = isMinimalist ? FIRST_ENTRANCE_MINIMAL : FIRST_ENTRANCE;
  return (
    <m.div
      initial={reduceMotion ? { opacity: 1 } : seen ? { opacity: 0 } : { opacity: 0, y: rise }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      onViewportEnter={() => revealedRows.add(volumeId)}
      onPointerEnter={onIntent}
      onFocusCapture={onIntent}
      transition={seen ? REPEAT_ENTRANCE : { ...firstTransition, delay }}
      className={className}
    >
      {children}
    </m.div>
  );
}

/** Alto (márgenes incluidos) de cada divisor de interludio la última vez que se montó colapsado. */
const interludeHeights = new Map<string, number>();
/** Alto del hueco de un divisor que todavía no se montó: el de uno colapsado en escritorio (103 px medidos). */
const INTERLUDE_FALLBACK_PX = 103;

interface InterludeSlotProps {
  interlude: (typeof CHRONOLOGY_INTERLUDES)[number];
  toVolume: VolumeData;
  accentHex: string;
  /** La fila está cerca de la pantalla: solo entonces se monta el divisor. */
  mounted: boolean;
}

/**
 * Divisor de interludio de una fila. Como la fila, solo se monta cerca de la pantalla: lejos deja un hueco
 * del mismo alto (medido en su último montaje colapsado), así el scroll no salta al armarse o soltarse.
 */
function InterludeSlot({ interlude, toVolume, accentHex, mounted }: InterludeSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Se mide al montar, cuando el divisor todavía está colapsado: un expandido no define el hueco.
  useLayoutEffect(() => {
    if (mounted && ref.current) interludeHeights.set(interlude.id, ref.current.offsetHeight);
  }, [mounted, interlude.id]);
  return (
    <div ref={ref} data-interlude-slot={interlude.id} style={mounted ? undefined : { height: interludeHeights.get(interlude.id) ?? INTERLUDE_FALLBACK_PX }}>
      {mounted && <InterludeDivider interlude={interlude} toVolume={toVolume} accentHex={accentHex} />}
    </div>
  );
}

interface TimelineRowProps {
  volume: VolumeData;
  accentHex: string;
  /** Interludio que va antes de esta fila (ya filtrado por la preferencia y la búsqueda). */
  interlude?: (typeof CHRONOLOGY_INTERLUDES)[number];
  globalIndex: number;
  order: TimelineOrder;
  totalVolumes: number;
  isRead: boolean;
  isHighlighted: boolean;
  isFocused: boolean;
  hasAnyFocus: boolean;
  onFocusCard: (volumeId: string) => void;
  onCollapseCard: (volumeId: string) => void;
  isDetailsOpen: boolean;
  activeDetailTab: DetailTab;
  progressPercent: number;
  nextEpisode?: number;
  seenEpisodes?: number[];
  reduceMotion: boolean;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  onVolumeIntent?: (volume: VolumeData) => void;
  onMarathon?: (volume: VolumeData) => void;
  marathonBusy: boolean;
  onToggleDetails: (volumeId: string) => void;
  onDetailTabChange: (volumeId: string, tab: DetailTab) => void;
}

/**
 * Una fila de la línea de tiempo. Memo por fila: abrir detalles o cambiar el resaltado re-renderiza
 * solo las filas afectadas. Hasta acercarse a la pantalla reserva su alto sin armar la tarjeta, así
 * abrir la página no monta 40 tarjetas con cientos de miniaturas de golpe.
 */
const TimelineRow = memo(function TimelineRow({
  volume,
  accentHex,
  interlude,
  globalIndex,
  order,
  totalVolumes,
  isRead,
  isHighlighted,
  isFocused,
  hasAnyFocus,
  onFocusCard,
  onCollapseCard,
  isDetailsOpen,
  activeDetailTab,
  progressPercent,
  nextEpisode,
  seenEpisodes,
  reduceMotion,
  onInspectThumbnail,
  onPlayVolume,
  onVolumeIntent,
  onMarathon,
  marathonBusy,
  onToggleDetails,
  onDetailTabChange,
}: TimelineRowProps) {
  const isClassic = useIsClassicMode();
  const isMinimalist = useIsMinimalistMode();
  const rowRef = useRef<HTMLDivElement>(null);
  const isEager = globalIndex < EAGER_ROWS;
  // Armada al acercarse y suelta al alejarse mucho; abierta con detalles o resaltada no se suelta (perdería su estado interactivo).
  const near = useNearViewport(rowRef, isEager, { release: true, keep: isDetailsOpen || isHighlighted });
  // Un salto por teclado o deep-link arma la fila destino aunque esté lejos.
  const [forced, setForced] = useState(false);
  if (isHighlighted && !forced) setForced(true);
  const mounted = near || forced;

  // Con `content-visibility:auto` una fila salteada (lejos de la pantalla) no recalcula su alto: abrir o plegar su
  // tarjeta ahí dejaría el alto viejo hasta que el navegador vuelva a dibujarla, y ese salto caería sobre lo que se
  // mira. Tras cada cambio la fila se dibuja entera un rato, así el alto se actualiza junto con el cambio y el scroll
  // lo compensa en el mismo cuadro; al volver a `auto` recuerda el alto nuevo.
  const [cardWasFocused, setCardWasFocused] = useState(isFocused);
  const [layoutSettling, setLayoutSettling] = useState(false);
  if (isFocused !== cardWasFocused) {
    setCardWasFocused(isFocused);
    setLayoutSettling(true);
  }
  useEffect(() => {
    if (!layoutSettling) return;
    const timer = setTimeout(() => setLayoutSettling(false), LAYOUT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [layoutSettling, isFocused]);

  const isLeft = globalIndex % 2 === 0;
  const yearFormatted = formatYearShort(volume.officialYear);
  // "762 (Noviembre)" → año grande y la precisión aparte, en chico.
  const yearParts = /^(.*?)\s*\((.+)\)$/.exec(yearFormatted);
  // En el orden de estreno no hay año del universo: el costado muestra los episodios del lapso.
  const isRelease = order === 'release';
  const yearMain = isRelease ? `Ep. ${formatEpisodeRange(volume)}` : (yearParts?.[1] ?? yearFormatted);
  const yearNote = isRelease ? undefined : yearParts?.[2];
  // Las primeras filas visibles entran escalonadas (máx. 120 ms); el resto entra directo al aparecer en scroll.
  const entranceDelay = !reduceMotion && !isMinimalist && globalIndex < 4 ? globalIndex * 0.04 : 0;

  return (
    <>
      {/* Optional Interlude Divider */}
      {interlude && <InterludeSlot interlude={interlude} toVolume={volume} accentHex={accentHex} mounted={mounted} />}

      {/* Span Row Container: espaciado suave y amortiguado */}
      <div
        ref={rowRef}
        id={`timeline-node-${volume.id}`}
        tabIndex={-1}
        // Color de la sección: en Por era los nodos de la línea central lo toman (themes/era.css).
        style={{ '--era': hexToRgbChannels(accentHex), '--era-text': eraTextChannels(accentHex) } as React.CSSProperties}
        className={`relative w-full flex items-start group scroll-mt-28 transition-[margin] duration-base ease-smooth-out motion-reduce:transition-none ${layoutSettling ? '[content-visibility:visible]' : '[content-visibility:auto]'} ${
          isFocused ? 'my-3 sm:my-3.5 lg:my-4 [contain-intrinsic-size:auto_340px]' : 'my-2 sm:my-2.5 lg:my-2.5 [contain-intrinsic-size:auto_88px]'
        }`}
      >
        {mounted ? (
          <>
            {/* Mobile spine node (< lg) centered on axis line */}
            <div
              data-state={isHighlighted || isFocused ? 'active' : isRead ? 'read' : 'idle'}
              className={`chrono-spine-node lg:hidden absolute left-3 -translate-x-1/2 top-2.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 transition-transform duration-fast ease-out-strong ${
                isHighlighted || isFocused
                  ? 'bg-brand-accent border-white text-on-primary font-black scale-110 shadow-elevation-2'
                  : isRead
                    ? 'bg-status-success border-status-success text-black'
                    : 'bg-[var(--neutral-elev-1)] border-[var(--neutral-separator)] text-brand-accent shadow-[shadow:var(--double-bezel-ring)]'
              }`}
            >
              {isRead && !isFocused ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              ) : (
                <span className="font-kanji font-black text-2xs leading-none text-inherit">
                  {volume.coverArt.symbolGlyph || '亀'}
                </span>
              )}
            </div>

            {/* Desktop central spine node (lg+) */}
            <div
              data-state={isHighlighted || isFocused ? 'active' : isRead ? 'read' : 'idle'}
              className={`chrono-spine-node hidden lg:flex absolute left-1/2 -translate-x-1/2 top-6 w-8 h-8 rounded-full border-2 items-center justify-center z-10 transition-[transform,background-color,border-color,box-shadow] duration-base ease-smooth-out shadow-elevation-1 ${
                isHighlighted || isFocused
                  ? 'bg-brand-accent border-white text-on-primary font-black scale-110 shadow-elevation-3'
                  : isRead
                    ? 'bg-status-success border-status-success text-black scale-90 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-95'
                    : 'bg-[var(--neutral-elev-1)] border-[var(--neutral-separator)] text-brand-accent shadow-[shadow:var(--double-bezel-ring)] scale-90 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-95 [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-brand-accent/60'
              }`}
            >
              {isRead && !isFocused ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              ) : (
                <span className="font-kanji font-black text-xs leading-none text-inherit">
                  {volume.coverArt.symbolGlyph || '亀'}
                </span>
              )}
            </div>

            {/* Desktop horizontal stem connecting central node to card (compacto: w-8) */}
            <div
              aria-hidden="true"
              className={`hidden lg:block absolute top-10 h-px pointer-events-none transition-[transform,opacity] duration-base ease-smooth-out ${
                isFocused ? 'translate-y-0' : '-translate-y-1.5'
              } ${
                isDetailsOpen || isFocused ? 'opacity-100' : 'opacity-35 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-85'
              } ${
                isLeft ? 'right-1/2 w-8' : 'left-1/2 w-8'
              }`}
              style={{
                background: isClassic
                  ? 'var(--neutral-separator)'
                  : isLeft
                  ? `linear-gradient(to left, ${accentHex}, ${accentHex}20)`
                  : `linear-gradient(to right, ${accentHex}, ${accentHex}20)`,
              }}
            />

            {/* Desktop horizontal stem connecting central node to details panel when open (compacto: w-8) */}
            <AnimatePresence initial={false}>
              {isDetailsOpen && (
                <m.div
                  key={`stem-detail-${volume.id}`}
                  aria-hidden="true"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scaleX: 0 }}
                  animate={{
                    opacity: 1,
                    scaleX: 1,
                    transition: { duration: reduceMotion ? 0.08 : 0.22, ease: [0.16, 1, 0.3, 1] },
                  }}
                  exit={{
                    opacity: 0,
                    scaleX: reduceMotion ? 1 : 0,
                    transition: { duration: reduceMotion ? 0.08 : 0.14, ease: [0.22, 1, 0.36, 1] },
                  }}
                  className={`hidden lg:block absolute top-10 h-px pointer-events-none ${
                    isFocused ? 'translate-y-0' : '-translate-y-1.5'
                  } ${
                    isLeft ? 'left-1/2 w-8 origin-left' : 'right-1/2 w-8 origin-right'
                  }`}
                  style={{
                    background: isClassic
                      ? 'var(--neutral-separator)'
                      : isLeft
                      ? `linear-gradient(to right, ${accentHex}, ${accentHex}20)`
                      : `linear-gradient(to left, ${accentHex}, ${accentHex}20)`,
                  }}
                />
              )}
            </AnimatePresence>

            {/* Desktop: Columna contralateral (Lado opuesto de la tarjeta) con espaciado optimizado lg:p*-8 */}
            <div
              className={`hidden lg:flex relative flex-col lg:w-1/2 ${
                isLeft ? 'order-2 lg:pl-8' : 'order-1 lg:pr-8'
              }`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {isDetailsOpen ? (
                  <PresenceSurface
                    key={`details-${volume.id}`}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: isLeft ? 14 : -14, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      transition: { duration: reduceMotion ? 0.08 : isMinimalist ? 0.18 : 0.25, ease: [0.16, 1, 0.3, 1] },
                    }}
                    exit={{
                      opacity: 0,
                      x: reduceMotion ? 0 : isLeft ? 10 : -10,
                      scale: reduceMotion ? 1 : 0.985,
                      transition: { duration: reduceMotion ? 0.08 : 0.14, ease: [0.22, 1, 0.36, 1] },
                    }}
                    className={`w-full max-w-[660px] ${isLeft ? 'mr-auto' : 'ml-auto'}`}
                  >
                    <ContralateralDetailsCard
                      volume={volume}
                      accentHex={accentHex}
                      onClose={() => onToggleDetails(volume.id)}
                      activeTab={activeDetailTab}
                      onTabChange={(tab) => onDetailTabChange(volume.id, tab)}
                    />
                  </PresenceSurface>
                ) : (
                  <PresenceSurface
                    key={`year-${volume.id}`}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: isLeft ? -8 : 8 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      transition: { duration: reduceMotion ? 0.08 : 0.2, ease: [0.22, 1, 0.36, 1] },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: reduceMotion ? 0.08 : 0.11, ease: [0.22, 1, 0.36, 1] },
                    }}
                    className={`sticky top-28 pt-2 ${
                      isFocused
                        ? 'opacity-100 translate-y-0.5'
                        : 'opacity-50 -translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-85'
                    } flex flex-col gap-2 select-none transition-[transform,opacity] duration-base ease-smooth-out motion-reduce:transition-none ${
                      isLeft ? 'items-start text-left' : 'items-end text-right'
                    }`}
                  >
                    <span
                      className={`font-display font-black text-4xl lg:text-5xl leading-none tracking-tight tabular-nums bg-clip-text text-transparent transition-transform duration-base ease-smooth-out motion-reduce:transition-none ${
                        isLeft ? 'origin-left' : 'origin-right'
                      } ${isFocused ? 'scale-100' : 'scale-[0.65]'}`}
                      style={{ backgroundImage: isClassic ? 'none' : `linear-gradient(180deg, var(--label-1, #ffffff) 35%, ${accentHex})` }}
                    >
                      {yearMain}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-label-2 font-semibold">
                        {yearNote ? `${yearNote} · ${volume.volumeNumber}` : volume.volumeNumber}
                      </span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)]" style={{ color: isClassic ? 'var(--label-1)' : accentHex }}>
                        {volume.sagaLabel}
                      </span>
                    </div>

                    {/* Posición en la lista (solo en la tarjeta en foco) */}
                    <AnimatePresence initial={false}>
                      {isFocused && (
                        <m.div
                          key={`pos-${volume.id}`}
                          initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                          transition={{ duration: reduceMotion ? 0.08 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                          style={{ '--tick': hexToRgbChannels(isClassic ? '#FFFFFF' : accentHex) } as React.CSSProperties}
                          className="mt-1.5 w-52 max-w-full"
                        >
                          <div className="mb-1 flex justify-between text-3xs text-label-2 tabular-nums">
                            <span>{isRelease ? 'Posición de estreno' : 'Posición en la historia'}</span>
                            <span className="font-mono font-semibold">
                              {globalIndex + 1} / {totalVolumes}
                            </span>
                          </div>
                          <div className="relative h-1.5 w-full rounded-full bg-white/[0.12] overflow-hidden">
                            <div
                              className="h-full w-full rounded-full bg-[rgb(var(--tick))] shadow-[0_0_8px_rgb(var(--tick)/0.8)] origin-left transition-transform duration-base ease-out"
                              style={{ transform: `scaleX(${Math.max(0.02, (globalIndex + 1) / Math.max(1, totalVolumes))})` }}
                            />
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </PresenceSurface>
                )}
              </AnimatePresence>
            </div>

            {/* Card wrapper: alternating left/right on lg, left-aligned on mobile, con gap compacto lg:p*-8 */}
            <CardEntrance
              volumeId={volume.id}
              delay={entranceDelay}
              reduceMotion={reduceMotion}
              onIntent={() => onVolumeIntent?.(volume)}
              className={`relative w-full pl-8 sm:pl-10 lg:pl-0 lg:w-1/2 ${
                isLeft ? 'order-1 lg:pr-8' : 'order-2 lg:pl-8'
              }`}
            >
              {/* Móvil: año y número de lapso a la altura del nodo, arriba de la tarjeta */}
              <div className="lg:hidden flex items-baseline gap-2 h-5 mb-1.5 select-none">
                <span className="font-display font-black text-xs tabular-nums leading-5" style={{ color: isClassic ? 'var(--label-1)' : eraTextColor(accentHex) }}>
                  {yearMain}
                </span>
                <span className="text-3xs text-label-2 font-semibold">
                  {yearNote ? `${yearNote} · ${volume.volumeNumber}` : volume.volumeNumber}
                </span>
              </div>
              <TimelineVolumeCard
                className={isLeft ? 'lg:ml-auto' : 'lg:mr-auto'}
                volume={volume}
                isRead={isRead}
                progressPercent={progressPercent}
                nextEpisode={nextEpisode}
                seenEpisodes={seenEpisodes}
                isHighlighted={isHighlighted}
                isFocused={isFocused}
                hasAnyFocus={hasAnyFocus}
                onFocusCard={onFocusCard}
                onCollapseCard={onCollapseCard}
                accentHex={accentHex}
                onInspectThumbnail={onInspectThumbnail}
                onPlayVolume={onPlayVolume}
                onMarathon={onMarathon}
                marathonBusy={marathonBusy}
                isDetailsOpen={isDetailsOpen}
                onToggleDetails={onToggleDetails}
                detailTab={activeDetailTab}
                onTabChange={onDetailTabChange}
              />
            </CardEntrance>
          </>
        ) : (
          <div className={`w-full pl-8 sm:pl-10 lg:pl-0 lg:w-1/2 ${isLeft ? 'lg:pr-8' : 'lg:ml-auto lg:pl-8'}`}>
            <div aria-hidden="true" className="lg:hidden mb-1.5 h-5" />
            <TimelineCardSkeleton className={`${isFocused ? 'h-[320px] sm:h-[340px]' : 'h-[84px] sm:h-[92px]'} max-w-[660px] ${isLeft ? 'lg:ml-auto' : 'lg:mr-auto'}`} />
          </div>
        )}
      </div>
    </>
  );
});
