import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { VolumeData, ChapterMilestone } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { formatSecondsToTime } from './data/spansToVolumes';
import { parseAbsoluteEpisode } from './data/episodeMapping';
import { sounds } from './utils/audio';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { Play, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export interface MomentPlayInfo {
  key?: string;
  title: string;
  seconds: number;
}

/** Momento apuntado (hover o foco) para previsualizarlo en la miniatura grande. */
export interface MomentPreview {
  milestone: ChapterMilestone;
  episodeNum: number;
  seconds: number;
}

export interface MomentStripProps {
  volume: VolumeData;
  milestones?: ChapterMilestone[];
  serverMomentTimes?: Record<string, number>;
  onPlayMoment?: (volume: VolumeData, episodeNum: number, momentInfo: MomentPlayInfo) => void;
  /** Se llama al apuntar un momento y con null al dejarlo. */
  onPreviewMoment?: (preview: MomentPreview | null) => void;
  className?: string;
}

/** Solo en equipos con mouse: en táctil se desliza con el dedo. */
const POINTER_ONLY = 'hidden [@media(hover:hover)_and_(pointer:fine)]:flex';
const TOUCH_ONLY = '[@media(hover:hover)_and_(pointer:fine)]:hidden';

export const MomentStrip: React.FC<MomentStripProps> = memo(
  ({ volume, milestones, serverMomentTimes, onPlayMoment, onPreviewMoment, className = '' }) => {
    const items = milestones ?? volume.detailedStory?.episodeMilestones ?? [];
    const reduceMotion = useReducedMotion();
    const scrollerRef = useRef<HTMLDivElement>(null);
    // Qué bordes tienen contenido escondido: define las flechas y el desvanecido.
    const [edges, setEdges] = useState({ atStart: true, atEnd: true });

    const updateEdges = useCallback(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const atStart = el.scrollLeft <= 4;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
    }, []);

    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;
      let rafId = requestAnimationFrame(() => {
        updateEdges();
      });
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateEdges);
      });
      observer.observe(el);
      return () => {
        cancelAnimationFrame(rafId);
        observer.disconnect();
      };
    }, [updateEdges, items.length]);

    const scrollByPage = (direction: -1 | 1) => {
      const el = scrollerRef.current;
      if (!el) return;
      sounds.playSelect();
      el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    if (items.length === 0) {
      return null;
    }

    const fadeStart = edges.atStart ? 'black 0' : 'transparent 0, black 40px';
    const fadeEnd = edges.atEnd ? 'black 100%' : 'black calc(100% - 56px), transparent 100%';

    return (
      <div className={`flex flex-col gap-2.5 pt-1 ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-mono text-2xs font-bold uppercase tracking-wider text-on-surface-variant">
            Momentos clave <span className="text-white/35 tabular-nums">· {items.length}</span>
          </h4>

          <div className={`${POINTER_ONLY} items-center gap-1`}>
            {(
              [
                [-1, 'Momentos anteriores', ChevronLeft, edges.atStart],
                [1, 'Momentos siguientes', ChevronRight, edges.atEnd],
              ] as const
            ).map(([direction, label, Icon, disabled]) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                aria-controls={`moments-${volume.id}`}
                disabled={disabled}
                onClick={() => scrollByPage(direction)}
                className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.04] text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <span className={`${TOUCH_ONLY} text-3xs font-mono text-white/40`}>Desliza →</span>
        </div>

        <div
          ref={scrollerRef}
          id={`moments-${volume.id}`}
          role="region"
          aria-label={`Momentos clave de ${volume.title}`}
          onScroll={updateEdges}
          className="flex items-start gap-3 overflow-x-auto snap-x snap-mandatory pt-1 pb-1 no-scrollbar focus-visible:outline-none"
          style={{ maskImage: `linear-gradient(to right, ${fadeStart}, ${fadeEnd})` }}
        >
          {items.map((milestone, idx) => {
            const episodeNum = milestone.absoluteEpisode ?? parseAbsoluteEpisode(milestone.episode) ?? volume.startEpisode ?? 1;

            const serverSec = milestone.momentKey ? serverMomentTimes?.[milestone.momentKey] : undefined;
            const effectiveSeconds = serverSec !== undefined ? serverSec : (milestone.startSec ?? 0);
            const hasTime = serverSec !== undefined || milestone.startSec !== undefined;
            const formattedTime = hasTime ? formatSecondsToTime(effectiveSeconds) : null;

            const handleClick = () => {
              sounds.playSelect();
              onPlayMoment?.(volume, episodeNum, {
                key: milestone.momentKey,
                title: milestone.title,
                seconds: effectiveSeconds,
              });
            };

            const handlePreview = () => onPreviewMoment?.({ milestone, episodeNum, seconds: effectiveSeconds });
            const handleEndPreview = () => onPreviewMoment?.(null);

            return (
              <button
                key={milestone.momentKey || `${volume.id}-moment-${idx}`}
                type="button"
                onClick={handleClick}
                onMouseEnter={handlePreview}
                onMouseLeave={handleEndPreview}
                onFocus={handlePreview}
                onBlur={handleEndPreview}
                aria-label={`Reproducir momento: ${milestone.title}, Episodio ${episodeNum}${formattedTime ? ` en ${formattedTime}` : ''}`}
                className="group/moment flex flex-col w-[176px] sm:w-[196px] shrink-0 snap-start text-left cursor-pointer select-none rounded-xl focus-visible:outline-none"
              >
                {/* Miniatura sin caja alrededor; el borde se tiñe con la era al apuntarla */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 transition-[box-shadow,transform] duration-200 ease-out group-hover/moment:-translate-y-0.5 group-hover/moment:ring-2 group-hover/moment:ring-[rgb(var(--era,245_158_11)/0.75)] group-focus-visible/moment:ring-2 group-focus-visible/moment:ring-brand-accent group-active/moment:scale-[0.98] motion-reduce:transition-none motion-reduce:group-hover/moment:translate-y-0">
                  <EpisodeThumbnailImg
                    volume={volume}
                    milestone={milestone}
                    startSec={effectiveSeconds}
                    fetchPriority="low"
                    tmdbSize="w300"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover/moment:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />

                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 text-3xs font-mono font-bold text-white tabular-nums">
                    Cap. {episodeNum}
                    {formattedTime && (
                      <>
                        <Clock className="w-2.5 h-2.5 ml-0.5 text-white/60" aria-hidden="true" />
                        <span className="text-white/80">{formattedTime}</span>
                      </>
                    )}
                  </span>

                  <span
                    aria-hidden="true"
                    className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-brand-accent text-zinc-950 flex items-center justify-center shadow-lg shadow-black/60 opacity-0 scale-90 transition-[opacity,transform] duration-150 group-hover/moment:opacity-100 group-hover/moment:scale-100 group-focus-visible/moment:opacity-100 group-focus-visible/moment:scale-100 motion-reduce:transition-none"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </span>
                </div>

                <span className="mt-2 px-0.5 text-xs font-semibold text-white/90 line-clamp-1 transition-colors duration-150 group-hover/moment:text-[rgb(var(--era,245_158_11))]">
                  {milestone.title}
                </span>
                {milestone.synopsis && (
                  <span className="mt-0.5 px-0.5 text-3xs text-on-surface-variant line-clamp-2 leading-snug">{milestone.synopsis}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

MomentStrip.displayName = 'MomentStrip';
