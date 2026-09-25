import React, { useState, memo } from 'react';
import {
  Hourglass,
  Swords,
  Sparkles,
  Zap,
  Info,
  ArrowRight,
  ChevronDown,
  Clapperboard,
  Play,
} from 'lucide-react';
import type { ChronologyInterlude } from './data/interludes';
import type { VolumeData } from './types';
import { DRAGON_BALL_MOVIES_LORE } from '@/lib/config/dragonball_movies_lore';
import { DRAGON_BALL_STORY_SPANS } from '@/lib/config/dragonball_story_spans';
import { sounds } from './utils/audio';
import { SmartLoreText } from '@/components/ui/smart-lore-text';

export interface InterludeDividerProps {
  interlude: ChronologyInterlude;
  toVolume?: VolumeData | null;
  accentHex?: string;
  isCentered?: boolean;
}

const KIND_ICON: Record<ChronologyInterlude['kind'], React.ReactNode> = {
  'time-jump': <Hourglass className="w-3.5 h-3.5" />,
  training: <Swords className="w-3.5 h-3.5" />,
  'cosmic-event': <Sparkles className="w-3.5 h-3.5" />,
  paradox: <Zap className="w-3.5 h-3.5" />,
  context: <Info className="w-3.5 h-3.5" />,
  transition: <ArrowRight className="w-3.5 h-3.5" />,
};

