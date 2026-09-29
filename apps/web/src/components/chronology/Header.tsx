import * as React from 'react';
import { EraFilter } from './types';
import { ChronologyEraNav, type EraProgress } from './ChronologyEraNav';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import { cn } from '@/components/ui/core/styling';

interface HeaderProps {
  currentEraFilter: EraFilter;
  onSelectEraFilter: (era: EraFilter) => void;
  eraProgress: Record<EraFilter, EraProgress>;
}

const ERA_HEADER_META: Record<
  EraFilter,
  {
    accent: string;
    kanji: string;
    badgeBorder: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  all: {
    accent: 'rgba(255, 255, 255, 0.85)',
    kanji: '全',
    badgeBorder: 'border-white/20',
    badgeBg: 'bg-white/[0.08]',
    badgeText: 'text-white',
  },
  'db-clasico': {
    accent: ERA_COLOR_MAP.db.accent,
    kanji: '亀',
    badgeBorder: 'border-orange-500/40',
    badgeBg: 'bg-orange-950/80',
    badgeText: 'text-orange-400',
  },
  'db-z': {
    accent: ERA_COLOR_MAP.dbz.accent,
    kanji: '悟',
    badgeBorder: 'border-amber-400/40',
    badgeBg: 'bg-amber-950/80',
    badgeText: 'text-amber-300',
  },
  'db-daima': {
    accent: ERA_COLOR_MAP.dbdaima.accent,
    kanji: '魔',
    badgeBorder: 'border-purple-400/40',
    badgeBg: 'bg-purple-950/80',
    badgeText: 'text-purple-300',
  },
  'db-super': {
    accent: ERA_COLOR_MAP.dbs.accent,
    kanji: '超',
    badgeBorder: 'border-blue-400/40',
    badgeBg: 'bg-blue-950/80',
    badgeText: 'text-blue-300',
  },
  'db-gt': {
    accent: ERA_COLOR_MAP.dbgt.accent,
    kanji: '星',
    badgeBorder: 'border-rose-400/40',
    badgeBg: 'bg-rose-950/80',
    badgeText: 'text-rose-400',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentEraFilter,
  onSelectEraFilter,
  eraProgress,
}) => {
  const meta = ERA_HEADER_META[currentEraFilter] ?? ERA_HEADER_META.all;

  return (
    <section className="relative w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 md:pt-20 pb-4 select-none flex flex-col justify-start space-y-4 shrink-0">

      {/* 1. Barra de Navegación Horizontal de Eras (misma posición y altura que Home y Películas) */}
      <div className="relative z-10 w-full mt-4">
        <ChronologyEraNav activeEraId={currentEraFilter} onSelectEra={onSelectEraFilter} eraProgress={eraProgress} />
      </div>

      {/* 2. Fila: título y progreso de completitud */}
      <div className="relative z-10 flex items-center gap-3 min-w-0 pt-1">
        <div
          className="w-10 h-10 rounded-xl p-[2px] shrink-0 transition-colors duration-300"
          style={{
            background: `linear-gradient(135deg, ${meta.accent}, transparent 80%)`,
          }}
        >
          <div
            className={cn(
              "w-full h-full rounded-[10px] flex items-center justify-center border transition-colors duration-300",
              meta.badgeBg,
              meta.badgeBorder
            )}
          >
            <span className={cn("font-kanji font-black text-xl leading-none transition-colors duration-300", meta.badgeText)}>
              {meta.kanji}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.18em] sm:tracking-[0.3em] text-on-surface-variant tabular-nums">
            Dragon Ball · <span className="whitespace-nowrap">Año 749–790</span>{' '}
            <span className="whitespace-nowrap">
              · <ElasticCounter value={eraProgress.all.read} className="align-bottom" />/{eraProgress.all.count} vistos
            </span>
          </p>
          <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-none text-balance">
            Línea de tiempo
          </h1>
        </div>
      </div>
    </section>
  );
};