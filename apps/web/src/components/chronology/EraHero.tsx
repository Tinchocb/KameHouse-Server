import React, { memo, useState } from 'react';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import type { StorySpan } from '@/lib/config/dragonball_story_spans';
import { CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eraTextChannels, eraTextColor } from './utils/eraColor';
import { DragonBallMeter } from './DragonBallMeter';
import { useIsClassicMode, useIsEraMode } from '@/lib/theme/use-classic-mode';
import { useMotionTier } from '@/components/ui/kinetics/hooks';

interface EraHeroProps {
  seriesId: StorySpan['seriesId'];
  seriesTag: string;
  yearsLabel: string;
  accentHex: string;
  totalVolumes: number;
  readVolumes: number;
  /** La línea de tiempo está filtrada a esta era. */
  isSolo?: boolean;
  /** Ver solo esta era, o volver a todas si ya está filtrada. */
  onToggleSolo?: () => void;
  className?: string;
}

const BACKDROP_MAP: Record<StorySpan['seriesId'], string> = {
  classic: '/backdrops/lq/db.webp',
  z: '/backdrops/lq/dbz.webp',
  daima: '/backdrops/lq/dbdaima.webp',
  super: '/backdrops/lq/dbs.webp',
  gt: '/backdrops/lq/dbgt.webp',
};

const ERA_KANJI: Record<StorySpan['seriesId'], string> = {
  classic: '亀',
  z: '界',
  daima: '大',
  super: '神',
  gt: '極',
};

export const EraHero: React.FC<EraHeroProps> = memo(({
  seriesId,
  seriesTag,
  yearsLabel,
  accentHex,
  totalVolumes,
  readVolumes,
  isSolo = false,
  onToggleSolo,
  className = '',
}) => {
  const emblem = ERA_KANJI[seriesId] || '龍';
  const backdrop = BACKDROP_MAP[seriesId] || '/backdrops/lq/dbz.webp';
  const progressPercent = totalVolumes > 0 ? Math.round((readVolumes / totalVolumes) * 100) : 0;
  const isComplete = totalVolumes > 0 && readVolumes === totalVolumes;
  const isClassic = useIsClassicMode();
  // Las esferas son un guiño de Por era: se apagan con movimiento reducido y en equipos en ahorro.
  const isEraMode = useIsEraMode();
  const motionTier = useMotionTier();
  const showDragonBalls = isEraMode && motionTier === 'full';

  // Festejo solo cuando la era se completa ahora (al marcar el último lapso), no al
  // cargar una era que ya estaba completa. `celebration` cambia para repetir la animación.
  const [wasComplete, setWasComplete] = useState(isComplete);
  const [celebration, setCelebration] = useState(0);
  if (isComplete !== wasComplete) {
    setWasComplete(isComplete);
    if (isComplete) setCelebration((n) => n + 1);
  }

  return (
    <div
      id={`era-${seriesId}`}
      // Color de texto de la era: en Por era el reloj y el porcentaje lo toman (themes/era.css).
      style={{ '--era-text': isClassic ? '255 255 255' : eraTextChannels(accentHex) } as React.CSSProperties}
      className={`sectionbar relative w-full overflow-hidden my-6 scroll-mt-24 ${className}`}
    >
      {/* Filete superior con el color de la era, como en las tarjetas de lapso */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
        style={{ background: isClassic ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.7), transparent)' : `linear-gradient(to right, transparent, ${accentHex}, transparent)` }}
      />

      {/* Festejo de era completada: un destello cruza la cabecera una sola vez */}
      {celebration > 0 && (
        <span
          key={celebration}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 animate-era-complete-sweep motion-reduce:hidden"
          style={{ background: `linear-gradient(100deg, transparent 30%, ${accentHex}55 48%, rgb(255 255 255 / 0.18) 50%, ${accentHex}55 52%, transparent 70%)` }}
        />
      )}

      {/* Dimmed backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-center opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/30" />
      </div>

      {/* Decorative Kanji background watermark */}
      <div
        aria-hidden="true"
        className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 font-kanji font-black text-7xl sm:text-9xl text-white/[0.04] select-none pointer-events-none"
      >
        {emblem}
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Era Kanji Avatar */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-kanji font-black text-xl shadow-inner border select-none shrink-0"
              style={
                isClassic
                  ? {
                      backgroundColor: 'var(--neutral-elev-2)',
                      borderColor: 'var(--neutral-separator)',
                      color: 'var(--label-1)',
                    }
                  : {
                      backgroundColor: `${accentHex}20`,
                      borderColor: `${accentHex}50`,
                      color: eraTextColor(accentHex),
                    }
              }
            >
              {emblem}
            </div>

            <div className="flex flex-col">
              <h2 className="font-display font-black text-xl sm:text-2xl text-on-surface uppercase tracking-wider text-balance">
                {seriesTag}
              </h2>
              <span className="text-xs text-label-2 font-semibold tabular-nums">
                {yearsLabel}
              </span>
            </div>
          </div>

          {/* Era Progress Pill & Status */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {onToggleSolo && (
              <Button intent="secondary" size="sm" onClick={onToggleSolo}>
                {isSolo ? 'Ver todas las eras' : 'Ver solo esta era'}
              </Button>
            )}
            {isComplete ? (
              <span
                key={celebration}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success/20 border border-status-success/40 text-status-success text-xs font-bold shadow-[shadow:var(--elevation-1)] ${celebration > 0 ? 'animate-success-pop' : ''}`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 text-status-success stroke-[2.5] ${celebration > 0 ? 'animate-success-check delay-150' : ''}`}
                />
                <span>Era completada</span>
              </span>
            ) : (
              <span className="chrono-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] text-on-surface text-xs font-semibold tabular-nums">
                <Clock className="chrono-era-clock w-3.5 h-3.5 text-brand-accent" />
                <span className="inline-flex items-baseline">
                  <ElasticCounter value={readVolumes} />/{totalVolumes} {totalVolumes === 1 ? 'lapso' : 'lapsos'}
                </span>
                <span aria-hidden="true" className="text-white/40">·</span>
                <span className="chrono-era-percent inline-flex items-baseline text-brand-accent-readable">
                  <ElasticCounter value={progressPercent} />%
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Progress line (en Por era, con las 7 esferas del Dragón como hitos) */}
        <div className="flex w-full items-center gap-3">
          <div className="min-w-0 flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
            {/* scaleX en vez de width: avanza por el compositor, sin recalcular layout */}
            <div
              className="h-full w-full rounded-full origin-left transition-[transform,background-color] duration-very-slow ease-out-strong"
              style={{
                transform: `scaleX(${progressPercent / 100})`,
                backgroundColor: isClassic ? 'var(--selected-bg)' : isComplete ? 'var(--status-success)' : accentHex,
              }}
            />
          </div>
          {/* Sin redondear: con el porcentaje entero, 4/7 (57 %) y 5/7 (71 %) encendían una esfera de menos. */}
          {showDragonBalls && <DragonBallMeter percent={totalVolumes > 0 ? (readVolumes / totalVolumes) * 100 : 0} accentHex={accentHex} />}
        </div>
      </div>
    </div>
  );
});

EraHero.displayName = 'EraHero';
