import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { VolumeData, ChapterMilestone } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { formatSecondsToTime } from './data/spansToVolumes';
import { parseAbsoluteEpisode } from './data/episodeMapping';
import { sounds } from './utils/audio';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { Play, Clock, ChevronLeft, ChevronRight, Info, Sparkles } from 'lucide-react';
import { MomentDetailsModal } from './MomentDetailsModal';

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

    // Estado para el modal de detalles del momento
    const [selectedDetails, setSelectedDetails] = useState<{
      milestone: ChapterMilestone;
      episodeNum: number;
      seconds: number;
      formattedTime: string | null;
    } | null>(null);

    // Qué bordes tienen contenido escondido: define las flechas y el desvanecido.
    const [edges, setEdges] = useState(() => ({ atStart: true, atEnd: items.length <= 2 }));

    // Drag-to-scroll con ratón
    const isPointerDownRef = useRef(false);
    const hasDraggedRef = useRef(false);
    const startXRef = useRef(0);
    const startScrollLeftRef = useRef(0);

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
      let rafId = 0;
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

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // solo botón primario
      const el = scrollerRef.current;
      if (!el) return;
      isPointerDownRef.current = true;
      hasDraggedRef.current = false;
      startXRef.current = e.clientX;
      startScrollLeftRef.current = el.scrollLeft;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDownRef.current) return;
      const el = scrollerRef.current;
      if (!el) return;
      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 6) {
        hasDraggedRef.current = true;
        el.scrollLeft = startScrollLeftRef.current - dx;
      }
    };

    const handlePointerUp = () => {
      isPointerDownRef.current = false;
    };

    if (items.length === 0) {
      return null;
    }

    const fadeStart = edges.atStart ? 'black 0' : 'transparent 0, black 32px';
    const fadeEnd = edges.atEnd ? 'black 100%' : 'black calc(100% - 48px), transparent 100%';

    return (
      <div className={`flex flex-col gap-2.5 pt-1 ${className}`}>
        {/* Cabecera de la sección con jerarquía clara y microcopy adaptativo */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" aria-hidden="true" />
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
              Momentos clave
              <span className="px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-3xs font-mono font-medium text-white/70 tabular-nums">
                {items.length}
              </span>
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline font-mono text-3xs text-on-surface-variant/70">
              Clic para reproducir escena
            </span>
            <span className={`${TOUCH_ONLY} text-3xs font-mono text-white/40`}>
              Desliza →
            </span>

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
                  className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.04] text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-90 disabled:opacity-25 disabled:pointer-events-none"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Carrusel horizontal con drag-to-scroll y snap */}
        <div
          ref={scrollerRef}
          id={`moments-${volume.id}`}
          role="region"
          aria-label={`Momentos clave de ${volume.title}`}
          onScroll={updateEdges}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex items-start gap-3.5 overflow-x-auto snap-x snap-mandatory pt-1 pb-1 no-scrollbar focus-visible:outline-none cursor-grab active:cursor-grabbing"
          style={{ maskImage: `linear-gradient(to right, ${fadeStart}, ${fadeEnd})` }}
        >
          {items.map((milestone, idx) => {
            const episodeNum = milestone.absoluteEpisode ?? parseAbsoluteEpisode(milestone.episode) ?? volume.startEpisode ?? 1;

            const serverSec = milestone.momentKey ? serverMomentTimes?.[milestone.momentKey] : undefined;
            const effectiveSeconds = serverSec !== undefined ? serverSec : (milestone.startSec ?? 0);
            const hasTime = serverSec !== undefined || milestone.startSec !== undefined;
            const formattedTime = hasTime ? formatSecondsToTime(effectiveSeconds) : null;

            const handleClickPlay = () => {
              if (hasDraggedRef.current) return;
              sounds.playSelect();
              onPlayMoment?.(volume, episodeNum, {
                key: milestone.momentKey,
                title: milestone.title,
                seconds: effectiveSeconds,
              });
            };

            const handleOpenDetails = (e: React.MouseEvent) => {
              e.stopPropagation();
              sounds.playSelect();
              setSelectedDetails({
                milestone,
                episodeNum,
                seconds: effectiveSeconds,
                formattedTime,
              });
            };

            const handlePreview = () => onPreviewMoment?.({ milestone, episodeNum, seconds: effectiveSeconds });
            const handleEndPreview = () => onPreviewMoment?.(null);

            const handleCardFocus = (e: React.FocusEvent<HTMLDivElement>) => {
              handlePreview();
              // Scroll suave para no quedar cortado por el desvanecido
              e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            };

            return (
              <div
                key={milestone.momentKey || `${volume.id}-moment-${idx}`}
                role="group"
                aria-label={milestone.title}
                onMouseEnter={handlePreview}
                onMouseLeave={handleEndPreview}
                onFocus={handleCardFocus}
                onBlur={handleEndPreview}
                className="group/moment flex flex-col w-[184px] sm:w-[204px] shrink-0 snap-start text-left select-none rounded-xl"
              >
                {/* Miniatura 16:9 con badges limpios desacoplados y botón de detalles */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 transition-[box-shadow,transform] duration-200 ease-out group-hover/moment:-translate-y-0.5 group-hover/moment:ring-2 group-hover/moment:ring-[rgb(var(--era,245_158_11)/0.75)] group-hover/moment:shadow-[0_6px_20px_rgba(var(--era,245_158_11)/0.25)] shadow-sm">
                  {/* Botón principal de reproducción sobre la miniatura */}
                  <button
                    type="button"
                    onClick={handleClickPlay}
                    aria-label={`Reproducir momento: ${milestone.title}, Episodio ${episodeNum}${formattedTime ? ` en ${formattedTime}` : ''}`}
                    className="absolute inset-0 z-0 w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    <EpisodeThumbnailImg
                      volume={volume}
                      milestone={milestone}
                      startSec={effectiveSeconds}
                      fetchPriority="low"
                      tmdbSize="w300"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover/moment:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                    {/* Play que emerge en el centro al hacer hover */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-brand-accent text-zinc-950 flex items-center justify-center shadow-brand-primary opacity-0 scale-90 transition-[opacity,transform] duration-150 ease-out group-hover/moment:opacity-100 group-hover/moment:scale-100 motion-reduce:transition-none"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </span>
                  </button>

                  {/* Badge de Episodio: Arriba a la Izquierda */}
                  <span className="pointer-events-none absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-3xs font-mono font-bold text-white/90 tabular-nums">
                    Cap. {episodeNum}
                  </span>

                  {/* Botón de Detalles de la Escena (Ficha): Arriba a la Derecha */}
                  <button
                    type="button"
                    onClick={handleOpenDetails}
                    aria-label={`Ver detalles de ${milestone.title}`}
                    title="Ver detalles de la escena"
                    className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/65 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105 active:scale-90"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>

                  {/* Badge de Timestamp: Abajo a la Derecha (estilo streaming) */}
                  {formattedTime && (
                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-3xs font-mono font-bold text-white tabular-nums">
                      <Clock className="w-2.5 h-2.5 text-brand-accent" aria-hidden="true" />
                      <span>{formattedTime}</span>
                    </span>
                  )}
                </div>

                {/* Título en 2 líneas para evitar el recorte prematuro */}
                <button
                  type="button"
                  onClick={handleClickPlay}
                  className="mt-2 px-0.5 text-xs font-semibold text-white/95 line-clamp-2 min-h-[2.25rem] leading-snug text-left cursor-pointer transition-colors duration-150 group-hover/moment:text-[rgb(var(--era,245_158_11))] focus-visible:outline-none focus-visible:underline"
                >
                  {milestone.title}
                </button>

                {/* Sinopsis legible en text-2xs */}
                {milestone.synopsis && (
                  <span className="mt-0.5 px-0.5 text-2xs text-on-surface-variant/80 line-clamp-2 min-h-[1.75rem] leading-relaxed">
                    {milestone.synopsis}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal cinemático para explorar los detalles del momento */}
        <MomentDetailsModal
          isOpen={selectedDetails !== null}
          onClose={() => setSelectedDetails(null)}
          volume={volume}
          milestone={selectedDetails?.milestone ?? null}
          episodeNum={selectedDetails?.episodeNum ?? 1}
          effectiveSeconds={selectedDetails?.seconds ?? 0}
          formattedTime={selectedDetails?.formattedTime ?? null}
          onPlayMoment={onPlayMoment}
        />
      </div>
    );
  },
);

MomentStrip.displayName = 'MomentStrip';
