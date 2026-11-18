import * as React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { EraFilter } from './types';
import { ChronologyEraNav, type EraProgress } from './ChronologyEraNav';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import { cn } from '@/components/ui/core/styling';
import type { TimelineOrder } from './data/releaseOrder';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';

interface HeaderProps {
  currentEraFilter: EraFilter;
  onSelectEraFilter: (era: EraFilter) => void;
  eraProgress: Record<EraFilter, EraProgress>;
  /** Era que se ve al desplazarse (scroll-spy). */
  spyEraId?: EraFilter;
  /** Orden de la línea de tiempo: reordena las eras de la barra. */
  order?: TimelineOrder;
  /** Controles de vista y orden, a la derecha del título. */
  actions?: React.ReactNode;
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
  spyEraId,
  order = 'chronological',
  actions,
}) => {
  const isClassic = useIsClassicMode();
  const reduceMotion = useReducedMotion();
  const meta = ERA_HEADER_META[currentEraFilter] ?? ERA_HEADER_META.all;

  return (
    <section className="relative page-container pt-4 md:pt-20 pb-4 select-none flex flex-col justify-start space-y-4 shrink-0">

      {/* 1. Barra de eras: riel fijo (portal) con avance y era visible; no ocupa una franja del flujo */}
      <ChronologyEraNav activeEraId={currentEraFilter} onSelectEra={onSelectEraFilter} eraProgress={eraProgress} spyEraId={spyEraId} order={order} />

      {/* 2. Fila: título y progreso de completitud */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-3 min-w-0 pt-1">
        <div
          className="chrono-era-kanji-frame w-10 h-10 rounded-xl p-[2px] shrink-0 transition-[background] duration-base ease-smooth-out"
          style={{
            background: isClassic
              ? 'var(--neutral-separator)'
              : `linear-gradient(135deg, ${meta.accent}, transparent 80%)`,
          }}
        >
          <div
            className={cn(
              "chrono-era-kanji-badge w-full h-full rounded-xl flex items-center justify-center border transition-colors duration-base overflow-hidden",
              isClassic
                ? "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] border-t-[var(--glass-border-top)]"
                : cn(meta.badgeBg, meta.badgeBorder)
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={meta.kanji}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                transition={{ duration: reduceMotion ? 0.08 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "chrono-era-kanji-glyph font-kanji font-black text-xl leading-none",
                  isClassic ? "text-[var(--label-1)]" : meta.badgeText
                )}
              >
                {meta.kanji}
              </m.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs text-label-2 tabular-nums">
            Dragon Ball · <span className="whitespace-nowrap">{order === 'release' ? 'Orden de estreno' : 'Año 749–790'}</span>{' '}
            <span className="whitespace-nowrap">
              · <ElasticCounter value={eraProgress.all.read} className="align-bottom" />/{eraProgress.all.count} lapsos vistos
            </span>
          </p>
          <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-on-surface leading-none text-balance">
            Línea de tiempo
          </h1>
        </div>
        {actions && <div className="sm:ml-auto">{actions}</div>}
      </div>
    </section>
  );
};