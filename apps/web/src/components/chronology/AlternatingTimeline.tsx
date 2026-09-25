import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import type { VolumeData } from './types';
import { TimelineVolumeCard } from './TimelineVolumeCard';
import { VolumeDetailsTabs, type DetailTab } from './VolumeDetailsTabs';
import { EraHero, ERA_KANJI } from './EraHero';
import { InterludeDivider } from './InterludeDivider';
import { type MomentPlayInfo } from './MomentStrip';
import { groupVolumesByEra, formatYearShort } from './data/spansToVolumes';
import type { SpanProgress } from './data/spanProgress';
import { CHRONOLOGY_INTERLUDES } from './data/interludes';
import { getSagaBadgeConfig } from './utils/sagaBadge';
import { hexToRgbChannels } from './utils/eraColor';
import { sounds } from './utils/audio';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { useNearViewport } from './utils/useNearViewport';
import { CheckCircle2, X } from 'lucide-react';

export interface AlternatingTimelineProps {
  volumes: VolumeData[];
  readVolumeIds: Set<string>;
  /** Avance por lapso (historial + marcas manuales). */
  progressById?: ReadonlyMap<string, SpanProgress>;
  serverMomentTimes?: Record<string, number>;
  onToggleRead: (volumeId: string) => void;
  /** Mostrar los separadores de interludio entre lapsos (preferencia de la página). */
  showInterludes: boolean;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  /** Se llama al apuntar o enfocar una tarjeta: momento para precargar lo que haría falta al reproducir. */
  onVolumeIntent?: (volume: VolumeData) => void;
  highlightedVolumeId?: string | null;
  searchQuery?: string;
}