export const InterludeDivider: React.FC<InterludeDividerProps> = memo(
  ({ interlude, toVolume, accentHex }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // El cuerpo se monta al abrirlo por primera vez y queda montado para que el cierre anime.
    const [hasOpened, setHasOpened] = useState(false);
    const isEpilogue = interlude.toVolumeId === null;

    const isYears = interlude.gap.scale === 'anios';
    const isContinuo = interlude.gap.scale === 'continuo';
    const accent = accentHex ?? '#f59e0b';

    const movies = (interlude.movieIds ?? [])
      .map((id) => DRAGON_BALL_MOVIES_LORE[id])
      .filter(Boolean);

    const destSpan = toVolume
      ? DRAGON_BALL_STORY_SPANS.find((s) => s.id === toVolume.id)
      : undefined;
    const destVillains = destSpan?.worldStateAtStart.activeVillains ?? [];
    const destThreat = toVolume?.threatLevel ?? destSpan?.worldStateAtStart.threatLevel;
    const destBalls = toVolume?.dragonBallsStatus ?? destSpan?.worldStateAtStart.dragonBallsStatus;

    return (
      <div
        id={`interlude-${interlude.id}`}
        className="relative w-full my-6 z-20 flex flex-col items-start lg:items-center pl-8 lg:pl-0"
      >
        {/* Mobile spine node (hidden on md+ since the pill is centered on the central spine) */}
        <div
          aria-hidden="true"
          className="lg:hidden absolute left-3 -translate-x-1/2 top-2.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 shadow-sm bg-zinc-950"
          style={{
            borderColor: isYears ? `${accent}80` : 'rgba(255,255,255,0.2)',
            color: isYears ? accent : 'var(--color-on-surface-variant, #a1a1aa)',
          }}
        >
          {KIND_ICON[interlude.kind]}
        </div>

        {/* Centered pill on md+, full width on mobile */}
        <div
          className={`w-full lg:w-auto lg:max-w-xl rounded-2xl border transition duration-200 overflow-hidden shadow-elevation-1 ${
            isContinuo
              ? 'border-dashed border-white/15 bg-zinc-950/70'
              : isYears
                ? 'bg-zinc-950/90'
                : 'border-dashed border-white/20 bg-zinc-950/80'
          }`}
          style={isYears ? { borderColor: `${accent}60` } : undefined}
        >
          {/* Header pill button */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={`interlude-body-${interlude.id}`}
            onClick={() => {
              sounds.playSelect();
              setHasOpened(true);
              setIsExpanded((v) => !v);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left cursor-pointer min-h-[44px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent select-none active:scale-[0.99] transition-transform"
          >
            {/* Kind & Gap Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border shrink-0 tabular-nums ${
                isYears ? '' : 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent'
              }`}
              style={
                isYears
                  ? {
                      backgroundColor: `${accent}25`,
                      borderColor: `${accent}55`,
                      color: accent,
                    }
                  : undefined
              }
            >
              {KIND_ICON[interlude.kind]}
              <span>{interlude.gap.label}</span>
            </span>

            <div className="min-w-0 flex-1">
              <span className="block font-display font-bold text-xs text-white uppercase tracking-wide truncate">
                {interlude.title}
              </span>
              {!isExpanded && (
                <span className="block text-3xs font-mono text-on-surface-variant truncate">
                  {interlude.summary}
                </span>
              )}
            </div>

            {isEpilogue && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-white/[0.04] border border-white/10 text-on-surface-variant shrink-0">
                Epílogo
              </span>
            )}

            <ChevronDown
              className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 shrink-0 ${
                isExpanded ? 'rotate-180 text-brand-accent' : ''
              }`}
            />
          </button>

          {/* Cajón: acordeón en CSS (grid-rows 0fr → 1fr) */}
          <div
            id={`interlude-body-${interlude.id}`}
            inert={!isExpanded}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {hasOpened && (
                <div className="border-t border-white/10 p-3.5 sm:p-4 flex flex-col gap-3 text-xs">
                  <p className="text-on-surface/90 leading-relaxed text-pretty font-sans">
                    <SmartLoreText text={interlude.summary} />
                  </p>

                  {/* Offscreen Events */}
                  {interlude.offscreen && interlude.offscreen.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-2xs font-mono font-bold uppercase tracking-wider text-brand-accent">
                        Mientras tanto…
                      </span>
                      <ul className="flex flex-col gap-1 list-none">
                        {interlude.offscreen.map((fact, idx) => (
                          <li
                            key={`${interlude.id}-off-${idx}`}
                            className="flex items-start gap-2 text-xs text-on-surface/85 leading-relaxed"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-brand-accent/70"
                            />
                            <span>
                              <SmartLoreText text={fact} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Movies in this gap */}
                  {movies.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-2xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                        <Clapperboard className="w-3.5 h-3.5 text-blue-400" />
                        <span>{movies.length === 1 ? 'Película en este hueco' : 'Películas en este hueco'}</span>
                      </span>
                      <div className="flex flex-col gap-2">
                        {movies.map((movie) => (
                          <div
                            key={movie.id}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex flex-col gap-1"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Play className="w-3 h-3 text-brand-accent fill-current shrink-0" />
                              <span className="text-xs font-display font-bold text-white">
                                {movie.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-full text-3xs font-mono border border-white/15 bg-black/40 text-on-surface/85">
                                {movie.canonStatus}
                              </span>
                            </div>
                            {movie.chronologyNotes && (
                              <p className="text-2xs font-mono text-on-surface-variant leading-relaxed">
                                {movie.chronologyNotes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* World state transition into next span */}
                  {toVolume && (destThreat || destVillains.length > 0 || destBalls) && (
                    <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 flex flex-col gap-1">
                      <span className="text-2xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                        Al empezar el siguiente lapso
                      </span>
                      {destThreat && (
                        <p className="text-2xs font-mono text-on-surface/85 leading-relaxed">
                          <span className="text-on-surface-variant/70">Amenaza: </span>
                          {destThreat}
                        </p>
                      )}
                      {destVillains.length > 0 && (
                        <p className="text-2xs font-mono text-on-surface/85 leading-relaxed">
                          <span className="text-on-surface-variant/70">Villanos activos: </span>
                          {destVillains.join(', ')}
                        </p>
                      )}
                      {destBalls && (
                        <p className="text-2xs font-mono text-on-surface/85 leading-relaxed">
                          <span className="text-on-surface-variant/70">Esferas: </span>
                          {destBalls}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

InterludeDivider.displayName = 'InterludeDivider';
