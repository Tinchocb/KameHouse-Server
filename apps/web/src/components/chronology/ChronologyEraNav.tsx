import * as React from 'react';
import { cn } from '@/components/ui/core/styling';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { MagneticIndicator } from '@/components/ui/kinetics';
import { sounds } from './utils/audio';
import type { EraFilter } from './types';

export interface ChronoEraItem {
  id: EraFilter;
  title: string;
  shortTitle: string;
  years: string;
  kanji: string;
  colors: {
    accent: string;
    glow: string;
    glowStrong: string;
    textBrand: string;
    ambientGlow1: string;
    ambientGlow2: string;
  };
}

export const CHRONO_ERAS: ChronoEraItem[] = [
  {
    id: 'all',
    title: 'Todas las Eras',
    shortTitle: 'Todas',
    years: '749 - 790',
    kanji: '全',
    colors: {
      accent: 'rgba(255, 255, 255, 0.95)',
      glow: 'rgba(255, 255, 255, 0.35)',
      glowStrong: 'rgba(255, 255, 255, 0.6)',
      textBrand: 'text-black',
      ambientGlow1: '#ffffff',
      ambientGlow2: '#e4e4e7',
    },
  },
  {
    id: 'db-clasico',
    title: 'Dragon Ball (Original)',
    shortTitle: 'DB Original',
    years: '749 - 753',
    kanji: '亀',
    colors: ERA_COLOR_MAP.db,
  },
  {
    id: 'db-z',
    title: 'Dragon Ball Z',
    shortTitle: 'Dragon Ball Z',
    years: '761 - 774',
    kanji: '悟',
    colors: ERA_COLOR_MAP.dbz,
  },
  {
    id: 'db-daima',
    title: 'Dragon Ball Daima',
    shortTitle: 'DB Daima',
    years: '774 - 775',
    kanji: '魔',
    colors: ERA_COLOR_MAP.dbdaima,
  },
  {
    id: 'db-super',
    title: 'Dragon Ball Super',
    shortTitle: 'DB Super',
    years: '778 - 780',
    kanji: '超',
    colors: ERA_COLOR_MAP.dbs,
  },
  {
    id: 'db-gt',
    title: 'Dragon Ball GT',
    shortTitle: 'DB GT',
    years: '789 - 790',
    kanji: '星',
    colors: ERA_COLOR_MAP.dbgt,
  },
];

export interface EraProgress {
  count: number;
  read: number;
}

export interface ChronologyEraNavProps {
  activeEraId: EraFilter;
  onSelectEra: (eraId: EraFilter) => void;
  eraProgress?: Record<EraFilter, EraProgress>;
}

export const ChronologyEraNav = React.memo(function ChronologyEraNav({
  activeEraId,
  onSelectEra,
  eraProgress,
}: ChronologyEraNavProps) {
  const reduceMotion = useReducedMotion();
  const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);

  // Pulsating glow + layoutId active indicator only on capable hardware and when reduced motion is off
  const allowEraFx = isHeavyAllowed && !reduceMotion;

  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const focusEraAt = (index: number) => {
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (index + 1) % CHRONO_ERAS.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (index - 1 + CHRONO_ERAS.length) % CHRONO_ERAS.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = CHRONO_ERAS.length - 1;
        break;
      default:
        return;
    }
    const targetEra = CHRONO_ERAS[newIndex];
    if (targetEra) {
      sounds.playSelect();
      onSelectEra(targetEra.id);
      focusEraAt(newIndex);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Navegación de Eras de la Cronología"
      className="glass-frosted-pill relative z-20 flex items-center justify-between gap-2 w-full p-1.5 sm:p-2 overflow-hidden"
    >
      <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full flex-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]">
        {CHRONO_ERAS.map((era, index) => {
          const isEraActive = era.id === activeEraId;
          const eraColors = era.colors;
          const progress = eraProgress?.[era.id];
          const readPercent = progress && progress.count > 0 ? (progress.read / progress.count) * 100 : 0;

          return (
            <button
              key={era.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isEraActive}
              tabIndex={isEraActive ? 0 : -1}
              onClick={() => {
                sounds.playSelect();
                onSelectEra(era.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              title={
                progress
                  ? `Filtrar por ${era.title} (${era.years}) — ${progress.read} de ${progress.count} lapsos vistos`
                  : `Filtrar por ${era.title} (${era.years})`
              }
              className={cn(
                'group relative flex flex-[1_0_auto] items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-full text-center select-none active:scale-95 transition-[transform,background-color,color,opacity] duration-fast ease-out-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black cursor-pointer',
                isEraActive
                  ? era.id === 'all'
                    ? 'text-black font-black'
                    : 'text-white font-extrabold'
                  : 'text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.08] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]',
              )}
            >
              {/* Active Pill: adopts the vibrant accent color of the era with MagneticIndicator */}
              <MagneticIndicator
                layoutId="activeChronoEraPill"
                active={isEraActive}
                disableAnimation={!allowEraFx}
                className={cn(
                  'border-t',
                  era.id === 'all' ? 'border-t-white' : 'border-t-white/50'
                )}
                style={{
                  background: eraColors.accent,
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.35)',
                }}
              />

              {/* Kanji Circle matching SpotlightEraNav canonical styling */}
              <div
                className={cn(
                  'relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-2xs sm:text-xs select-none shrink-0 transition-colors duration-fast ease-smooth-out border',
                  isEraActive
                    ? era.id === 'all'
                      ? 'text-black font-black shadow-elevation-1 bg-black/10 border-black/20'
                      : 'text-white shadow-elevation-1 bg-black/25 border-white/40'
                    : 'text-white/80 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white',
                )}
                style={
                  isEraActive
                    ? undefined
                    : {
                        borderColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 35%, rgba(255,255,255,0.12))`,
                        backgroundColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 10%, transparent)`,
                        color: `color-mix(in srgb, ${eraColors.ambientGlow1} 90%, #ffffff)`,
                      }
                }
              >
                {era.kanji}
              </div>

              {/* Text label: clean, no numbers inside pill */}
              <div className="relative z-10 flex flex-col text-center items-center justify-center min-w-0 pr-0.5">
                <span
                  className={cn(
                    'font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap transition-colors duration-fast ease-smooth-out',
                    isEraActive
                      ? era.id === 'all'
                        ? 'text-black font-black'
                        : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                      : 'text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white',
                  )}
                >
                  {era.shortTitle}
                </span>
                {progress && (
                  <span className="sr-only">
                    , {progress.read} de {progress.count} lapsos vistos
                  </span>
                )}
              </div>

              {/* Avance de la era: filete fino en lugar de números dentro de la pastilla */}
              {progress && progress.read > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute left-4 right-4 bottom-1 h-0.5 rounded-full bg-white/15 overflow-hidden z-10 pointer-events-none"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${readPercent}%`,
                      background: isEraActive ? 'rgba(255,255,255,0.9)' : eraColors.ambientGlow1,
                    }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