export const AlternatingTimeline: React.FC<AlternatingTimelineProps> = memo(({
  volumes,
  readVolumeIds,
  progressById,
  serverMomentTimes,
  onToggleRead,
  showInterludes,
  onInspectThumbnail,
  onPlayVolume,
  onVolumeIntent,
  highlightedVolumeId,
  searchQuery = '',
}) => {
  const reduceMotion = useReducedMotion();
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null);
  const [volumeDetailTabs, setVolumeDetailTabs] = useState<Record<string, DetailTab>>({});

  const handleToggleDetails = useCallback((volumeId: string) => {
    sounds.playSelect();
    setOpenDetailsId((prev) => (prev === volumeId ? null : volumeId));
  }, []);

  const handleDetailTabChange = useCallback((volumeId: string, tab: DetailTab) => {
    setVolumeDetailTabs((prev) => ({ ...prev, [volumeId]: tab }));
  }, []);

  // Group volumes by Era (Classic -> Z -> Daima -> Super -> GT)
  const eraGroups = useMemo(() => groupVolumesByEra(volumes), [volumes]);

  // Posición global de cada lapso para alternar izquierda/derecha entre eras
  const globalIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of eraGroups) {
      for (const saga of group.sagas) for (const v of saga.volumes) map.set(v.id, map.size);
    }
    return map;
  }, [eraGroups]);

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
  const showInterludeDividers = showInterludes && !hasActiveSearch;

  if (volumes.length === 0) {
    return (
      <div className="w-full py-16 text-center flex flex-col items-center justify-center gap-2">
        <p className="font-display font-bold text-base text-white uppercase tracking-wider">
          No se encontraron lapsos en la cronología
        </p>
        <p className="font-mono text-xs text-on-surface-variant">
          Prueba cambiando el filtro de búsqueda o de era.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 py-2">
      {/* 2. Main Timeline: Era Groups with Alternating Spines */}
      <div className="flex flex-col w-full">
        {eraGroups.map((eraGroup, eraIndex) => {
          const prevAccent = eraIndex > 0 ? eraGroups[eraIndex - 1].accentHex : null;
          const eraVolumes = eraGroup.sagas.flatMap((s) => s.volumes);
          const eraReadCount = eraVolumes.filter((v) => readVolumeIds.has(v.id)).length;

          return (
            <section
              key={`era-section-${eraGroup.seriesId}`}
              className="relative isolate w-full flex flex-col"
              aria-label={`Era ${eraGroup.seriesTag}`}
            >
              {/* Fondo de la era: brillo del color de la era, trama de puntos y el kanji fijo detrás del
                  contenido. Arranca un poco antes de la sección y se funde arriba y abajo con una
                  máscara, así una era se disuelve en la siguiente en vez de cortar en seco.
                  Todo en gradientes y texto: sin blur. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 bottom-0 inset-x-0 lg:-inset-x-[20vw] -z-10 overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to bottom, transparent 0, black 300px, black calc(100% - 260px), transparent 100%)',
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[1200px]"
                  style={{
                    background: `radial-gradient(ellipse 60% 38% at 50% 330px, ${eraGroup.accentHex}24, transparent 72%), radial-gradient(ellipse 30% 24% at 84% 620px, ${eraGroup.accentHex}10, transparent 72%)`,
                  }}
                />
                <div className="absolute inset-x-0 top-0 h-[1400px] bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[length:28px_28px] [mask-image:linear-gradient(to_bottom,transparent,black_28%,transparent)]" />
                <div className="absolute inset-0 pt-24">
                  <div className="sticky top-24 flex justify-center">
                    <span className="font-kanji font-black leading-none text-white/[0.025] text-[42vh] select-none">
                      {ERA_KANJI[eraGroup.seriesId]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hilo entre eras: el eje pasa del color de la era que termina al de la que empieza */}
              {prevAccent && (
                <div aria-hidden="true" className="relative h-16">
                  <div
                    className="absolute inset-y-0 left-3 lg:left-1/2 w-0.5 -translate-x-1/2"
                    style={{
                      background: `linear-gradient(to bottom, ${prevAccent}40, ${eraGroup.accentHex})`,
                      boxShadow: `0 0 10px ${eraGroup.accentHex}40`,
                    }}
                  />
                </div>
              )}

              {/* Era Hero Banner */}
              <EraHero
                seriesId={eraGroup.seriesId}
                seriesTag={eraGroup.seriesTag}
                yearsLabel={eraGroup.yearsLabel}
                accentHex={eraGroup.accentHex}
                totalVolumes={eraVolumes.length}
                readVolumes={eraReadCount}
                className={prevAccent ? 'mt-0' : ''}
              />

              {/* Spine Area for this Era */}
              <div className="relative w-full flex flex-col">
                {/* Central Spine Axis Line on md+ */}
                <div
                  aria-hidden="true"
                  className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 pointer-events-none"
                  style={{
                    background: `linear-gradient(to bottom, ${eraGroup.accentHex}90, ${eraGroup.accentHex}30 85%, transparent)`,
                    boxShadow: `0 0 12px ${eraGroup.accentHex}40`,
                  }}
                />

                {/* Left Spine Axis Line on < md */}
                <div
                  aria-hidden="true"
                  className="lg:hidden absolute left-3 top-0 bottom-0 w-0.5 bg-white/10 pointer-events-none"
                />

                {/* Alternating Spans */}
                {eraVolumes.map((vol, eraIdx) => {
                  // Find interlude before this volume
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
                      isRead={readVolumeIds.has(vol.id)}
                      isHighlighted={vol.id === highlightedVolumeId}
                      isDetailsOpen={openDetailsId === vol.id}
                      activeDetailTab={volumeDetailTabs[vol.id] ?? 'conflicto'}
                      progressPercent={progress?.percent ?? 0}
                      nextEpisode={progress?.nextEpisode}
                      serverMomentTimes={serverMomentTimes}
                      reduceMotion={Boolean(reduceMotion)}
                      onToggleRead={onToggleRead}
                      onInspectThumbnail={onInspectThumbnail}
                      onPlayVolume={onPlayVolume}
                      onVolumeIntent={onVolumeIntent}
                      onToggleDetails={handleToggleDetails}
                      onDetailTabChange={handleDetailTabChange}
                    />
                  );
                })}
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

/** Filas que se arman de entrada: lo que se ve al abrir la página está en la primera pintura. */
const EAGER_ROWS = 3;
/** Alto de reserva de una fila todavía sin armar (mismo valor que su contain-intrinsic-size). */
const ROW_PLACEHOLDER_PX = 620;

interface TimelineRowProps {
  volume: VolumeData;
  accentHex: string;
  /** Interludio que va antes de esta fila (ya filtrado por la preferencia y la búsqueda). */
  interlude?: (typeof CHRONOLOGY_INTERLUDES)[number];
  globalIndex: number;
  isRead: boolean;
  isHighlighted: boolean;
  isDetailsOpen: boolean;
  activeDetailTab: DetailTab;
  progressPercent: number;
  nextEpisode?: number;
  serverMomentTimes?: Record<string, number>;
  reduceMotion: boolean;
  onToggleRead: (volumeId: string) => void;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  onVolumeIntent?: (volume: VolumeData) => void;
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
  isRead,
  isHighlighted,
  isDetailsOpen,
  activeDetailTab,
  progressPercent,
  nextEpisode,
  serverMomentTimes,
  reduceMotion,
  onToggleRead,
  onInspectThumbnail,
  onPlayVolume,
  onVolumeIntent,
  onToggleDetails,
  onDetailTabChange,
}: TimelineRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isEager = globalIndex < EAGER_ROWS;
  const near = useNearViewport(rowRef, isEager);
  // Un salto por teclado o deep-link arma la fila destino aunque esté lejos.
  const [forced, setForced] = useState(false);
  if (isHighlighted && !forced) setForced(true);
  const mounted = near || forced;

  const isLeft = globalIndex % 2 === 0;
  const sagaConfig = getSagaBadgeConfig(volume.saga, volume.sagaLabel);
  const yearFormatted = formatYearShort(volume.officialYear);
  // "762 (Noviembre)" → año grande y la precisión aparte, en chico.
  const yearParts = /^(.*?)\s*\((.+)\)$/.exec(yearFormatted);
  const yearMain = yearParts?.[1] ?? yearFormatted;
  const yearNote = yearParts?.[2];
  // Las primeras filas entran escalonadas; el resto, al aparecer con el scroll.
  const entranceDelay = isEager && !reduceMotion ? globalIndex * 0.06 : 0;

  return (
    <>
      {/* Optional Interlude Divider */}
      {interlude && <InterludeDivider interlude={interlude} toVolume={volume} accentHex={accentHex} />}

      {/* Span Row Container */}
      <div
        ref={rowRef}
        id={`timeline-node-${volume.id}`}
        className="relative w-full flex items-start my-4 sm:my-6 lg:my-8 group scroll-mt-28 [content-visibility:auto] [contain-intrinsic-size:auto_620px]"
      >
        {mounted ? (
          <>
            {/* Mobile spine node (< md) centered on axis line */}
            <div
              className={`lg:hidden absolute left-3 -translate-x-1/2 top-0 w-6 h-6 rounded-full border flex items-center justify-center z-10 transition-transform duration-150 ${
                isHighlighted
                  ? 'bg-brand-accent border-white text-zinc-950 scale-125'
                  : isRead
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-zinc-950 border-white/25 text-brand-accent'
              }`}
            >
              {isRead ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="font-kanji font-black text-2xs leading-none text-brand-accent">
                  {volume.coverArt.symbolGlyph || '亀'}
                </span>
              )}
            </div>

            {/* Desktop central spine node (md+) */}
            <div
              className={`hidden lg:flex absolute left-1/2 -translate-x-1/2 top-7 w-8 h-8 rounded-full border-2 items-center justify-center z-10 transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out-strong shadow-elevation-1 ${
                isHighlighted
                  ? 'bg-brand-accent border-white text-zinc-950 scale-125 shadow-lg'
                  : isRead
                    ? 'bg-emerald-600 border-emerald-400 text-white group-hover:scale-110'
                    : 'bg-zinc-950 border-white/20 text-brand-accent group-hover:scale-110 group-hover:border-brand-accent/60'
              }`}
            >
              {isRead ? (
                <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
              ) : (
                <span className="font-kanji font-black text-xs leading-none text-brand-accent">
                  {volume.coverArt.symbolGlyph || '亀'}
                </span>
              )}
            </div>

            {/* Desktop horizontal stem connecting central node to card */}
            <div
              aria-hidden="true"
              className={`hidden lg:block absolute top-11 h-px pointer-events-none transition-opacity duration-200 ${
                isDetailsOpen ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'
              } ${
                isLeft ? 'right-1/2 w-12' : 'left-1/2 w-12'
              }`}
              style={{
                background: isLeft
                  ? `linear-gradient(to left, ${accentHex}, ${accentHex}20)`
                  : `linear-gradient(to right, ${accentHex}, ${accentHex}20)`,
              }}
            />

            {/* Desktop horizontal stem connecting central node to details panel when open */}
            {isDetailsOpen && (
              <div
                aria-hidden="true"
                className={`hidden lg:block absolute top-11 h-px pointer-events-none animate-fade-in ${
                  isLeft ? 'left-1/2 w-12' : 'right-1/2 w-12'
                }`}
                style={{
                  background: isLeft
                    ? `linear-gradient(to right, ${accentHex}, ${accentHex}20)`
                    : `linear-gradient(to left, ${accentHex}, ${accentHex}20)`,
                }}
              />
            )}

            {/* Desktop: Columna contralateral (Lado opuesto de la tarjeta) */}
            <div
              className={`hidden lg:flex flex-col lg:w-1/2 ${
                isLeft ? 'order-2 lg:pl-12' : 'order-1 lg:pr-12'
              }`}
            >
              <AnimatePresence mode="wait">
                {isDetailsOpen ? (
                  <m.div
                    key={`details-${volume.id}`}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: isLeft ? 16 : -16, scale: 0.98 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: isLeft ? 16 : -16, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    style={{ '--era': hexToRgbChannels(accentHex) } as React.CSSProperties}
                    className="sticky top-24 z-10 w-full rounded-2xl border border-white/[0.12] bg-zinc-950/90 backdrop-blur-overlay-2xl shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_24px_48px_-28px_rgb(0_0_0/0.9)] p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden"
                  >
                    {/* Filete superior con el color de la era */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[rgb(var(--era)/0.85)] to-transparent"
                    />

                    {/* Encabezado del panel de detalles */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-mono font-bold border ${sagaConfig.bg} ${sagaConfig.border} ${sagaConfig.text}`}
                        >
                          <span>{sagaConfig.icon}</span>
                          <span className="truncate max-w-[140px]">{volume.sagaLabel}</span>
                        </span>
                        <span className="font-mono text-2xs text-white/60 uppercase tracking-widest font-bold">
                          {volume.volumeNumber} · {yearMain}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleDetails(volume.id)}
                        aria-label={`Cerrar detalles de ${volume.title}`}
                        className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/15 text-white/70 hover:text-white flex items-center justify-center cursor-pointer transition-[color,background-color,border-color,transform] duration-150 active:scale-95 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Componente de pestañas de detalles */}
                    <VolumeDetailsTabs
                      volume={volume}
                      activeTab={activeDetailTab}
                      onTabChange={(tab) => onDetailTabChange(volume.id, tab)}
                      layoutIdPrefix="desktop-"
                    />
                  </m.div>
                ) : (
                  <m.div
                    key={`year-${volume.id}`}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`sticky top-28 pt-4 flex flex-col gap-1.5 pointer-events-none select-none ${
                      isLeft ? 'items-start text-left' : 'items-end text-right'
                    }`}
                  >
                    <span
                      className="font-display font-black text-4xl lg:text-5xl leading-none tracking-tight tabular-nums bg-clip-text text-transparent"
                      style={{ backgroundImage: `linear-gradient(180deg, #ffffff 35%, ${accentHex})` }}
                    >
                      {yearMain}
                    </span>
                    <span className="font-mono text-2xs text-white/45 uppercase tracking-[0.25em] font-bold">
                      {yearNote ? `${yearNote} · ${volume.volumeNumber}` : volume.volumeNumber}
                    </span>
                    <span className="font-mono text-2xs font-semibold max-w-[16rem]" style={{ color: accentHex }}>
                      {volume.sagaLabel}
                    </span>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {/* Card wrapper: alternating left/right on md+, left-aligned on mobile */}
            <m.div
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              onPointerEnter={() => onVolumeIntent?.(volume)}
              onFocusCapture={() => onVolumeIntent?.(volume)}
              transition={{ duration: 0.3, ease: 'easeOut', delay: entranceDelay }}
              className={`w-full pl-8 sm:pl-10 lg:pl-0 lg:w-1/2 ${
                isLeft ? 'order-1 lg:pr-12' : 'order-2 lg:pl-12'
              }`}
            >
              {/* Móvil: año y número de lapso a la altura del nodo, arriba de la tarjeta */}
              <div className="lg:hidden flex items-baseline gap-2 h-6 mb-2 select-none">
                <span className="font-mono font-black text-sm tracking-wider tabular-nums leading-6" style={{ color: accentHex }}>
                  {yearMain}
                </span>
                <span className="font-mono text-3xs text-white/40 uppercase tracking-widest font-bold">
                  {yearNote ? `${yearNote} · ${volume.volumeNumber}` : volume.volumeNumber}
                </span>
              </div>
              <TimelineVolumeCard
                volume={volume}
                isRead={isRead}
                progressPercent={progressPercent}
                nextEpisode={nextEpisode}
                isHighlighted={isHighlighted}
                accentHex={accentHex}
                serverMomentTimes={serverMomentTimes}
                onToggleRead={onToggleRead}
                onInspectThumbnail={onInspectThumbnail}
                onPlayVolume={onPlayVolume}
                isDetailsOpen={isDetailsOpen}
                onToggleDetails={onToggleDetails}
                detailTab={activeDetailTab}
                onTabChange={onDetailTabChange}
              />
            </m.div>
          </>
        ) : (
          <div aria-hidden="true" className="w-full" style={{ height: ROW_PLACEHOLDER_PX }} />
        )}
      </div>
    </>
  );
});
