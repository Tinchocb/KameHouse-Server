import React, { useEffect } from 'react';
import { VolumeData } from './types';
import { PosterArtwork } from './PosterArtwork';
import { sounds } from './utils/audio';
import { Modal } from '@/components/ui/modal';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  ShieldAlert,
  Swords,
  Sparkles,
  Quote,
  Clock,
  Calendar
} from 'lucide-react';

interface StoryReaderModalProps {
  volume: VolumeData;
  isOpen: boolean;
  onClose: () => void;
  isRead: boolean;
  onToggleRead: () => void;
  onPrevVolume?: () => void;
  onNextVolume?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const StoryReaderModal: React.FC<StoryReaderModalProps> = ({
  volume,
  isOpen,
  onClose,
  isRead,
  onToggleRead,
  onPrevVolume,
  onNextVolume,
  hasPrev = false,
  hasNext = false,
}) => {
  const handleClose = () => {
    sounds.playSelect();
    onClose();
  };

  // Navegación entre lapsos con flechas (Radix ya gestiona Escape, foco y scroll).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onPrevVolume?.();
      if (e.key === 'ArrowRight' && hasNext) onNextVolume?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onPrevVolume, onNextVolume, hasPrev, hasNext]);

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={<span className="sr-only">Lectura del tomo {volume.volumeNumber}: {volume.title}</span>}
      hideCloseButton
      contentClass="max-w-4xl p-5 sm:p-7 max-h-[95vh] overflow-y-auto"
    >
        {/* Top Bar with Navigation, Meta, and Close */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 gap-3">
          {/* Previous / Next Lapso Navigation */}
          <div className="flex items-center gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => {
                sounds.playSelect();
                if (onPrevVolume) onPrevVolume();
              }}
              aria-label="Lapso anterior"
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                hasPrev
                  ? 'bg-surface-container-low border-white/10 text-white hover:border-white/30'
                  : 'bg-surface-container-lowest border-white/5 text-on-surface-variant/40 cursor-not-allowed'
              }`}
              title="Lapso anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <button
              disabled={!hasNext}
              onClick={() => {
                sounds.playSelect();
                if (onNextVolume) onNextVolume();
              }}
              aria-label="Siguiente lapso"
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                hasNext
                  ? 'bg-surface-container-low border-white/10 text-white hover:border-white/30'
                  : 'bg-surface-container-lowest border-white/5 text-on-surface-variant/40 cursor-not-allowed'
              }`}
              title="Siguiente lapso"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Read Status Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sounds.playSelect();
                onToggleRead();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                isRead
                  ? 'bg-status-success/20 text-status-success border-status-success/40 shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-white border-white/10'
              }`}
            >
              {isRead ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-status-success" />
                  <span>Leído</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-on-surface-variant/50" />
                  <span>Marcar como leído</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              aria-label="Cerrar lectura del tomo"
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-surface-container-low border border-white/10 hover:border-white/30 text-on-surface-variant hover:text-white flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Header: Title, Episode Span & Miniature */}
        <div className="flex flex-col sm:flex-row items-start gap-5 py-5 border-b border-white/10">
          {/* Miniature (Small Poster) */}
          <div className="w-24 h-34 sm:w-28 sm:h-40 rounded-xl overflow-hidden border border-white/20 shadow-elevation-2 relative shrink-0 bg-surface-container self-center sm:self-start">
            <PosterArtwork volume={volume} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-5xs font-mono font-bold bg-black/80 text-white border border-white/20">
              {volume.volumeNumber}
            </span>
            <span
              className="absolute bottom-1.5 right-1.5 font-kanji text-sm font-black drop-shadow"
              style={{ color: 'var(--poster-accent)' }}
            >
              {volume.coverArt.symbolGlyph}
            </span>
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--poster-accent) 13%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--poster-accent) 31%, transparent)',
                  color: 'var(--poster-accent)',
                }}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{volume.episodesRange}</span>
              </span>

              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono bg-surface-container-low text-on-surface-variant border border-white/10 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-on-surface-variant/60" />
                <span>{volume.officialYear}</span>
              </span>

              <span className="px-2 py-0.5 rounded text-2xs font-mono text-on-surface-variant/70 bg-surface-container-low border border-white/10">
                {volume.sagaLabel}
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl text-white tracking-wide">
              {volume.title}
            </h2>
            <p className="text-sm text-brand-accent/90 font-medium mt-0.5">
              {volume.subtitle}
            </p>

            {/* Visual concept summary */}
            <p className="text-xs text-on-surface-variant/60 font-mono mt-2 italic">
              «{volume.coverArt.visualSummary}»
            </p>
          </div>
        </div>

        {/* Modal Body: Story Breakdown into 3 Canonical Stages */}
        <div className="py-5 space-y-6">
          {/* 1. EL DETONANTE */}
          <section className="bg-surface-container/60 rounded-2xl p-4 sm:p-5 border border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-accent mb-2">
              <ShieldAlert className="w-4 h-4 text-brand-accent shrink-0" />
              <span className="uppercase tracking-wider">Nivel 1: El Detonante del Conflicto</span>
              <span className="text-on-surface-variant/60 font-normal ml-auto">
                {volume.narrative.detonante.exactEpisodePoint}
              </span>
            </div>

            <h4 className="text-lg font-bold text-white mb-2">
              {volume.narrative.detonante.title}
            </h4>

            <p className="text-sm text-on-surface-variant/80 leading-relaxed mb-3">
              {volume.narrative.detonante.description}
            </p>

            <div className="text-xs font-mono text-brand-accent/80 bg-brand-accent/10 border border-brand-accent/20 p-2.5 rounded-xl">
              <span className="text-on-surface-variant/60 font-bold">Ruptura del statu quo: </span>
              {volume.narrative.detonante.statusQuoBreaker}
            </div>

            {volume.narrative.detonante.keyQuote && (
              <div className="mt-3 flex items-start gap-2 text-xs text-on-surface-variant/80 italic border-l-2 border-brand-accent/40 pl-3 py-1">
                <Quote className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                <span>{volume.narrative.detonante.keyQuote}</span>
              </div>
            )}
          </section>

          {/* 2. EL CLÍMAX & LA GRAN BATALLA */}
          <section className="bg-surface-container/60 rounded-2xl p-4 sm:p-5 border border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-status-error mb-2">
              <Swords className="w-4 h-4 text-status-error shrink-0" />
              <span className="uppercase tracking-wider">Nivel 2: El Clímax & Duelo Decisivo</span>
              <span className="text-on-surface-variant/60 font-normal ml-auto">
                Batalla Cumbre
              </span>
            </div>

            <h4 className="text-lg font-bold text-white mb-2">
              {volume.narrative.climax.title}
            </h4>

            <p className="text-sm text-on-surface-variant/80 leading-relaxed mb-3">
              {volume.narrative.climax.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-status-error/10 border border-status-error/20 p-2.5 rounded-xl text-on-surface">
                <span className="text-status-error font-bold block mb-1">Duelo Decisivo:</span>
                {volume.narrative.climax.decisiveBattle}
              </div>
              <div className="bg-surface-container-low border border-white/5 p-2.5 rounded-xl text-on-surface-variant/80">
                <span className="text-brand-accent font-bold block mb-1">Técnica / Costo Mortal:</span>
                {volume.narrative.climax.forbiddenTechniqueOrCost}
              </div>
            </div>

            <div className="mt-3 text-xs bg-surface-container-low/80 p-2.5 rounded-xl border border-white/5 text-on-surface-variant/80 font-mono">
              <span className="text-on-surface-variant/60 font-bold">Momento Icónico: </span>
              {volume.narrative.climax.iconicMoment}
            </div>
          </section>

          {/* 3. ARCHIVO DE LORE & COSMOVISIÓN */}
          <section className="bg-surface-container/60 rounded-2xl p-4 sm:p-5 border border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-secondary mb-2">
              <Sparkles className="w-4 h-4 text-brand-secondary shrink-0" />
              <span className="uppercase tracking-wider">Nivel 3: Archivo de Lore Cósmico</span>
              <span className="text-on-surface-variant/60 font-normal ml-auto">
                {volume.narrative.lore.deityInvolved}
              </span>
            </div>

            <h4 className="text-lg font-bold text-white mb-2">
              {volume.narrative.lore.title}
            </h4>

            <p className="text-sm text-on-surface-variant/80 leading-relaxed mb-3">
              {volume.narrative.lore.secretSummary}
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-brand-secondary/10 border border-brand-secondary/20 p-2.5 rounded-xl text-on-surface-variant/80">
                <span className="text-brand-secondary font-bold block mb-0.5">Trasfondo Oculto:</span>
                {volume.narrative.lore.cosmicBackground}
              </div>

              <div className="bg-surface-container-low border border-white/5 p-2.5 rounded-xl text-on-surface-variant/80">
                <span className="text-brand-accent font-bold block mb-0.5">Impacto en el Multiverso:</span>
                {volume.narrative.lore.cosmicImpact}
              </div>

              <div className="bg-brand-secondary/10 border border-brand-secondary/20 p-2.5 rounded-xl text-on-surface-variant/80">
                <span className="text-brand-secondary font-bold block mb-0.5">Hecho no Revelado:</span>
                {volume.narrative.lore.unrevealedFact}
              </div>
            </div>
          </section>

          {/* Characters & Artifacts Chips */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-xs font-mono text-on-surface-variant/70">
            <div>
              <span className="text-on-surface-variant/50 font-bold uppercase mr-2">Personajes Clave:</span>
              <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                {volume.characters.map((char) => (
                  <span
                    key={char}
                    className="px-2 py-0.5 rounded bg-surface-container-low text-white border border-white/10"
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>

            {volume.keyArtifacts && volume.keyArtifacts.length > 0 && (
              <div>
                <span className="text-on-surface-variant/50 font-bold uppercase mr-2">Artefactos:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                  {volume.keyArtifacts.map((art) => (
                    <span
                      key={art}
                      className="px-2 py-0.5 rounded bg-surface-container-low text-brand-accent border border-brand-accent/20"
                    >
                      {art}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </Modal>
  );
};