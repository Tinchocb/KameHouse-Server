import React, { memo, useState } from 'react';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import type { StorySpan } from '@/lib/config/dragonball_story_spans';
import { CheckCircle2, Clock } from 'lucide-react';

export interface EraHeroProps {
  seriesId: StorySpan['seriesId'];
  seriesTag: string;
  yearsLabel: string;
  accentHex: string;
  totalVolumes: number;
  readVolumes: number;
  kanji?: string;
  className?: string;
}

const BACKDROP_MAP: Record<StorySpan['seriesId'], string> = {
  classic: '/backdrops/lq/db.webp',
  z: '/backdrops/lq/dbz.webp',
  daima: '/backdrops/lq/dbdaima.webp',
  super: '/backdrops/lq/dbs.webp',
  gt: '/backdrops/lq/dbgt.webp',
};

export const ERA_KANJI: Record<StorySpan['seriesId'], string> = {
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
  kanji,
  className = '',
}) => {
  const emblem = kanji || ERA_KANJI[seriesId] || '龍';
  const backdrop = BACKDROP_MAP[seriesId] || '/backdrops/lq/dbz.webp';
  const progressPercent = totalVolumes > 0 ? Math.round((readVolumes / totalVolumes) * 100) : 0;
  const isComplete = totalVolumes > 0 && readVolumes === totalVolumes;

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
      className={`relative w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-950/80 my-6 scroll-mt-24 ${className}`}
      style={{ boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.07), 0 24px 60px -32px ${accentHex}66` }}
    >
      {/* Filete superior con el color de la era, como en las tarjetas de lapso */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${accentHex}, transparent)` }}
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

      {/* Dimmed blurred backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center opacity-30 filter blur-xs scale-105"
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
              className="w-12 h-12 rounded-xl flex items-center justify-center font-kanji font-black text-xl shadow-inner border border-white/20 select-none shrink-0"
              style={{
                backgroundColor: `${accentHex}20`,
                borderColor: `${accentHex}50`,
                color: accentHex,
              }}
            >
              {emblem}
            </div>

            <div className="flex flex-col">
              <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-wider">
                {seriesTag}
              </h2>
              <span className="font-mono text-xs text-on-surface-variant font-bold tabular-nums">
                {yearsLabel}
              </span>
            </div>
          </div>

          {/* Era Progress Pill & Status */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isComplete ? (
              <span
                key={celebration}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold shadow-sm ${celebration > 0 ? 'animate-success-pop' : ''}`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 text-emerald-400 stroke-[2.5] ${celebration > 0 ? 'animate-success-check delay-150' : ''}`}
                />
                <span>Era Completada</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-white/90 font-mono text-xs font-semibold tabular-nums">
                <Clock className="w-3.5 h-3.5 text-brand-accent" />
                <span className="inline-flex items-baseline">
                  <ElasticCounter value={readVolumes} />/{totalVolumes} lapsos
                </span>
                <span className="text-white/40">·</span>
                <span className="inline-flex items-baseline text-brand-accent">
                  <ElasticCounter value={progressPercent} />%
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Progress line */}
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          {/* scaleX en vez de width: avanza por el compositor, sin recalcular layout */}
          <div
            className="h-full w-full rounded-full origin-left transition-[transform,background-color] duration-500 ease-out-strong"
            style={{
              transform: `scaleX(${progressPercent / 100})`,
              backgroundColor: isComplete ? '#10b981' : accentHex,
            }}
          />
        </div>
      </div>
    </div>
  );
});

EraHero.displayName = 'EraHero';
