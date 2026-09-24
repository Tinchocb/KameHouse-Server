import React from 'react';
import { VolumeData } from './types';
import { PosterArtwork } from './PosterArtwork';
import { sounds } from './utils/audio';
import { CheckCircle2, Circle, BookOpen, Sparkles, Clock, Swords, ShieldAlert, ArrowRight, Eye } from 'lucide-react';

interface StoryCardProps {
  volume: VolumeData;
  isRead: boolean;
  onToggleRead: () => void;
  onOpenReader: () => void;
  onInspectThumbnail: () => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  volume,
  isRead,
  onToggleRead,
  onOpenReader,
  onInspectThumbnail,
}) => {
  const accent = volume.coverArt.accentHex;

  return (
    <article
      id={`story-card-${volume.id}`}
      className={`group relative bg-surface-container/70 hover:bg-surface-container-high/80 border rounded-2xl p-4 sm:p-6 transition-all duration-200 flex flex-col gap-4 shadow-elevation-2 ${
        isRead
          ? 'border-brand-success/40 shadow-[0_4px_25px_rgba(34,197,94,0.08)]'
          : 'border-white/10 hover:border-white/25 hover:shadow-elevation-4'
      }`}
      style={{ '--poster-accent': accent, '--poster-glow': `0 0 30px ${accent}30` } as React.CSSProperties}
    >
      {/* Top Ambient Glow matching the volume theme */}
      <div
        className="absolute top-0 right-0 w-64 h-32 blur-xl pointer-events-none opacity-10 rounded-full transform-gpu"
        style={{ backgroundColor: accent }}
      />

      {/* Main Section: Small Thumbnail + Narrative Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 w-full">
        {/* MINIATURA PEQUEÑA (Small vertical thumbnail ~80x116px) */}
        <div className="relative shrink-0 self-center sm:self-start group/thumb">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Ampliar miniatura de ${volume.title}`}
            onClick={() => {
              sounds.playSelect();
              onInspectThumbnail();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sounds.playSelect();
                onInspectThumbnail();
              }
            }}
            className="w-20 h-28 sm:w-24 sm:h-34 aspect-[2/3] rounded-xl overflow-hidden border border-white/20 shadow-md relative cursor-pointer group-hover/thumb:border-brand-accent/50 group-hover/thumb:scale-105 transition-all duration-200 bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            style={{
              boxShadow: `0 8px 20px -4px ${accent}30`,
            }}
            title="Clic para ampliar miniatura"
          >
            {/* The bespoke artwork rendered inside miniature */}
            <PosterArtwork volume={volume} />

            {/* Subtle Gradient & Badge Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

            {/* Mini Volume Badge */}
            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-5xs font-mono font-bold uppercase bg-black/80 text-white/90 border border-white/20">
              {volume.volumeNumber.replace('Volumen ', 'VOL ')}
            </span>

            {/* Mini Kanji Glyph */}
            <span
              className="absolute bottom-1 right-1 font-kanji text-xs font-black drop-shadow"
              style={{ color: accent }}
            >
              {volume.coverArt.symbolGlyph}
            </span>

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
              <Eye className="w-5 h-5 text-brand-accent/80" />
            </div>
          </div>

          <button
            onClick={onInspectThumbnail}
            className="w-full text-center mt-1 min-h-[44px] py-1 text-3xs font-mono text-on-surface-variant hover:text-brand-accent flex items-center justify-center gap-1"
          >
            <span>Ver arte</span>
          </button>
        </div>

        {/* Narrative & Episode Lapso Information */}
        <div className="flex-1 flex flex-col justify-between w-full min-w-0">
          {/* Metadata Row: Episode Span, Year, Saga, Read Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center flex-wrap gap-2">
              {/* Lapso de Episodios Pill */}
              <span
                className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5 shadow-sm"
                style={{
                  backgroundColor: `${accent}18`,
                  borderColor: `${accent}40`,
                  color: accent,
                }}
              >
                <Clock className="w-3 h-3" />
                <span>{volume.episodesRange}</span>
              </span>

              {/* Official Year */}
              <span className="px-2 py-0.5 rounded text-2xs font-mono bg-surface-container-low text-on-surface-variant border border-white/10">
                {volume.officialYear}
              </span>

              {/* Series Tag */}
              <span className="text-2xs font-mono text-on-surface-variant/70 hidden sm:inline">
                {volume.seriesTag}
              </span>
            </div>

            {/* Mark as Read Toggle */}
            <button
              id={`btn-read-toggle-${volume.id}`}
              onClick={(e) => {
                e.stopPropagation();
                sounds.playSelect();
                onToggleRead();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                isRead
                  ? 'bg-status-success/20 text-status-success border-status-success/40 font-semibold'
                  : 'bg-surface-container-low/80 hover:bg-surface-container-low text-on-surface-variant hover:text-white border-white/10'
              }`}
            >
              {isRead ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                  <span>Leído</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 text-on-surface-variant/50" />
                  <span className="hidden min-[480px]:inline">Marcar leído</span>
                  <span className="min-[480px]:hidden">Leer</span>
                </>
              )}
            </button>
          </div>

          {/* Title & Dramatic Subtitle */}
          <h3 className="font-display text-2xl sm:text-3xl tracking-wide text-white group-hover:text-brand-accent/80 transition-colors">
            {volume.title}
          </h3>
          <p className="text-xs text-on-surface-variant/80 font-medium -mt-0.5 mb-2">
            {volume.subtitle}
          </p>

          {/* Core Story Summary (Contando la historia del lapso) */}
          <p className="text-xs sm:text-sm text-on-surface-variant/80 leading-relaxed line-clamp-3 sm:line-clamp-2">
            {volume.narrative.detonante.description} {volume.narrative.climax.description}
          </p>
        </div>
      </div>

      {/* 3 Plot Turning Points Grid (Detonante, Clímax, Secreto de Lore) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-white/5 text-xs">
        {/* 1. Detonante */}
        <div className="bg-surface-container-low/60 rounded-xl p-2.5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-mono font-bold text-brand-accent mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <span className="uppercase">Detonante Inicial</span>
            </div>
            <p className="text-on-surface font-medium line-clamp-2">
              {volume.narrative.detonante.title}
            </p>
          </div>
          <span className="text-3xs font-mono text-on-surface-variant/60 mt-1.5 truncate">
            {volume.narrative.detonante.exactEpisodePoint}
          </span>
        </div>

        {/* 2. Clímax */}
        <div className="bg-surface-container-low/60 rounded-xl p-2.5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-mono font-bold text-status-error mb-1">
              <Swords className="w-3.5 h-3.5 text-status-error shrink-0" />
              <span className="uppercase">Duelo / Clímax</span>
            </div>
            <p className="text-on-surface font-medium line-clamp-2">
              {volume.narrative.climax.title}
            </p>
          </div>
          <span className="text-3xs font-mono text-on-surface-variant/60 mt-1.5 truncate">
            {volume.narrative.climax.decisiveBattle}
          </span>
        </div>

        {/* 3. Secreto de Lore */}
        <div className="bg-surface-container-low/60 rounded-xl p-2.5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-mono font-bold text-brand-secondary mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
              <span className="uppercase">Secreto de Canon</span>
            </div>
            <p className="text-on-surface font-medium line-clamp-2">
              {volume.narrative.lore.title}
            </p>
          </div>
          <span className="text-3xs font-mono text-on-surface-variant/60 mt-1.5 truncate">
            {volume.narrative.lore.deityInvolved}
          </span>
        </div>
      </div>

      {/* Footer: Characters & Action Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
        {/* Characters Involved */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-3xs font-mono text-on-surface-variant/50 uppercase">Personajes:</span>
          {volume.characters.slice(0, 5).map((char) => (
            <span
              key={char}
              className="text-2xs font-mono px-2 py-0.5 rounded bg-surface-container-low text-white border border-white/5"
            >
              {char}
            </span>
          ))}
          {volume.characters.length > 5 && (
            <span className="text-3xs font-mono text-on-surface-variant/50">
              +{volume.characters.length - 5}
            </span>
          )}
        </div>

        {/* Read Chronicle Details Button */}
        <button
          id={`btn-open-chronicle-${volume.id}`}
          onClick={() => {
            sounds.playSelect();
            onOpenReader();
          }}
          className="flex items-center gap-1.5 text-xs font-mono font-bold text-brand-accent hover:text-brand-secondary hover:underline shrink-0 group-hover:translate-x-0.5 transition-transform"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Leer Crónica Completa</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
};