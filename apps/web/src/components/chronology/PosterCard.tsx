import React from 'react';
import { VolumeData, AspectRatioType } from './types';
import { PosterArtwork } from './PosterArtwork';
import { Sparkles, RotateCw, ShieldAlert, Flame, CheckCircle2, Bookmark, Check } from 'lucide-react';
import { m } from 'framer-motion';
import { sounds } from './utils/audio';

interface PosterCardProps {
  volume: VolumeData;
  aspectRatio: AspectRatioType;
  isFlipped: boolean;
  onToggleFlip: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  isRead?: boolean;
  onToggleRead?: () => void;
}

const SAGA_TO_ERA_COLOR: Record<string, string> = {
  'clasico': 'var(--era-db-hex)',
  'saiyan-freezer': 'var(--era-dbz-hex)',
  'cell': 'var(--era-dbs-hex)',
  'buu': 'var(--brand-secondary-hex)',
  'super': 'var(--era-dbs-hex)',
  'daima': 'var(--era-daima-hex)',
  'gt': 'var(--era-dbgt-hex)',
};

const SAGA_TO_GLOW: Record<string, string> = {
  'clasico': 'var(--glow-db)',
  'saiyan-freezer': 'var(--glow-dbz)',
  'cell': 'var(--glow-dbs)',
  'buu': 'var(--glow-secondary)',
  'super': 'var(--glow-dbs)',
  'daima': 'var(--glow-daima)',
  'gt': 'var(--glow-dbgt)',
};

