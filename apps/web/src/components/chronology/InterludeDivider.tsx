import React, { useState, memo } from 'react';
import { Chip } from './Chip';
import { ALL_ERAS_HEX, hexToRgbChannels, eraTextChannels } from './utils/eraColor';
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

interface InterludeDividerProps {
  interlude: ChronologyInterlude;
  toVolume?: VolumeData | null;
  accentHex?: string;
  isCentered?: boolean;
}

const KIND_ICON: Record<ChronologyInterlude['kind'], React.ReactNode> = {
  'time-jump': <Hourglass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  training: <Swords className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  'cosmic-event': <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  paradox: <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  context: <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  transition: <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
};

export const InterludeDivider: React.FC<InterludeDividerProps> = memo(
  ({ interlude, toVolume, accentHex }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // El cuerpo se monta al abrirlo por primera vez y queda montado para que el cierre anime.
    const [hasOpened, setHasOpened] = useState(false);
    const isEpilogue = interlude.toVolumeId === null;

    const isYears = interlude.gap.scale === 'anios';
    const isContinuo = interlude.gap.scale === 'continuo';
    const accent = accentHex ?? ALL_ERAS_HEX;

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
        {/* Mobile spine node (hidden on lg since the pill is centered on the central spine) */}
        <div
          aria-hidden="true"
          className={`lg:hidden absolute left-3 -translate-x-1/2 top-2.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 shadow-elevation-1 bg-surface-container-lowest transition-colors duration-fast ${
            isYears
              ? 'border-[rgb(var(--era)/0.6)] text-[rgb(var(--era-text))]'
              : 'border-[var(--neutral-separator)] text-label-2'
          }`}
          style={
            {
              '--era': hexToRgbChannels(accent),
              '--era-text': eraTextChannels(accent),
            } as React.CSSProperties
          }
        >
          {KIND_ICON[interlude.kind]}
        </div>

        {/* Centered pill on lg, full width on mobile. Sin blur: hay una por lapso y el vidrio se repetiría en la lista */}
        <div
          className={`relative isolate w-full lg:w-auto lg:max-w-xl rounded-2xl border bg-surface-container-lowest shadow-elevation-2 transition-[border-color,background-color,box-shadow] duration-base ease-smooth-out overflow-hidden group/interlude ${
            isYears ? 'border-[rgb(var(--era)/0.4)]' : 'border-[var(--neutral-separator)]'
          }`}
          style={
            {
              '--era': hexToRgbChannels(accent),
              '--era-text': eraTextChannels(accent),
            } as React.CSSProperties
          }
        >
          {/* Filete superior con brillo de la era si es de años */}
          {isYears && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[rgb(var(--era)/0.85)] to-transparent opacity-75"
            />
          )}

          {/* Header pill button */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={`interlude-body-${interlude.id}`}
            onClick={() => {
              setHasOpened(true);
              setIsExpanded((v) => !v);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left cursor-pointer min-h-[44px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent select-none active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.04] transition-[transform,background-color] duration-fast ease-smooth-out"
          >
            {/* Kind & Gap Badge */}
            <Chip
              tone={isYears ? 'era' : isContinuo ? 'quiet' : 'accent'}
              icon={KIND_ICON[interlude.kind]}
            >
              {interlude.gap.label}
            </Chip>

            <div className="min-w-0 flex-1">
              <span className="block font-display font-bold text-sm text-on-surface truncate" title={interlude.title}>
                {interlude.title}
              </span>
              {!isExpanded && (
                <span className="block text-2xs text-label-2 truncate" title={interlude.summary}>
                  {interlude.summary}
                </span>
              )}
            </div>

            {isEpilogue ? (
              <Chip tone="quiet" className="hidden sm:inline-flex">
                Epílogo
              </Chip>
            ) : toVolume?.officialYear ? (
              <Chip tone="quiet" className="hidden sm:inline-flex">
                Hacia {toVolume.officialYear}
              </Chip>
            ) : null}

            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 text-label-2 transition-transform duration-base shrink-0 ${
                isExpanded ? 'rotate-180 text-brand-accent' : ''
              }`}
            />
          </button>

          {/* Cajón: acordeón en CSS (grid-rows 0fr → 1fr) */}
          <div
            id={`interlude-body-${interlude.id}`}
            inert={!isExpanded}
            className={`grid transition-[grid-template-rows,opacity] duration-medium ease-expo-out motion-reduce:transition-none ${
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {hasOpened && (
                <div className="border-t border-[var(--neutral-separator)] p-3.5 sm:p-4 flex flex-col gap-3 text-xs">
                  <p className="text-on-surface leading-relaxed text-pretty font-sans">
                    {interlude.summary}
                  </p>

                  {/* Offscreen Events */}
                  {interlude.offscreen && interlude.offscreen.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-xs font-semibold text-brand-accent-readable">
                        Mientras tanto…
                      </span>
                      <ul className="flex flex-col gap-1 list-none">
                        {interlude.offscreen.map((fact, idx) => (
                          <li
                            key={`${interlude.id}-off-${idx}`}
                            className="flex items-start gap-2 text-xs text-on-surface leading-relaxed"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-brand-accent"
                            />
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Movies in this gap */}
                  {movies.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-xs font-semibold text-label-2 flex items-center gap-1.5">
                        <Clapperboard className="w-3.5 h-3.5 text-brand-accent" aria-hidden="true" />
                        <span>{movies.length === 1 ? 'Película en este hueco' : 'Películas en este hueco'}</span>
                      </span>
                      <div className="flex flex-col gap-2">
                        {movies.map((movie) => (
                          <div
                            key={movie.id}
                            className="surface-content surface-content-row rounded-xl p-3 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Play className="w-3 h-3 text-brand-accent fill-current shrink-0" aria-hidden="true" />
                              <span className="text-xs font-display font-bold text-on-surface">
                                {movie.title}
                              </span>
                              <Chip tone="quiet">
                                {movie.canonStatus}
                              </Chip>
                            </div>
                            {movie.chronologyNotes && (
                              <p className="text-xs text-label-2 leading-relaxed">
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
                    <div className="surface-content surface-content-row rounded-xl p-3 flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-on-surface">
                        Al empezar el siguiente lapso: {toVolume.title}
                      </span>
                      {toVolume.officialYear && (
                        <p className="text-xs text-on-surface leading-relaxed">
                          <span className="text-label-2">Fecha en el universo: </span>
                          <span className="font-semibold">{toVolume.officialYear}</span>
                        </p>
                      )}
                      {destThreat && (
                        <p className="text-xs text-on-surface leading-relaxed">
                          <span className="text-label-2">Amenaza: </span>
                          {destThreat}
                        </p>
                      )}
                      {destVillains.length > 0 && (
                        <p className="text-xs text-on-surface leading-relaxed">
                          <span className="text-label-2">Villanos activos: </span>
                          {destVillains.join(', ')}
                        </p>
                      )}
                      {destBalls && (
                        <p className="text-xs text-on-surface leading-relaxed">
                          <span className="text-label-2">Esferas: </span>
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
