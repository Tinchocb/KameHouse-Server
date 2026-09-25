import * as React from 'react';
import { m } from 'framer-motion';
import { EraFilter, MovieFilterOption } from './types';
import { ChronologyEraNav } from './ChronologyEraNav';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { IconNavigationSearch, IconUiClose } from '@/components/ui/icons';
import { Sparkles, Tv, Film } from 'lucide-react';
import { MagneticIndicator } from '@/components/ui/kinetics/magnetic-indicator';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';

interface HeaderProps {
  currentEraFilter: EraFilter;
  onSelectEraFilter: (era: EraFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  volumeCountsByEra: Record<EraFilter, number>;
  movieFilter: MovieFilterOption;
  onSelectMovieFilter: (filter: MovieFilterOption) => void;
  movieCounts: { none: number; canon: number; all: number };
}

function getEraAccent(eraFilter: EraFilter): string {
  const eraMap: Record<EraFilter, keyof typeof ERA_COLOR_MAP> = {
    all: 'db',
    'db-clasico': 'db',
    'db-z': 'dbz',
    'db-daima': 'dbdaima',
    'db-super': 'dbs',
    'db-gt': 'dbgt',
  };
  return ERA_COLOR_MAP[eraMap[eraFilter]]?.accent || ERA_COLOR_MAP.db.accent;
}

export const Header: React.FC<HeaderProps> = ({
  currentEraFilter,
  onSelectEraFilter,
  searchQuery,
  onSearchChange,
  volumeCountsByEra,
  movieFilter,
  onSelectMovieFilter,
  movieCounts,
}) => {
  const reduceMotion = useReducedMotion();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const eraAccent = getEraAccent(currentEraFilter);

  // Global '/' keyboard shortcut to focus search input matching MoviesFilterBar
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <section className="relative w-full px-4 sm:px-6 md:px-8 xl:px-12 2xl:px-16 pt-4 md:pt-12 pb-4 space-y-4 select-none shrink-0">
      {/* Ambient Aura Background (matches MediaSpotlight pattern: subtle radial gradient at z-0) */}
      <div
        aria-hidden="true"
        className="absolute top-0 inset-x-0 h-[500px] sm:h-[560px] md:h-[640px] lg:h-[680px] pointer-events-none overflow-hidden z-0 transform-gpu"
      >
        <m.div
          key={currentEraFilter + "_aura"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none overflow-hidden transform-gpu"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 75% 30%, color-mix(in srgb, ${eraAccent} 18%, transparent) 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Row 1: Cinematic Brand Title & Quick Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title area */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-[2px] shadow-[0_0_24px_rgba(245,158,11,0.45)] shrink-0">
            <div className="w-full h-full bg-amber-950/80 rounded-lg flex items-center justify-center border border-amber-400/30">
              <span className="font-kanji font-black text-amber-300 text-xl leading-none drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">亀</span>
            </div>
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-none text-balance">
                DRAGON BALL <span className="text-brand-accent">LÍNEA DE TIEMPO</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-3xs font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-brand-accent/15 border border-brand-accent/30 text-brand-accent font-bold shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-brand-accent" /> Canon Oficial
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant font-mono truncate">
              Ordenada por el año dentro de la historia
            </p>
          </div>
        </div>

        {/* Search input matching MoviesFilterBar style with '/' focus and IconUiClose */}
        <div className="relative w-full sm:w-72 md:w-80 shrink-0">
          <IconNavigationSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
          <input
            ref={searchInputRef}
            id="input-search-volumes"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar lapsos, sagas... (/)"
            className="w-full bg-white/[0.04] border border-white/15 border-t-white/30 border-b-white/5 rounded-full py-2 pl-9 pr-9 text-xs font-medium text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/40 transition-colors duration-200 backdrop-blur-overlay-xl shadow-glass-highlight-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              <IconUiClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: ChronologyEraNav & Movie Filter */}
      <div className="pt-1 flex flex-col gap-3">
        <ChronologyEraNav
          activeEraId={currentEraFilter}
          onSelectEra={onSelectEraFilter}
          volumeCountsByEra={volumeCountsByEra}
        />

        {/* Películas y Especiales Selector Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div role="radiogroup" aria-label="Formato" className="flex items-center gap-1.5 p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-overlay-md text-xs font-mono">
            <span className="text-2xs uppercase tracking-wider text-on-surface-variant font-bold px-2.5 py-0.5 hidden sm:inline">
              Formato:
            </span>
            {(
              [
                { key: 'none', label: 'Solo Series', icon: <Tv className="w-3.5 h-3.5" /> },
                { key: 'canon', label: '+ Especiales Canónicos', icon: <Sparkles className="w-3.5 h-3.5" /> },
                { key: 'all', label: 'Todas las Películas (Multiverso Z)', icon: <Film className="w-3.5 h-3.5" /> },
              ] as const
            ).map((opt) => {
              const isSelected = movieFilter === opt.key;
              const count = movieCounts[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectMovieFilter(opt.key)}
                  className={`relative min-h-11 px-3.5 rounded-full text-xs font-mono font-medium transition-[color,background-color,transform] duration-base cursor-pointer select-none active:scale-95 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                    isSelected
                      ? 'text-zinc-950 font-bold'
                      : 'text-on-surface-variant hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <MagneticIndicator
                    layoutId="chronoMovieFilter"
                    active={isSelected}
                    disableAnimation={!!reduceMotion}
                    className="bg-brand-accent"
                  />
                  <span className="relative z-10 flex items-center gap-1.5">
                    {opt.icon}
                    <span>{opt.label}</span>
                    <span className={`text-2xs tabular-nums ${isSelected ? 'opacity-85' : 'opacity-60'}`}>
                      ({count})
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};