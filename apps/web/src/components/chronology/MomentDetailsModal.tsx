import React from 'react';
import { Modal } from '@/components/ui/modal';
import type { VolumeData, ChapterMilestone } from './types';
import type { MomentPlayInfo } from './MomentStrip';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { sounds } from './utils/audio';
import { Play, Clock, Sparkles, User, X } from 'lucide-react';

export interface MomentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: VolumeData;
  milestone: ChapterMilestone | null;
  episodeNum: number;
  effectiveSeconds: number;
  formattedTime: string | null;
  onPlayMoment?: (volume: VolumeData, episodeNum: number, momentInfo: MomentPlayInfo) => void;
}

export const MomentDetailsModal: React.FC<MomentDetailsModalProps> = ({
  isOpen,
  onClose,
  volume,
  milestone,
  episodeNum,
  effectiveSeconds,
  formattedTime,
  onPlayMoment,
}) => {
  if (!milestone) return null;

  const handlePlay = () => {
    sounds.playSelect();
    onClose();
    onPlayMoment?.(volume, episodeNum, {
      key: milestone.momentKey,
      title: milestone.title,
      seconds: effectiveSeconds,
    });
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={<span className="sr-only">Detalles del momento: {milestone.title}</span>}
      hideCloseButton
      contentClass="max-w-xl p-0 overflow-hidden bg-surface-container-lowest/95 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-elevation-5"
    >
      <div className="flex flex-col">
        {/* Cabecera visual con miniatura ampliada 16:9 */}
        <div className="relative w-full aspect-video bg-surface-container-high overflow-hidden">
          <EpisodeThumbnailImg
            volume={volume}
            milestone={milestone}
            startSec={effectiveSeconds}
            tmdbSize="w780"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/30 to-black/60 pointer-events-none" />

          {/* Badges superiores */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-black/75 backdrop-blur-md border border-white/20 text-white/90 tabular-nums">
                Capítulo {episodeNum}
              </span>
              {formattedTime && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-black/80 backdrop-blur-md border border-brand-accent/40 text-brand-accent tabular-nums">
                  <Clock className="w-3 h-3 text-brand-accent" aria-hidden="true" />
                  <span>{formattedTime}</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalles del momento"
              className="pointer-events-auto w-11 h-11 rounded-full bg-black/70 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/90 border border-white/20 text-white/80 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white flex items-center justify-center cursor-pointer transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Disparador de play flotante en el centro de la imagen */}
          <button
            type="button"
            onClick={handlePlay}
            aria-label={`Reproducir momento en ${formattedTime ?? 'inicio'}`}
            className="group/center-play absolute inset-0 m-auto w-14 h-14 rounded-full bg-brand-accent/90 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-accent text-black flex items-center justify-center shadow-brand-primary cursor-pointer transition-[transform,background-color] duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 active:scale-95"
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </button>
        </div>

        {/* Contenido descriptivo del momento */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
              <span className="font-mono text-3xs uppercase tracking-wider text-on-surface-variant font-bold">
                {volume.sagaLabel} · {volume.volumeNumber}
              </span>
              {milestone.characterFocus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-mono bg-white/[0.06] border border-white/10 text-white/80">
                  <User className="w-2.5 h-2.5 text-brand-accent" />
                  <span>{milestone.characterFocus}</span>
                </span>
              )}
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-bold text-white text-balance leading-snug">
              {milestone.title}
            </h3>
          </div>

          {/* Escena cumbre estilizada */}
          {milestone.sceneHighlight && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
              <div>
                <span className="font-mono text-3xs uppercase tracking-wider text-brand-accent font-bold block mb-1">
                  Punto de Quiebre de la Escena
                </span>
                <p className="font-sans text-xs sm:text-sm text-white/95 italic leading-relaxed text-pretty">
                  «{milestone.sceneHighlight}»
                </p>
              </div>
            </div>
          )}

          {/* Sinopsis completa sin recorte */}
          {milestone.synopsis && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-3xs uppercase tracking-wider text-on-surface-variant/80 font-bold">
                Resumen Narrativo
              </span>
              <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed text-pretty">
                {milestone.synopsis}
              </p>
            </div>
          )}

          {/* Footer de acciones */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-3xs font-mono text-on-surface-variant/70">
              Escena verificada en cronología canónica
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer min-h-[38px] px-4 rounded-full border border-white/15 bg-white/[0.04] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10 text-white/80 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white text-xs font-mono transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="min-h-[38px] px-5 rounded-full bg-brand-accent [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 text-black font-display font-black uppercase text-xs flex items-center gap-2 cursor-pointer shadow-brand-primary active:scale-95 transition-[transform,filter] duration-fast ease-out-strong"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>Reproducir{formattedTime ? ` · ${formattedTime}` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
