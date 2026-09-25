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
    // --brand-accent guarda canales HSL ("0 0% 100%"): usado como color directo es inválido
    // y la píldora activa quedaba sin fondo. Neutro propio, válido con cualquier tema.
    colors: {
      accent: 'rgba(255, 255, 255, 0.16)',
      glow: 'rgba(255, 255, 255, 0.25)',
      glowStrong: 'rgba(255, 255, 255, 0.4)',
      textBrand: 'text-white',
      ambientGlow1: '#e4e4e7',
      ambientGlow2: '#a1a1aa',
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
      className="relative z-20 inline-flex max-w-full items-center bg-white/[0.04] border border-white/15 border-t-white/25 border-b-white/5 rounded-full p-1 shadow-glass-highlight-md"
    >
      <div className="flex items-center gap-1 max-w-full overflow-x-auto no-scrollbar snap-x snap-mandatory flex-nowrap scroll-smooth">
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
                'relative flex shrink-0 items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-full text-center shrink-0 snap-start select-none transition-[transform,background-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                isEraActive
                  ? 'text-white font-extrabold cursor-pointer'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
              )}
            >
              {/* Active Pill: adopts the vibrant accent color of the era with MagneticIndicator */}
              <MagneticIndicator
                layoutId="activeChronoEraPill"
                active={isEraActive}
                disableAnimation={!allowEraFx}
                style={{
                  background: eraColors.accent,
                  boxShadow: allowEraFx
                    ? 'inset 0 1px 1px rgba(255,255,255,0.45)'
                    : undefined,
                }}
              />

              {/* Kanji Circle matching SpotlightEraNav canonical styling */}
              <div
                className={cn(
                  'relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-2xs sm:text-xs select-none shrink-0 transition-colors duration-200 border',
                  isEraActive ? 'text-white shadow-elevation-1 bg-black/25 border-white/40' : '',
                )}
                style={
                  isEraActive
                    ? undefined
                    : {
                        borderColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 55%, rgba(255,255,255,0.12))`,
                        backgroundColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 14%, transparent)`,
                        color: eraColors.ambientGlow1,
                      }
                }
              >
                {era.kanji}
              </div>

              {/* Text label: clean, no numbers inside pill */}
              <div className="relative z-10 flex flex-col text-center items-center justify-center min-w-0 pr-0.5">
                <span
                  className={cn(
                    'font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap transition-colors duration-200',
                    isEraActive ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]' : '',
                  )}
                  style={
                    isEraActive
                      ? undefined
                      : { color: `color-mix(in srgb, ${eraColors.ambientGlow1} 80%, #e4e4e7)` }
                  }
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
