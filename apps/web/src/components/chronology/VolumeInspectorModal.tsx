import React, { useState, useRef, useEffect } from 'react';
import type { VolumeData, ChapterMilestone } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { eraTextColor } from './utils/eraColor';
import { formatSecondsToTime } from './data/spansToVolumes';
import { Modal } from '@/components/ui/modal';
import { Button, IconButton } from '@/components/ui/button';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import {
  IconUiClose,
  IconMediaPlay,
  IconNavigationChevronLeft,
  IconNavigationChevronRight,
} from '@/components/ui/icons';

interface VolumeInspectorModalProps {
  volume: VolumeData;
  isOpen: boolean;
  onClose: () => void;
  /** Se llama cuando el Modal terminó su salida (Radix lo desmonta): el llamador puede soltar el lapso. */
  onCloseAutoFocus?: (event: Event) => void;
  onPrevVolume?: () => void;
  onNextVolume?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number) => void;
}

export const VolumeInspectorModal: React.FC<VolumeInspectorModalProps> = ({
  volume,
  isOpen,
  onClose,
  onCloseAutoFocus,
  onPrevVolume,
  onNextVolume,
  hasPrev = false,
  hasNext = false,
  onPlayVolume,
}) => {
  const episodes: ChapterMilestone[] = volume.detailedStory?.episodeMilestones || [];
  const [selectedEpIdx, setSelectedEpIdx] = useState(0);
  const [selectionContext, setSelectionContext] = useState({
    volumeId: volume.id,
    isOpen,
  });

  // Ajustar antes del commit: un lapso nuevo no hereda el hito del anterior.
  if (selectionContext.volumeId !== volume.id || selectionContext.isOpen !== isOpen) {
    setSelectionContext({ volumeId: volume.id, isOpen });
    if (isOpen) setSelectedEpIdx(0);
  }
  const reduceMotion = useReducedMotion();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Auto-scroll del filmstrip cuando cambia el episodio activo
  useEffect(() => {
    if (!isOpen) return;
    const activeTarget = itemRefs.current[selectedEpIdx];
    if (activeTarget && scrollContainerRef.current) {
      activeTarget.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedEpIdx, isOpen, reduceMotion]);

  // Navegación con teclado (flechas ← y →)
  useEffect(() => {
    if (!isOpen || episodes.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedEpIdx((prev) => Math.min(episodes.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedEpIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, episodes.length]);

  const eraColor = volume.coverArt.accentHex;

  const handleClose = () => {
    onClose();
  };

  const scrollRail = (offset: number) => {
    scrollContainerRef.current?.scrollBy({
      left: offset,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  const currentEp = episodes[selectedEpIdx] || {
    episode: volume.episodesRange,
    title: volume.title,
    synopsis: volume.subtitle,
    sceneHighlight: volume.narrative.climax.decisiveBattle,
    accentColor: volume.coverArt.accentHex,
    iconEmoji: '⚡',
    characterFocus: volume.characters?.join(', ') || '',
  };

  const hasMany = episodes.length > 4;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={<span className="sr-only">Inspector del lapso {volume.volumeNumber}: {volume.title}</span>}
      hideCloseButton
      contentClass="max-w-6xl p-4 sm:p-6 max-h-[92dvh] overflow-y-auto"
    >
      <div
        className="flex flex-col contents"
        style={{ '--poster-accent': eraColor, '--poster-text': eraTextColor(eraColor) } as React.CSSProperties}
      >
        {/* Modal Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_12px_var(--poster-accent)]"
              style={{ backgroundColor: 'var(--poster-accent)' }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-lg sm:text-xl leading-snug text-on-surface text-balance">
                  {volume.volumeNumber}: {volume.title}
                </span>
                <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant border border-white/10 font-mono tabular-nums">
                  {volume.officialYear} · {volume.episodesRange}
                </span>
              </div>
              <span className="text-xs text-label-2">
                {volume.sagaLabel} · {volume.seriesTag}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
            {/* Navegación rápida entre lapsos */}
            {(onPrevVolume || onNextVolume) && (
              <div className="inline-flex items-center rounded-full border border-white/10 bg-surface-container-low p-0.5">
                <button
                  type="button"
                  onClick={onPrevVolume}
                  disabled={!hasPrev}
                  aria-label="Lapso anterior"
                  title="Lapso anterior"
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-label-2 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  ← Ant.
                </button>
                <span className="text-white/20 text-xs select-none">|</span>
                <button
                  type="button"
                  onClick={onNextVolume}
                  disabled={!hasNext}
                  aria-label="Lapso siguiente"
                  title="Lapso siguiente"
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-label-2 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Sig. →
                </button>
              </div>
            )}

            {/* Play Lapso Button */}
            {onPlayVolume && (
              <Button
                intent="secondary"
                size="sm"
                onClick={() => {
                  const epNum =
                    volume.recommendedStartEpisode ||
                    volume.startEpisode ||
                    currentEp.absoluteEpisode ||
                    Number(currentEp.episode.match(/\d+/)?.[0]);
                  onPlayVolume(volume, epNum);
                }}
                leftIcon={<IconMediaPlay className="w-3.5 h-3.5 fill-current" />}
              >
                Reproducir lapso
              </Button>
            )}

            {/* Close Button */}
            <IconButton
              id="btn-close-volume-modal"
              intent="secondary"
              onClick={handleClose}
              aria-label="Cerrar inspector del lapso"
              title="Cerrar"
              icon={<IconUiClose className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* ESCENARIO PANORÁMICO + FILMSTRIP CON AUTO-SCROLL              */}
        {/* ============================================================ */}
        <div className="space-y-5 pt-3">
          {/* 1. Escenario Panorámico cinematográfico */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-surface-container-lowest grid grid-cols-1 lg:grid-cols-12 min-h-[300px]">
            {/* Columna Izquierda: Ficha rica, Hito, Sinopsis, Impacto y CTA */}
            <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between z-10 relative space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/15 border border-brand-accent/35 text-xs font-mono font-semibold text-brand-accent-readable">
                    <span>Hito {selectedEpIdx + 1} de {episodes.length}</span>
                    <span>·</span>
                    <span>{currentEp.episode}</span>
                    {currentEp.startSec != null && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">Min. {formatSecondsToTime(currentEp.startSec)}</span>
                      </>
                    )}
                  </div>
                  {currentEp.characterFocus && (
                    <span className="text-xs text-label-2 font-medium line-clamp-1 max-w-[220px]">
                      {currentEp.characterFocus}
                    </span>
                  )}
                </div>

                <h3 className="font-display font-bold text-2xl sm:text-3xl text-on-surface leading-tight text-balance">
                  {currentEp.title}
                </h3>

                <p className="text-sm text-on-surface-variant leading-relaxed text-pretty line-clamp-3 sm:line-clamp-4">
                  {currentEp.synopsis}
                </p>

                {/* Caja de impacto narrativo (del hito o del lapso) */}
                {(currentEp.sceneHighlight || volume.narrative?.climax?.iconicMoment || volume.threatLevel) && (
                  <div className="p-3 rounded-xl bg-surface-container-low/70 border border-white/5 flex items-start gap-2.5">
                    <span className="text-brand-accent text-sm shrink-0 mt-0.5">⚡</span>
                    <div className="space-y-0.5 text-xs">
                      <span className="font-mono font-bold text-brand-accent-readable uppercase tracking-wider block">
                        Impacto en la trama
                      </span>
                      <p className="text-on-surface/90 leading-relaxed line-clamp-2">
                        {currentEp.sceneHighlight || volume.narrative?.climax?.iconicMoment || volume.threatLevel}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones principales: Play + Navegación entre hitos + Chips */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {onPlayVolume && (
                    <Button
                      intent="primary"
                      onClick={() => {
                        const epNum =
                          currentEp.absoluteEpisode ||
                          Number(currentEp.episode.match(/\d+/)?.[0]) ||
                          volume.recommendedStartEpisode ||
                          volume.startEpisode;
                        onPlayVolume(volume, epNum);
                      }}
                      leftIcon={<IconMediaPlay className="w-3.5 h-3.5 fill-current" />}
                    >
                      Reproducir {currentEp.episode}
                    </Button>
                  )}

                  {episodes.length > 1 && (
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-surface-container-low p-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEpIdx((prev) => Math.max(0, prev - 1))}
                        disabled={selectedEpIdx === 0}
                        aria-label="Hito anterior"
                        title="Hito anterior (←)"
                        className="px-2.5 py-1.5 rounded-full text-xs font-medium text-label-2 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        ← Ant.
                      </button>
                      <span className="text-white/20 text-xs select-none">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEpIdx((prev) => Math.min(episodes.length - 1, prev + 1))}
                        disabled={selectedEpIdx === episodes.length - 1}
                        aria-label="Siguiente hito"
                        title="Siguiente hito (→)"
                        className="px-2.5 py-1.5 rounded-full text-xs font-medium text-label-2 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        Sig. →
                      </button>
                    </div>
                  )}
                </div>

                {volume.characters && volume.characters.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {volume.characters.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-2xs text-label-2"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Fotograma 16:9 panorámico integrado */}
            <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full aspect-video lg:aspect-auto overflow-hidden bg-surface-container-lowest">
              <EpisodeThumbnailImg
                key={currentEp.episode}
                volume={volume}
                milestone={currentEp}
                eager
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Fundido suave lateral y vertical */}
              <div className="hidden lg:block absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-surface-container-lowest to-transparent pointer-events-none" />
              <div className="lg:hidden absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-surface-container-lowest to-transparent pointer-events-none" />

              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 border border-white/15 text-2xs font-mono tabular-nums text-neutral-200">
                {currentEp.episode}
                {currentEp.startSec != null && ` · Min. ${formatSecondsToTime(currentEp.startSec)}`}
              </div>
            </div>
          </div>

          {/* 2. Filmstrip con Riel de Tiempo y Desplazamiento Inteligente */}
          {episodes.length > 0 && (
            <section aria-label="Línea de momentos del lapso" className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-on-surface">Línea de momentos del lapso</h4>
                  <span className="text-white/20 select-none">·</span>
                  <span className="text-label-2">
                    {hasMany ? 'Riel interactivo (se autocentra al avanzar)' : `${episodes.length} hitos clave`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-label-2 font-mono tabular-nums">
                    Hito {selectedEpIdx + 1} de {episodes.length}
                  </span>
                  {hasMany && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollRail(-260)}
                        aria-label="Desplazar riel a la izquierda"
                        className="w-6 h-6 rounded-lg border border-white/10 bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-label-2 hover:text-on-surface transition-colors"
                      >
                        <IconNavigationChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRail(260)}
                        aria-label="Desplazar riel a la derecha"
                        className="w-6 h-6 rounded-lg border border-white/10 bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-label-2 hover:text-on-surface transition-colors"
                      >
                        <IconNavigationChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrubber indicator bar */}
              <div className="relative py-0.5">
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-gradient-to-r from-brand-accent to-amber-400 transition-transform duration-base ease-smooth-out motion-reduce:transition-none"
                    style={{
                      transform: `scaleX(${selectedEpIdx / Math.max(1, episodes.length - 1)})`,
                    }}
                  />
                </div>
              </div>

              {/* Scroll container snap-x con auto-centrado */}
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  className="flex gap-3 overflow-x-auto scroll-smooth py-1 no-scrollbar snap-x focus-visible:outline-none"
                  tabIndex={0}
                  aria-label="Lista deslizable de momentos del lapso"
                >
                  {episodes.map((ep, idx) => {
                    const isSelected = idx === selectedEpIdx;
                    const widthClass = hasMany
                      ? 'w-56 sm:w-64 shrink-0 snap-center'
                      : 'flex-1 min-w-[200px]';
                    return (
                      <button
                        key={ep.episode}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Ver episodio ${ep.episode}: ${ep.title}`}
                        onClick={() => setSelectedEpIdx(idx)}
                        className={`group rounded-2xl p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-fast flex flex-col justify-between ${widthClass} border ${
                          isSelected
                            ? 'bg-brand-accent/15 border-brand-accent shadow-[0_0_24px_-6px_color-mix(in_srgb,var(--poster-accent)_35%,transparent)]'
                            : 'bg-surface-container-low/60 border-white/10 hover:bg-surface-container-high/70 hover:border-white/20'
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent`}
                      >
                        <div>
                          <div
                            className={`relative aspect-video w-full rounded-xl overflow-hidden mb-2.5 bg-surface-container-lowest border ${
                              isSelected ? 'border-brand-accent/50' : 'border-white/10'
                            }`}
                          >
                            <EpisodeThumbnailImg volume={volume} milestone={ep} />
                            <span
                              className={`absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-2xs font-mono font-bold ${
                                isSelected ? 'text-brand-accent-readable' : 'text-neutral-200'
                              }`}
                            >
                              {idx + 1}. {ep.episode}
                            </span>
                            {ep.startSec != null && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-2xs font-mono tabular-nums text-neutral-300">
                                {formatSecondsToTime(ep.startSec)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-on-surface line-clamp-1">
                            {ep.title}
                          </p>
                          <p className="text-2xs text-label-2 line-clamp-1 mt-0.5">
                            {ep.characterFocus || ep.synopsis}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
};
