import React, { useState } from 'react';
import { VolumeData, AspectRatioType, ChapterMilestone } from './types';
import { PosterCard } from './PosterCard';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { NarrativeInspector } from './NarrativeInspector';
import { sounds } from './utils/audio';
import { Modal } from '@/components/ui/modal';
import {
  X,
  RotateCcw,
  Sparkles,
  Layers,
  BookOpen,
  Play,
} from 'lucide-react';

interface VolumeInspectorModalProps {
  volume: VolumeData;
  isOpen: boolean;
  onClose: () => void;
  aspectRatio: AspectRatioType;
  onChangeAspectRatio: (ratio: AspectRatioType) => void;
  isFlipped: boolean;
  onToggleFlip: () => void;
  onPrevVolume?: () => void;
  onNextVolume?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isRead?: boolean;
  onToggleRead?: () => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number) => void;
}

export const VolumeInspectorModal: React.FC<VolumeInspectorModalProps> = ({
  volume,
  isOpen,
  onClose,
  aspectRatio,
  onChangeAspectRatio: _onChangeAspectRatio,
  isFlipped,
  onToggleFlip,
  onPrevVolume,
  onNextVolume,
  hasPrev = false,
  hasNext = false,
  isRead = false,
  onToggleRead,
  onPlayVolume,
}) => {
  const [modalViewMode, setModalViewMode] = useState<'episodes-deck' | 'vertical-poster'>('episodes-deck');
  const episodes: ChapterMilestone[] = volume.detailedStory?.episodeMilestones || [];
  const [selectedEpIdx, setSelectedEpIdx] = useState(0);
  const eraColor = volume.coverArt.accentHex;

  const handleClose = () => {
    sounds.playSelect();
    onClose();
  };

  const currentEp = episodes[selectedEpIdx] || {
    episode: volume.episodesRange,
    title: volume.title,
    synopsis: volume.subtitle,
    sceneHighlight: volume.narrative.climax.decisiveBattle,
    accentColor: volume.coverArt.accentHex,
    iconEmoji: '⚡',
    characterFocus: volume.characters.join(', '),
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={<span className="sr-only">Inspección del tomo {volume.volumeNumber}: {volume.title}</span>}
      hideCloseButton
      contentClass="max-w-6xl p-4 sm:p-6 max-h-[95vh] overflow-y-auto"
    >
      <div
        className="flex flex-col contents"
        style={{ '--poster-accent': eraColor } as React.CSSProperties}
      >
            {/* Modal Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-elevation-1"
                  style={{ backgroundColor: 'var(--poster-accent)' }}
                />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-2xl sm:text-3xl tracking-wider text-white">
                  {volume.volumeNumber}: {volume.title}
                </span>
                <span className="text-2xs font-mono px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-white/10">
                  {volume.officialYear} · {volume.episodesRange}
                </span>
              </div>
              <span className="text-xs text-on-surface-variant font-mono">
                {volume.sagaLabel} · {volume.coverArt.dominantToneDescription}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Play CTA Button */}
            {onPlayVolume && (
              <button
                type="button"
                onClick={() => {
                  sounds.playSelect();
                  const epNum = currentEp.absoluteEpisode || Number(currentEp.episode.match(/\d+/)?.[0]) || volume.recommendedStartEpisode || volume.startEpisode;
                  onPlayVolume(volume, epNum);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-brand-accent hover:brightness-110 text-black font-display font-black uppercase text-xs flex items-center gap-1.5 cursor-pointer shadow-brand-primary active:scale-95 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reproducir lapso</span>
              </button>
            )}

            {/* View Mode Toggle: Tarjetas de Episodios vs. Portada Vertical */}
            <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-white/10 text-xs font-mono">
              <button
                onClick={() => {
                  sounds.playSelect();
                  setModalViewMode('episodes-deck');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors duration-150 flex items-center gap-1.5 cursor-pointer ${
                  modalViewMode === 'episodes-deck'
                    ? 'bg-brand-accent text-on-primary font-bold shadow'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tarjetas Agrupadas ({episodes.length})</span>
              </button>
              <button
                onClick={() => {
                  sounds.playSelect();
                  setModalViewMode('vertical-poster');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors duration-150 flex items-center gap-1.5 cursor-pointer ${
                  modalViewMode === 'vertical-poster'
                    ? 'bg-brand-accent text-on-primary font-bold shadow'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Tomo 3D</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              id="btn-close-volume-modal"
              onClick={handleClose}
              aria-label="Cerrar inspección del tomo"
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-surface-container-low border border-white/10 hover:border-white/30 text-on-surface-variant hover:text-white flex items-center justify-center transition-[color,background-color,border-color,transform] duration-150 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              title="Cerrar Inspección"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: BARAJA DE EPISODIOS AGRUPADOS (Grouped Cards View)   */}
        {/* ============================================================ */}
        {modalViewMode === 'episodes-deck' && (
          <div className="flex flex-col gap-6">
            {/* Active Selected Episode Cinema Card */}
            <div
              className="w-full bg-surface-container/90 border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, var(--md-sys-color-surface-container-lowest) 0%, var(--md-sys-color-surface-container-low) 50%, color-mix(in srgb, var(--poster-accent) 13%, transparent) 100%)`,
                borderColor: 'color-mix(in srgb, var(--poster-accent) 25%, transparent)',
              }}
            >
              {/* Retro scanlines */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.2)_3px)] pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                {/* Left: Frame Art Miniature Banner */}
                <div
                  className="w-full md:w-80 h-44 sm:h-48 rounded-xl border border-white/15 relative overflow-hidden flex flex-col justify-between p-3.5 shadow-elevation-2 shrink-0"
                  style={{
                    background: `linear-gradient(145deg, var(--md-sys-color-surface-container-lowest) 0%, color-mix(in srgb, var(--poster-accent) 19%, transparent) 100%)`,
                  }}
                >
                  <EpisodeThumbnailImg
                    volume={volume}
                    milestone={currentEp}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/45 pointer-events-none" />
                  <div className="relative z-10 flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-mono font-bold tracking-wider uppercase border shadow"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--poster-accent) 19%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--poster-accent) 44%, transparent)',
                        color: 'var(--poster-accent)',
                      }}
                    >
                      {currentEp.episode}
                    </span>
                    <span className="text-xl drop-shadow">{currentEp.iconEmoji || '⚡'}</span>
                  </div>

                  <div className="relative z-10 bg-surface-container-high/90 p-2 rounded-lg border border-white/10">
                    <span className="text-3xs font-mono text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-brand-accent" />
                      <span>{currentEp.characterFocus}</span>
                    </span>
                    <p className="text-xs font-bold text-white mt-0.5 line-clamp-2">
                      {currentEp.sceneHighlight}
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center justify-between text-3xs font-mono text-on-surface-variant border-t border-white/10 pt-1">
                    <span>Frame televisivo canónico</span>
                    <span className="text-brand-accent font-bold">{selectedEpIdx + 1} de {episodes.length}</span>
                  </div>
                </div>

                {/* Right: Detailed Synopsis & Narrative Impact */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-2xs font-mono bg-surface-container-low text-on-surface-variant border border-white/10">
                        {volume.seriesTag}
                      </span>
                      <span className="px-2 py-0.5 rounded text-2xs font-mono text-brand-accent bg-brand-accent/10 border border-brand-accent/20">
                        {volume.officialYear}
                      </span>
                    </div>

                    <h3 className="font-display text-3xl sm:text-4xl text-white tracking-wide leading-tight">
                      {currentEp.title}
                    </h3>

                    <p className="text-sm sm:text-base text-on-surface mt-2.5 leading-relaxed font-sans">
                      {currentEp.synopsis}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant/70">Personajes destacados:</span>
                      <span className="text-white font-semibold">{currentEp.characterFocus}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant/70">Hito visual:</span>
                      <span className="text-brand-accent/80">{currentEp.sceneHighlight}</span>
                    </div>
                  </div>

                  {onPlayVolume && (
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playSelect();
                          const epNum = currentEp.absoluteEpisode || Number(currentEp.episode.match(/\d+/)?.[0]) || volume.startEpisode || 1;
                          onPlayVolume(volume, epNum);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-accent hover:brightness-110 text-black text-xs font-mono font-bold shadow-brand-primary active:scale-95 transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Reproducir {currentEp.episode}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom: Horizontal Grouped Cards Deck (Baraja de miniaturas para seleccionar) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-accent" />
                  <h4 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Baraja de Episodios del Lapso ({episodes.length} tarjetas agrupadas)
                  </h4>
                </div>
                <span className="text-xs text-on-surface-variant font-mono hidden sm:inline">
                  Selecciona una tarjeta para proyectar su contenido
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {episodes.map((ep, idx) => {
                  const isSelected = idx === selectedEpIdx;
                  return (
                    <div
                      key={ep.episode}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Ver episodio ${ep.episode}: ${ep.title}`}
                      onClick={() => {
                        sounds.playSelect();
                        setSelectedEpIdx(idx);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          sounds.playSelect();
                          setSelectedEpIdx(idx);
                        }
                      }}
                      className={`relative rounded-xl p-3 border transition cursor-pointer flex flex-col justify-between min-h-[120px] shadow-md group/epcard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                        isSelected
                          ? 'bg-surface-container border-brand-accent transform -translate-y-1'
                          : 'bg-surface-container-low/80 hover:bg-surface-container-low border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-3xs font-mono font-bold ${
                            isSelected ? 'bg-brand-accent text-on-primary' : 'bg-surface-container-low text-on-surface'
                          }`}
                        >
                          {ep.episode}
                        </span>
                        <span className="text-sm">{ep.iconEmoji || '⚡'}</span>
                      </div>

                      {/* Title */}
                      <p className="text-xs font-bold text-white group-hover/epcard:text-brand-accent/80 transition-colors line-clamp-2 leading-snug">
                        {ep.title}
                      </p>

                      {/* Scene hint */}
                      <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-4xs font-mono text-on-surface-variant">
                        <span className="truncate max-w-[100px]">{ep.sceneHighlight}</span>
                        {isSelected && (
                          <span className="text-brand-accent font-bold">Activo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: PORTADA VERTICAL TRADICIONAL (Classic Poster View)   */}
        {/* ============================================================ */}
        {modalViewMode === 'vertical-poster' && (
          <div className="flex flex-col lg:flex-row items-start justify-center gap-8 flex-1">
            {/* Left: Master Poster with 3D Flip */}
            <div className="w-full lg:w-[380px] flex flex-col items-center shrink-0">
              <div className="w-full flex items-center justify-between mb-2 px-1 text-xs font-mono">
                <span className="text-on-surface-variant uppercase tracking-wider">
                  Portada Vertical ({aspectRatio})
                </span>
                <button
                  onClick={() => {
                    sounds.playFlip();
                    onToggleFlip();
                  }}
                  className="text-brand-accent hover:text-brand-secondary underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFlipped ? 'Ver Anverso' : 'Ver Dorso de Lore'}</span>
                </button>
              </div>

              <PosterCard
                volume={volume}
                aspectRatio={aspectRatio}
                isFlipped={isFlipped}
                onToggleFlip={onToggleFlip}
                isSelected={true}
                size="hero"
                isRead={isRead}
                onToggleRead={onToggleRead}
              />

              {/* Concept Info Box */}
              <div className="w-full mt-4 bg-surface-container/60 border border-white/10 rounded-xl p-3 text-xs font-mono space-y-1 text-on-surface-variant">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant/70">Cabecera Oficial:</span>
                  <span className="text-white font-semibold">
                    {volume.volumeNumber} \u00b7 {volume.episodesRange}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant/70">Calendario Oficial:</span>
                  <span className="text-brand-accent font-semibold">{volume.officialYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant/70">Filtro Cromático:</span>
                  <span className="text-on-surface-variant/80 truncate max-w-[200px] text-right">
                    {volume.coverArt.dominantToneDescription}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: 3 Narrative Levels */}
            <div className="flex-1 w-full">
              <NarrativeInspector
                volume={volume}
                isPosterFlipped={isFlipped}
                onToggleFlip={onToggleFlip}
                onPrevVolume={onPrevVolume || (() => {})}
                onNextVolume={onNextVolume || (() => {})}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};