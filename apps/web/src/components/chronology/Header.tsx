import * as React from 'react';
import { m } from 'framer-motion';
import { EraFilter } from './types';
import { ChronologyEraNav, type EraProgress } from './ChronologyEraNav';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { IconNavigationSearch, IconUiClose } from '@/components/ui/icons';
import { BookOpen } from 'lucide-react';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';

export type StatusFilter = 'all' | 'pending' | 'watched';

interface HeaderProps {
  currentEraFilter: EraFilter;
  onSelectEraFilter: (era: EraFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  eraProgress: Record<EraFilter, EraProgress>;
  onOpenEncyclopedia?: () => void;
  /** Controles extra junto a la enciclopedia (p. ej. el menú de vista). */
  actions?: React.ReactNode;
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
  eraProgress,
  onOpenEncyclopedia,
  actions,
}) => {
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
    <section className="relative w-full pt-3 md:pt-[4.75rem] pb-1 select-none shrink-0">
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

      <div className="page-container relative z-10 space-y-3">
        {/* Fila 1: título a la izquierda; búsqueda y enciclopedia a la derecha */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-[2px] shadow-[0_0_24px_rgba(245,158,11,0.35)] shrink-0">
              <div className="w-full h-full bg-amber-950/85 rounded-[10px] flex items-center justify-center border border-amber-400/30">
                <span className="font-kanji font-black text-amber-300 text-xl leading-none">亀</span>
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

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:w-72">
              <IconNavigationSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="input-search-volumes"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar lapso o saga…"
                aria-keyshortcuts="/"
                className="w-full min-h-[44px] bg-white/[0.04] border border-white/15 border-t-white/25 border-b-white/5 rounded-full pl-10 pr-10 text-xs font-medium text-white placeholder:text-on-surface-variant/55 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/40 transition-colors duration-200"
              />
              {!searchQuery && (
                <kbd
                  aria-hidden="true"
                  className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-5 min-w-[20px] items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-1.5 font-mono text-3xs text-on-surface-variant pointer-events-none"
                >
                  /
                </kbd>
              )}
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

            {onOpenEncyclopedia && (
              <button
                type="button"
                onClick={onOpenEncyclopedia}
                title="Artefactos, líneas temporales y glosario"
                aria-label="Enciclopedia"
                className="min-h-[44px] min-w-[44px] px-3 min-[400px]:px-4 rounded-full inline-flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/50 text-amber-200 text-xs font-semibold shrink-0 transition-[color,background-color,border-color,transform] cursor-pointer active:scale-95"
              >
                <BookOpen className="w-4 h-4 text-amber-400" aria-hidden="true" />
                {/* En pantallas muy angostas queda solo el ícono para que el buscador tenga lugar */}
                <span className="hidden min-[400px]:inline">Enciclopedia</span>
              </button>
            )}
            {actions}
          </div>
        </div>

        {/* Fila 2: eras (el filtro de estado vive en la barra de progreso) */}
        <div className="min-w-0">
          <ChronologyEraNav activeEraId={currentEraFilter} onSelectEra={onSelectEraFilter} eraProgress={eraProgress} />
        </div>
      </div>
    </section>
  );
};