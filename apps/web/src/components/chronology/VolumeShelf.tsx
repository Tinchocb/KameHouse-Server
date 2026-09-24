import React from 'react';
import { VolumeData, AspectRatioType } from './types';
import { PosterCard } from './PosterCard';
import { BookMarked } from 'lucide-react';
import { sounds } from './utils/audio';

interface VolumeShelfProps {
  volumes: VolumeData[];
  selectedVolumeId: string;
  onSelectVolume: (volume: VolumeData) => void;
  aspectRatio: AspectRatioType;
  flippedVolumeIds: Set<string>;
  onToggleFlipVolume: (volumeId: string) => void;
  readVolumeIds?: Set<string>;
  onToggleRead?: (volumeId: string) => void;
}

export const VolumeShelf: React.FC<VolumeShelfProps> = ({
  volumes,
  selectedVolumeId,
  onSelectVolume,
  aspectRatio,
  flippedVolumeIds,
  onToggleFlipVolume,
  readVolumeIds,
  onToggleRead,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-amber-400" />
          <h3 className="font-display text-2xl tracking-wider text-white">
            Biblioteca de Tomos de Colección
          </h3>
          <span className="text-xs font-mono text-on-surface-variant px-2 py-0.5 rounded bg-bg-quaternary border border-white/10">
            {volumes.length} Tomos Maestros
          </span>
        </div>
        <span className="text-xs font-mono text-on-surface-variant">
          Formato: <strong className="text-amber-400 font-bold">{aspectRatio} Vertical</strong>
        </span>
      </div>

      {/* Luxury Wooden/Dark Manga Shelf Platform */}
      <div className="relative p-6 sm:p-8 bg-bg-primary/80 rounded-3xl border border-white/10 shadow-inner">
        {/* Ambient Top Light */}
        <div className="absolute top-0 inset-x-1/4 h-24 bg-amber-400/5 blur-3xl pointer-events-none" />

        {/* Shelf Grid with 3D feel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
          {volumes.map((vol) => {
            const isSelected = vol.id === selectedVolumeId;
            const isFlipped = flippedVolumeIds.has(vol.id);

            return (
              <div
                key={vol.id}
                className="flex flex-col items-center w-full max-w-[340px]"
              >
                <PosterCard
                  volume={vol}
                  aspectRatio={aspectRatio}
                  isFlipped={isFlipped}
                  onToggleFlip={() => onToggleFlipVolume(vol.id)}
                  isSelected={isSelected}
                  onSelect={() => onSelectVolume(vol)}
                  size="md"
                  isRead={readVolumeIds?.has(vol.id)}
                  onToggleRead={onToggleRead ? () => onToggleRead(vol.id) : undefined}
                />

                {/* Quick Select & Status Pill */}
                <div className="mt-3 flex items-center gap-2 w-full justify-between px-2">
                  <span className="text-3xs font-mono text-on-surface-variant">
                    {vol.episodesRange}
                  </span>
                  <button
                    id={`btn-inspect-shelf-${vol.id}`}
                    onClick={() => {
                      sounds.playSelect();
                      onSelectVolume(vol);
                    }}
                    className={`text-2xs font-mono px-3 py-1 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-neutral-950 border-amber-300 font-bold shadow-sm'
                        : 'bg-bg-quaternary text-on-surface/85 border-white/10 hover:border-amber-400/50 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Examinando' : 'Examinar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shelf Baseboard Bar */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-on-surface-variant/70">
          <span>COLECCIÓN DEFINITIVA KANZENBAN // UNIVERSE 7</span>
          <span>ESTÉTICA DE AFICHES & TOMOS MAESTROS</span>
        </div>
      </div>
    </div>
  );
};
