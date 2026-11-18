import React, { memo, useMemo, useRef } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { IconMediaPlay } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import type { EraFilter, VolumeData } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { SpanProgressBar } from './SpanProgressBar';
import { getSagaFallbackImages } from './data/sagaImages';
import { groupVolumesByEra } from './data/spansToVolumes';
import { CHRONOLOGY_INTERLUDES, type ChronologyInterlude } from './data/interludes';
import { ERA_FILTER_BY_SERIES, type EraKey } from './data/eraBar';
import { AIR_YEARS_BY_ERA, type TimelineOrder } from './data/releaseOrder';
import {
  buildSegments,
  formatEpisodeRange,
  playTargetFor,
  progressCaption,
  spanStatus,
} from './data/cardModel';
import type { SpanProgress } from './data/spanProgress';
import { formatYearShort } from './data/spansToVolumes';
import { hexToRgbChannels } from './utils/eraColor';
import { useNearViewport } from './utils/useNearViewport';

/** Alto de una fila compacta (también su `contain-intrinsic-size`): sin saltos al armarse. */
const ROW_HEIGHT_PX = 84;

interface CompactTimelineProps {
  volumes: VolumeData[];
  order?: TimelineOrder;
  progressById?: ReadonlyMap<string, SpanProgress>;
  readVolumeIds: Set<string>;
  showInterludes: boolean;
  highlightedVolumeId?: string | null;
  eraFilter?: EraFilter;
  /** Abre el inspector del lapso (portada, lore y reproducción). */
  onOpenVolume: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number) => void;
  onToggleSoloEra?: (era: EraKey) => void;
}

/**
 * Vista compacta: una fila por lapso (portada chica, título, años, episodios y avance) para ver los 35
 * de un vistazo. Cada fila abre el inspector existente; el botón de reproducir va directo al episodio.
 * Los interludios aparecen como separadores finos y se conservan las secciones por era (barra de eras).
 */