export const PosterCard: React.FC<PosterCardProps> = ({
  volume,
  aspectRatio,
  isFlipped,
  onToggleFlip,
  isSelected = false,
  onSelect,
  size = 'hero',
  isRead = false,
  onToggleRead,
}) => {
  const { coverArt, narrative, saga } = volume;
  const eraColor = SAGA_TO_ERA_COLOR[saga] ?? 'var(--brand-accent-hex)';
  const eraGlow = SAGA_TO_GLOW[saga] ?? 'var(--glow-primary)';

  // Aspect ratio class: 3:4 vs 2:3
  const aspectClass = aspectRatio === '3:4' ? 'aspect-[3/4]' : 'aspect-[2/3]';

  // Dimension scaling
  const widthClasses = {
    sm: 'w-48 max-w-full text-xs',
    md: 'w-64 max-w-full text-sm',
    lg: 'w-80 max-w-full text-sm',
    hero: 'w-full max-w-[420px] text-base',
  }[size];

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (onSelect) {
      sounds.playSelect();
      onSelect();
    }
  };

  const handleFlipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playFlip();
    if (!isFlipped) {
      sounds.playLoreReveal();
    }
    onToggleFlip();
  };

  return (
    <m.div
      id={`poster-card-${volume.id}`}
      layout
      onClick={handleCardClick}
      animate={{
        y: isSelected ? -16 : 0,
        scale: isSelected ? 1.03 : 1,
        transition: { type: 'spring', stiffness: 360, damping: 28 },
      }}
      whileHover={{
        y: isSelected ? -18 : -6,
        scale: isSelected ? 1.03 : 1.012,
        transition: { duration: 0.15 },
      }}
      whileTap={{ scale: 0.95 }}
      className={`group relative ${widthClasses} cursor-pointer select-none perspective-1000 ${isSelected ? 'z-30' : 'z-10'}`}
      style={{ '--poster-accent': eraColor, '--poster-glow': eraGlow } as React.CSSProperties}
    >
      {/* Physical Bookshelf Ledge Depth Shadow (simulates pulling volume from shelf) */}
      <div
        className={`absolute -bottom-2 inset-x-3 h-2.5 rounded-full transition-all duration-300 pointer-events-none ${
          isSelected
            ? 'bg-brand-accent/40 translate-y-2 scale-x-105 opacity-90 shadow-elevation-2'
            : 'bg-black/70 opacity-60 group-hover:scale-x-105 group-hover:opacity-85 shadow-elevation-1'
        }`}
      />

      {/* 3D Flippable Container with Shelf Elevation */}
      <div
        className={`relative w-full ${aspectClass} rounded-2xl preserve-3d transition-transform duration-700 ease-out shadow-elevation-4 ${isFlipped ? 'rotate-y-180' : ''}`}
      >
        {/* =========================================================
            FRONT COVER (ANVERSO: ARTE Y CABECERA DE TOMO)
           ========================================================= */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden bg-surface-container border-2 ${
            isSelected
              ? 'border-brand-accent shadow-brand-primary'
              : 'border-surface-variant'
          } flex flex-col justify-between`}
        >
          {/* Manga Spine Effect (left edge highlight) */}
          <div
            className="absolute top-0 bottom-0 left-0 w-3 z-30 opacity-70 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(0,0,0,0.8), rgba(255,255,255,0.15) 50%, rgba(0,0,0,0.6))',
            }}
          />

          {/* Holographic metallic border shimmer */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-30 border border-white/10" />

          {/* Reading Ribbon / Badge Bookmark on Front Cover */}
          {isRead && (
            <div className="absolute top-0 right-7 z-40 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in duration-300">
              <div className="bg-status-success text-white px-2 py-1 shadow-elevation-1 text-4xs font-mono font-black uppercase tracking-wider flex items-center gap-1 rounded-b-md">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>LEÍDO</span>
              </div>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[4px] border-t-status-success" />
            </div>
          )}

          {/* ----------------- CABECERA DE TOMO ----------------- */}
          <div
            className="relative z-20 w-full px-4 pt-3 pb-2 bg-gradient-to-b from-surface-container-lowest/95 via-surface-container-lowest/80 to-transparent flex flex-col gap-1 border-b border-white/10"
          >
            {/* Top row: Series badge & Official Year */}
            <div className="flex items-center justify-between">
              <span className="text-3xs font-mono tracking-wider uppercase font-semibold text-on-surface-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--poster-accent)' }} />
                {volume.seriesTag}
              </span>

              {/* Era en el calendario oficial (Año 762) */}
              <span className="text-3xs font-mono font-bold tracking-widest px-2 py-0.5 rounded-md bg-surface-container-low text-brand-accent border border-brand-accent/40 shadow-sm flex items-center gap-1">
                <Flame className="w-3 h-3 text-brand-accent inline" />
                {volume.officialYear}
              </span>
            </div>

            {/* Middle row: Volumen Number & Exact Range */}
            <div className="flex items-baseline justify-between mt-0.5">
              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-2xl tracking-wider text-white drop-shadow-md">
                  {volume.volumeNumber}
                </h3>
                <span className="text-2xs font-kanji font-bold text-on-surface-variant">
                  {coverArt.kanjiTitle}
                </span>
              </div>

              {/* Exact range (Caps 036 - 107) */}
              <div className="text-right">
                <span className="text-2xs font-mono font-semibold tracking-tight text-white bg-surface-container-low/60 px-2 py-0.5 rounded border border-white/20">
                  {volume.episodesRange}
                </span>
              </div>
            </div>
          </div>

          {/* ----------------- ILUSTRACIÓN CENTRAL DE IMPACTO ----------------- */}
          <div className="relative flex-1 w-full overflow-hidden">
            <PosterArtwork volume={volume} />

            {/* Vertical Japanese Title Strip (Deluxe Manga Style) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-center bg-black/85 border border-white/20 px-1.5 py-2 rounded shadow-elevation-2">
              <span className="text-4xs font-mono tracking-tighter text-brand-accent writing-vertical rotate-180 uppercase font-bold">
                JUMP COMICS
              </span>
              <div className="my-1.5 w-3 h-[1px] bg-brand-accent/50" />
              <span className="font-kanji text-xs font-black text-white writing-vertical">
                {coverArt.kanjiSubtitle}
              </span>
            </div>

            {/* Featured Collector Seal */}
            {volume.isFeaturedExample && (
              <div className="absolute top-4 left-5 z-20 flex items-center gap-1 bg-brand-accent/90 text-on-primary px-2 py-0.5 rounded-full font-mono text-4xs font-black uppercase tracking-wider shadow-elevation-2">
                <Sparkles className="w-2.5 h-2.5" /> Tomo Maestro
              </div>
            )}
          </div>

          {/* ----------------- PIE DE TOMO & BOTÓN FLIP A LORE & LEÍDO ----------------- */}
          <div className="relative z-20 w-full p-3.5 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-2">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-4xs font-mono uppercase tracking-widest px-1.5 py-px rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--poster-accent) 15%, transparent)',
                      color: 'var(--poster-accent)',
                    }}
                  >
                    {volume.sagaLabel}
                  </span>
                  <span className="text-3xs text-on-surface-variant font-mono">
                    {volume.episodesCount} Capítulos
                  </span>
                </div>

                {/* Mark as read toggle button */}
                {onToggleRead && (
                  <button
                    id={`btn-read-toggle-front-${volume.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      sounds.playSelect();
                      onToggleRead();
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase transition-all ${
                      isRead
                        ? 'bg-status-success/90 text-white border border-status-success/50 shadow-sm'
                        : 'bg-black/70 text-on-surface-variant hover:text-white border border-white/10 hover:border-white/30'
                    }`}
                    title={isRead ? 'Tomo marcado como leído' : 'Marcar como leído'}
                  >
                    {isRead ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-status-success" />
                        <span>Leído</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3 h-3 text-on-surface-variant" />
                        <span>Marcar</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <h2 className="font-display text-2xl tracking-wide text-white leading-tight drop-shadow">
                {volume.title}
              </h2>
              <p className="text-xs text-on-surface-variant line-clamp-1 italic">
                {volume.subtitle}
              </p>
            </div>

            {/* Button to Flip to Lore Back Cover */}
            <button
              id={`btn-flip-front-${volume.id}`}
              onClick={handleFlipClick}
              className="w-full mt-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-surface-container/90 hover:bg-surface-container-high text-brand-accent border border-brand-accent/40 text-xs font-mono font-bold tracking-wider transition-all duration-200 shadow-md group/btn"
            >
              <RotateCw className="w-3.5 h-3.5 transition-transform duration-500 group-hover/btn:rotate-180 text-brand-accent" />
              <span>GIRAR AL DORSO: ARCHIVO DE LORE</span>
            </button>
          </div>
        </div>

        {/* =========================================================
            BACK COVER (DORSO: ARCHIVO DE LORE & SECRETO CÓSMICO)
           ========================================================= */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden rotate-y-180 bg-surface-container border-2 ${
            isSelected ? 'border-brand-accent shadow-brand-primary' : 'border-surface-variant'
          } flex flex-col justify-between p-4 bg-gradient-to-b from-surface-container via-surface-container-high to-black`}
        >
          {/* Classified Cosmic Stamp / Seal */}
          <div className="relative z-10 flex items-center justify-between border-b border-brand-accent/30 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-status-error/80 border border-status-error/60 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-status-error" />
              </div>
              <div>
                <span className="text-3xs font-mono tracking-widest text-status-error font-bold uppercase block leading-none">
                  ARCHIVO DE LORE CONFIDENCIAL
                </span>
                <span className="text-4xs font-mono text-on-surface-variant">
                  Universo 7 • {volume.officialYear}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onToggleRead && (
                <button
                  id={`btn-read-toggle-back-${volume.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playSelect();
                    onToggleRead();
                  }}
                  className={`px-1.5 py-0.5 rounded text-4xs font-mono font-bold uppercase border transition-all ${
                    isRead
                      ? 'bg-status-success text-white border-status-success/50'
                      : 'bg-black/60 text-on-surface-variant border-white/10'
                  }`}
                >
                  {isRead ? '✓ Leído' : '+ Marcar'}
                </button>
              )}
              <span className="font-mono text-4xs text-brand-accent border border-brand-accent/40 px-1.5 py-0.5 rounded bg-black/60">
                NIVEL 03
              </span>
            </div>
          </div>

          {/* Secret background revelation */}
          <div className="relative z-10 flex-1 overflow-y-auto my-2 pr-1 space-y-3">
            <div className="bg-status-error/20 border border-status-error/30 rounded-lg p-2.5">
              <span className="text-3xs font-mono uppercase tracking-wider text-status-error font-semibold block mb-1">
                El Secreto Cósmico Oculto:
              </span>
              <h4 className="font-serif text-sm font-bold text-brand-accent/90 leading-snug">
                {narrative.lore.title}
              </h4>
              <p className="text-xs text-on-surface mt-1.5 leading-relaxed font-sans">
                {narrative.lore.secretSummary}
              </p>
            </div>

            {/* Detailed cosmic background */}
            <div className="bg-surface-container/60 border border-white/10 rounded-lg p-2.5">
              <span className="text-3xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold block mb-1">
                Lo Que Ocurría en Segundo Plano:
              </span>
              <p className="text-xs text-on-surface leading-relaxed font-sans">
                {narrative.lore.cosmicBackground}
              </p>
            </div>

            {/* Deity / Authority involved & Cosmic Impact */}
            <div className="grid grid-cols-2 gap-2 text-3xs font-mono">
              <div className="bg-surface-container/80 p-2 rounded border border-white/5">
                <span className="text-brand-accent/80 block uppercase text-4xs">Entidad Divina:</span>
                <span className="text-white font-semibold">{narrative.lore.deityInvolved}</span>
              </div>
              <div className="bg-surface-container/80 p-2 rounded border border-white/5">
                <span className="text-brand-accent/80 block uppercase text-4xs">Rango Temporal:</span>
                <span className="text-white font-semibold">{volume.officialYear}</span>
              </div>
            </div>

            {/* Cosmic Impact Warning */}
            <div className="bg-brand-accent/30 border-l-2 border-brand-accent p-2 rounded-r text-2xs text-brand-accent/90 leading-snug">
              <strong className="text-brand-accent font-mono text-4xs uppercase block">Consecuencia Multiversal:</strong>
              {narrative.lore.cosmicImpact}
            </div>
          </div>

          {/* Footer of back cover: Barcode + Flip Back Button */}
          <div className="relative z-10 pt-2 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-4xs font-mono text-on-surface-variant/50">
              <span>VOL. {volume.volumeIndex.toString().padStart(2, '0')} {' '} DB-ARCHIVE</span>
              <span>ISBN 978-DB-{volume.officialYearNumber}</span>
            </div>

            <button
              id={`btn-flip-back-${volume.id}`}
              onClick={handleFlipClick}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/50 text-xs font-mono font-bold tracking-wider transition-all duration-200"
            >
              <RotateCw className="w-3.5 h-3.5 rotate-180 text-brand-accent" />
              <span>VOLVER A LA PORTADA FRONTAL</span>
            </button>
          </div>
        </div>
      </div>
    </m.div>
  );
};