import React, { useState, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
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
import { useReducedMotion } from '@/components/ui/kinetics/hooks';

export interface InterludeDividerProps {
  interlude: ChronologyInterlude;
  /** Lapso destino: sirve la línea "Al empezar el siguiente lapso". Null en el epílogo. */
  toVolume?: VolumeData | null;
  accentHex?: string;
}

const KIND_ICON: Record<ChronologyInterlude['kind'], React.ReactNode> = {
  'time-jump': <Hourglass className="w-3 h-3" />,
  training: <Swords className="w-3 h-3" />,
  'cosmic-event': <Sparkles className="w-3 h-3" />,
  paradox: <Zap className="w-3 h-3" />,
  context: <Info className="w-3 h-3" />,
  transition: <ArrowRight className="w-3 h-3" />,
};

export const InterludeDivider: React.FC<InterludeDividerProps> = memo(
  ({ interlude, toVolume, accentHex }) => {
    const reduceMotion = useReducedMotion();
    const [isExpanded, setIsExpanded] = useState(false);
    const isEpilogue = interlude.toVolumeId === null;

    const isYears = interlude.gap.scale === 'anios';
    const isContinuo = interlude.gap.scale === 'continuo';
    const accent = accentHex ?? '#f59e0b';

    const movies = (interlude.movieIds ?? [])
      .map((id) => DRAGON_BALL_MOVIES_LORE[id])
      .filter(Boolean);

    // Villanos activos del lapso destino (worldStateAtStart del span canónico).
    const destSpan = toVolume
      ? DRAGON_BALL_STORY_SPANS.find((s) => s.id === toVolume.id)
      : undefined;
    const destVillains = destSpan?.worldStateAtStart.activeVillains ?? [];
    const destThreat =
      toVolume?.threatLevel ?? destSpan?.worldStateAtStart.threatLevel;
    const destBalls =
      toVolume?.dragonBallsStatus ?? destSpan?.worldStateAtStart.dragonBallsStatus;

    return (
      <div
        id={`interlude-${interlude.id}`}
        className="relative pl-6 sm:pl-10 select-none"
      >
        {/* Nodo sobre la columna vertical */}
        <div
          aria-hidden="true"
          className="absolute -left-[23px] sm:-left-[31px] top-3.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 shadow-sm bg-bg-primary"
          style={{
            borderColor: isYears ? `${accent}80` : 'rgba(255,255,255,0.15)',
            color: isYears ? accent : 'var(--color-on-surface-variant, #a1a1aa)',
          }}
        >
          {KIND_ICON[interlude.kind]}
        </div>

        <div
          className={`w-full rounded-2xl border transition-colors duration-200 overflow-hidden ${
            isContinuo
              ? 'border-dashed border-white/10 bg-bg-primary/30'
              : isYears
                ? 'bg-bg-primary/60 backdrop-blur-overlay-md shadow-elevation-1'
                : 'border-dashed border-white/15 bg-bg-primary/40'
          }`}
          style={isYears ? { borderColor: `${accent}45` } : undefined}
        >
          {/* Cabecera expandible (botón propio, independiente de las filas) */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={`interlude-body-${interlude.id}`}
            onClick={() => {
              sounds.playSelect();
              setIsExpanded((v) => !v);
            }}
            className="w-full flex items-center gap-2 sm:gap-2.5 px-3 py-2 text-left cursor-pointer min-h-[44px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent select-none"
          >
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-3xs sm:text-2xs font-bold border shrink-0 tabular-nums ${
                isYears ? '' : 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent'
              }`}
              style={
                isYears
                  ? {
                      backgroundColor: `${accent}20`,
                      borderColor: `${accent}50`,
                      color: accent,
                    }
                  : undefined
              }
            >
              {KIND_ICON[interlude.kind]}
              <span>{interlude.gap.label}</span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-display font-bold text-2xs sm:text-xs text-white uppercase tracking-wide truncate">
                {interlude.title}
              </span>
              {!isExpanded && (
                <span className="block text-2xs font-mono text-on-surface-variant truncate">
                  {interlude.summary}
                </span>
              )}
            </span>

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

          <AnimatePresence initial={false}>
            {isExpanded && (
              <m.div
                id={`interlude-body-${interlude.id}`}
                initial={reduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
                animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden border-t border-white/10"
              >
                <div className="px-3 sm:px-4 py-3 flex flex-col gap-3">
                  <p className="text-xs sm:text-sm text-on-surface/90 leading-relaxed text-pretty">
                    {interlude.summary}
                  </p>

                  {interlude.offscreen && interlude.offscreen.length > 0 && (
                    <div className="flex flex-col gap-1.5">
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
                              className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-white/40"
                            />
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {movies.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-2xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                        <Clapperboard className="w-3.5 h-3.5" />
                        {movies.length === 1 ? 'Película en este hueco' : 'Películas en este hueco'}
                      </span>
                      <div className="flex flex-col gap-2">
                        {movies.map((movie) => (
                          <div
                            key={movie.id}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 flex flex-col gap-1"
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

                  {toVolume && (destThreat || destVillains.length > 0 || destBalls) && (
                    <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 flex flex-col gap-1">
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
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);

InterludeDivider.displayName = 'InterludeDivider';