export const CompactTimeline: React.FC<CompactTimelineProps> = memo(({
  volumes,
  order = 'chronological',
  progressById,
  readVolumeIds,
  showInterludes,
  highlightedVolumeId,
  eraFilter = 'all',
  onOpenVolume,
  onPlayVolume,
  onToggleSoloEra,
}) => {
  const eraGroups = useMemo(() => groupVolumesByEra(volumes), [volumes]);
  const interludeMap = useMemo(() => {
    const map = new Map<string, ChronologyInterlude>();
    for (const il of CHRONOLOGY_INTERLUDES) if (il.toVolumeId) map.set(`${il.fromVolumeId}::${il.toVolumeId}`, il);
    return map;
  }, []);
  const showDividers = showInterludes && order === 'chronological';

  return (
    <div className="flex w-full max-w-[1440px] mx-auto flex-col gap-6 py-2" data-view="compact">
      {eraGroups.map((group) => {
        const era = ERA_FILTER_BY_SERIES[group.seriesId];
        const eraVolumes = group.sagas.flatMap((s) => s.volumes);
        const read = eraVolumes.filter((v) => readVolumeIds.has(v.id)).length;
        return (
          <section
            key={group.seriesId}
            id={`era-section-${group.seriesId}`}
            aria-label={`Era ${group.seriesTag}`}
            className="scroll-mt-28"
            style={{ '--era': hexToRgbChannels(group.accentHex) } as React.CSSProperties}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-black text-on-surface text-balance">{group.seriesTag}</h2>
                <p className="text-xs text-label-2 tabular-nums">
                  {order === 'release' ? `Emitida en ${AIR_YEARS_BY_ERA[era]}` : group.yearsLabel} · {read}/{eraVolumes.length}{' '}
                  {eraVolumes.length === 1 ? 'lapso visto' : 'lapsos vistos'}
                </p>
              </div>
              {onToggleSoloEra && (
                <Button intent="secondary" size="sm" onClick={() => onToggleSoloEra(era)}>
                  {eraFilter === 'all' ? 'Ver solo esta era' : 'Ver todas las eras'}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {group.sagas.map((saga) => (
                <div
                  key={`${group.seriesId}-${saga.sagaId}`}
                  className="rounded-2xl border border-l-[5px] p-3 sm:p-4"
                  style={{
                    borderColor: 'rgb(var(--era) / 0.25)',
                    borderLeftColor: 'rgb(var(--era) / 0.85)',
                    background:
                      'linear-gradient(180deg, rgb(var(--era) / 0.07) 0%, rgba(255, 255, 255, 0.015) 100%)',
                  }}
                >
                  <div
                    className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2"
                    style={{ borderColor: 'rgb(var(--era) / 0.18)' }}
                  >
                    <h3 className="font-display text-sm font-black tracking-tight text-on-surface">
                      {saga.sagaName}
                    </h3>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgb(var(--era) / 0.9)' }}>
                      {saga.volumes.length} {saga.volumes.length === 1 ? 'lapso' : 'lapsos'}
                    </span>
                  </div>
                  <ol className="flex flex-col">
                    {saga.volumes.map((vol) => {
                      const eraIdx = eraVolumes.indexOf(vol);
                      const prev = eraIdx > 0 ? eraVolumes[eraIdx - 1] : null;
                      const interlude = showDividers && prev ? interludeMap.get(`${prev.id}::${vol.id}`) : undefined;
                      const progress = progressById?.get(vol.id);
                      return (
                        <React.Fragment key={vol.id}>
                          {interlude && <CompactInterlude interlude={interlude} />}
                          <CompactRow
                            volume={vol}
                            order={order}
                            accentHex={group.accentHex}
                            isRead={readVolumeIds.has(vol.id)}
                            progress={progress}
                            isHighlighted={vol.id === highlightedVolumeId}
                            onOpen={onOpenVolume}
                            onPlay={onPlayVolume}
                          />
                        </React.Fragment>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});

CompactTimeline.displayName = 'CompactTimeline';

/** Separador fino entre lapsos: el salto de tiempo y el nombre del interludio. */
const CompactInterlude: React.FC<{ interlude: ChronologyInterlude }> = ({ interlude }) => (
  <li
    id={`interlude-${interlude.id}`}
    data-compact-interlude=""
    className="flex min-h-7 items-center gap-2 px-2 text-2xs text-label-2"
  >
    <span aria-hidden="true" className="h-px w-4 shrink-0 bg-[var(--neutral-separator)]" />
    <span className="shrink-0 font-semibold tabular-nums">{interlude.gap.label}</span>
    <span className="min-w-0 truncate" title={interlude.title}>
      {interlude.title}
    </span>
    <span aria-hidden="true" className="h-px flex-1 bg-[var(--neutral-separator)]" />
  </li>
);

interface CompactRowProps {
  volume: VolumeData;
  order: TimelineOrder;
  accentHex: string;
  isRead: boolean;
  progress?: SpanProgress;
  isHighlighted: boolean;
  onOpen: (volume: VolumeData) => void;
  onPlay?: (volume: VolumeData, episodeNum?: number) => void;
}

const CompactRow = memo(function CompactRow({ volume, order, accentHex, isRead, progress, isHighlighted, onOpen, onPlay }: CompactRowProps) {
  const ref = useRef<HTMLLIElement>(null);
  const near = useNearViewport(ref, false, { release: true, keep: isHighlighted });
  const percent = progress?.percent ?? 0;
  const status = spanStatus(isRead, percent, Boolean(volume.mediaId));
  const segments = buildSegments(volume, isRead, percent, progress?.nextEpisode, progress?.seenEpisodes);
  const seenCount = segments ? segments.filter((s) => s === 'seen').length : null;
  const target = playTargetFor(volume, isRead, percent, progress?.nextEpisode);
  const range = formatEpisodeRange(volume);
  const year = order === 'release' ? `Eps. ${range}` : `${formatYearShort(volume.officialYear)} · Eps. ${range}`;
  const sagaFallback = getSagaFallbackImages(volume.id)[0];

  return (
    <li
      ref={ref}
      id={`timeline-node-${volume.id}`}
      tabIndex={-1}
      data-status={status}
      style={{ '--era': hexToRgbChannels(accentHex), height: ROW_HEIGHT_PX, containIntrinsicSize: `auto ${ROW_HEIGHT_PX}px` } as React.CSSProperties}
      className="scroll-mt-28 py-1 [content-visibility:auto]"
    >
      {near ? (
        <div
          className={cn(
            'chronology-compact-row flex h-full items-center gap-2 rounded-xl border bg-[var(--surface-content)] pr-2 transition-[border-color,box-shadow] ease-smooth-out motion-reduce:transition-none',
            // El resaltado (j/k, búsqueda) aparece al instante; al apagarse, borde y anillo se funden juntos.
            isHighlighted ? 'duration-0' : 'duration-medium',
            isHighlighted ? 'border-[rgb(var(--era)/0.7)] ring-2 ring-[rgb(var(--era)/0.5)]' : isRead ? 'border-status-success/30' : 'border-[var(--neutral-separator)]',
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(volume)}
            aria-label={`Abrir ${volume.title}`}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl p-1.5 text-left transition-[background-color,transform] duration-fast ease-smooth-out motion-safe:active:scale-[0.99] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-1)]"
          >
            <span className={cn('relative h-full w-20 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br', volume.coverArt.auraGradient)}>
              <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-kanji text-3xl font-black text-white/[0.12]">
                {volume.coverArt.symbolGlyph}
              </span>
              <EpisodeThumbnailImg
                volume={volume}
                milestone={volume.detailedStory?.episodeMilestones?.[0] ?? { episode: `Ep. ${volume.startEpisode ?? 1}`, title: volume.title }}
                fallbackSrc={sagaFallback}
                tmdbSize="w300"
                className={cn('h-full w-full object-cover', isRead && 'saturate-[0.75] brightness-90')}
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="chronology-compact-title truncate font-display text-sm font-bold leading-tight text-on-surface text-balance" title={volume.title}>
                {volume.title}
              </span>
              <span className="flex items-baseline justify-between gap-2 text-xs text-label-2 tabular-nums">
                <span className="truncate">{year}</span>
                <span
                  className={cn(
                    'shrink-0 whitespace-nowrap',
                    status === 'seen' && 'font-bold text-status-success',
                    status === 'in-progress' && 'font-bold text-on-surface',
                  )}
                >
                  {status === 'unavailable' ? 'Sin archivos' : progressCaption(status, seenCount, percent, volume.episodesCount)}
                </span>
              </span>
              <SpanProgressBar title={volume.title} segments={segments} isRead={isRead} progressPercent={percent} height={3} />
            </span>
          </button>
          {onPlay && (
            <IconButton
              intent="secondary"
              onClick={() => onPlay(volume, target.episode)}
              disabled={status === 'unavailable'}
              aria-label={`${target.label}: ${volume.title}`}
              icon={<IconMediaPlay className="h-4 w-4 fill-current" />}
              className="shrink-0"
            />
          )}
        </div>
      ) : (
        <div
          aria-hidden="true"
          data-skeleton="row"
          className="h-full animate-pulse rounded-xl border border-[var(--neutral-separator)] bg-surface-container-lowest motion-reduce:animate-none"
        />
      )}
    </li>
  );
});
