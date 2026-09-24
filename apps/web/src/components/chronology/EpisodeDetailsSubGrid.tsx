import React, { memo } from 'react';
import { VolumeData, ChapterMilestone } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { sounds } from './utils/audio';
import { Sparkles, ArrowRight, Film } from 'lucide-react';

interface EpisodeDetailsSubGridProps {
  volume: VolumeData;
  onInspectEpisode?: (volume: VolumeData, episodeIndex: number) => void;
  className?: string;
}

export const EpisodeDetailsSubGrid: React.FC<EpisodeDetailsSubGridProps> = memo(({
  volume,
  onInspectEpisode,
  className = '',
}) => {
  const milestones: ChapterMilestone[] = volume.detailedStory?.episodeMilestones || [];

  if (milestones.length === 0) {
    return null;
  }

  const accent = volume.coverArt.accentHex || 'hsl(var(--brand-accent))';

  const handleInspect = (idx: number) => {
    sounds.playSelect();
    if (onInspectEpisode) {
      onInspectEpisode(volume, idx);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center shrink-0">
            <Film className="w-3.5 h-3.5 text-brand-accent" />
          </span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono truncate">
            Hitos & episodios clave del lapso
          </h4>
          <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-on-surface-variant border border-white/10 font-bold shrink-0">
            {milestones.length}
          </span>
        </div>
        <span className="text-2xs text-on-surface-variant/70 font-mono hidden md:inline shrink-0">
          Secuencia cronológica canónica
        </span>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pb-1">
          {milestones.map((milestone, idx) => {
            return (
              <button
                key={milestone.episode || idx}
                type="button"
                onClick={() => handleInspect(idx)}
                aria-label={`Ver ${milestone.episode}: ${milestone.title}`}
                title={`${milestone.episode} — ${milestone.title}`}
                className="group/thumb relative text-left bg-surface-container-low/80 hover:bg-surface-container border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden cursor-pointer shadow-elevation-1 hover:shadow-elevation-2 transition-colors flex flex-col min-h-[176px] active:scale-95"
              >
                <div
                  className="relative aspect-video w-full p-2.5 flex items-start justify-between overflow-hidden border-b border-white/[0.06] shrink-0"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 22%, var(--bg-primary, #0a0a0b)) 0%, #0e0e11 62%, var(--bg-primary, #0a0a0b) 100%)`,
                  }}
                >
                  <EpisodeThumbnailImg
                    volume={volume}
                    milestone={milestone}
                    className="absolute inset-0 w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/45 pointer-events-none" />
                  <div
                    className="absolute -right-6 -top-8 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded-md text-3xs font-mono font-black bg-bg-primary/80 text-brand-accent border border-white/15 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-bg-primary/70 text-white border border-white/15 truncate">
                      {milestone.episode}
                    </span>
                  </div>
                  <span
                    className="relative z-10 text-base leading-none group-hover/thumb:scale-125 transition-transform shrink-0"
                    aria-hidden
                  >
                    {milestone.iconEmoji || '⚡'}
                  </span>
                </div>

                <div className="p-3 flex flex-col flex-1 gap-1.5 min-w-0">
                  <h5
                    className="text-xs font-bold text-on-surface group-hover/thumb:text-brand-accent transition-colors line-clamp-1 leading-snug"
                    title={milestone.title}
                  >
                    {milestone.title}
                  </h5>
                  <p
                    className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 min-h-[32px]"
                    title={milestone.synopsis}
                  >
                    {milestone.synopsis}
                  </p>

                  <div className="mt-auto pt-2 border-t border-white/[0.06] flex flex-col gap-1">
                    {milestone.sceneHighlight && (
                      <p className="text-2xs font-mono text-on-surface-variant line-clamp-1 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 shrink-0 text-brand-accent" />
                        <span className="truncate italic">{milestone.sceneHighlight}</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 min-h-[20px]">
                      <span className="text-2xs font-mono text-brand-accent/90 truncate">
                        {milestone.characterFocus || volume.characters.slice(0, 2).join(' & ')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-on-surface-variant/50 group-hover/thumb:text-white group-hover/thumb:translate-x-0.5 transition-[transform,color] duration-150" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

EpisodeDetailsSubGrid.displayName = 'EpisodeDetailsSubGrid';
