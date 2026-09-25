import * as React from 'react';
import { Popover } from '@/components/ui/popover';
import { LORE_GLOSSARY_TERMS } from '@/lib/config/lore/glossary-terms';
import type { LoreGlossaryTerm } from '@/lib/config/lore/types';
import { Sparkles, BookOpen } from 'lucide-react';

export interface LoreTermProps {
  /** Clave del término en LORE_GLOSSARY_TERMS (ej. 'mafuba', 'zenkai', 'senzu') */
  termKey?: string;
  /** O definición directa de término */
  termDefinition?: LoreGlossaryTerm;
  /** Texto personalizado para envolver; si no se provee se usa el nombre del término */
  children?: React.ReactNode;
  className?: string;
}

const CATEGORY_COLORS: Record<LoreGlossaryTerm['category'], { badge: string; text: string }> = {
  técnica: { badge: 'bg-red-500/15 border-red-500/30 text-red-300', text: 'text-red-400' },
  objeto: { badge: 'bg-blue-500/15 border-blue-500/30 text-blue-300', text: 'text-blue-400' },
  raza: { badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', text: 'text-emerald-400' },
  'concepto-ki': { badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300', text: 'text-amber-400' },
  lugar: { badge: 'bg-purple-500/15 border-purple-500/30 text-purple-300', text: 'text-purple-400' },
  evento: { badge: 'bg-orange-500/15 border-orange-500/30 text-orange-300', text: 'text-orange-400' },
};

/**
 * Componente interactivo para enriquecer sinopsis y crónicas con Lore oficial.
 * Al hacer clic, abre un popover con kanji, categoría, contexto histórico y cita bibliográfica.
 */
export const LoreTerm: React.FC<LoreTermProps> = ({
  termKey,
  termDefinition,
  children,
  className = '',
}) => {
  const term = termDefinition ?? (termKey ? LORE_GLOSSARY_TERMS[termKey] : undefined);

  if (!term) {
    return <>{children}</>;
  }

  const categoryStyle = CATEGORY_COLORS[term.category] ?? CATEGORY_COLORS['concepto-ki'];

  const trigger = (
    <button
      type="button"
      className={`inline-flex items-center gap-0.5 font-medium underline decoration-amber-400/50 decoration-dotted underline-offset-4 hover:decoration-amber-400 hover:text-amber-300 transition-colors cursor-pointer select-text text-inherit ${className}`}
    >
      <span>{children ?? term.term}</span>
      <Sparkles className="w-2.5 h-2.5 text-amber-400 inline shrink-0 ml-0.5 opacity-80" />
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      align="center"
      sideOffset={6}
      className="w-80 max-w-[90vw] p-4 bg-zinc-950/95 border border-white/20 rounded-2xl shadow-elevation-3 backdrop-blur-overlay-xl space-y-2.5 text-left font-sans text-xs"
    >
      {/* Header: Title + Kanji + Category */}
      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-display font-black text-sm text-white tracking-wide uppercase">
              {term.term}
            </h4>
            {term.kanji && (
              <span className="font-kanji text-xs text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {term.kanji}
              </span>
            )}
          </div>
          {term.romaji && (
            <span className="text-3xs font-mono text-on-surface-variant block">
              {term.romaji}
            </span>
          )}
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold uppercase tracking-wider border shrink-0 ${categoryStyle.badge}`}
        >
          {term.category}
        </span>
      </div>

      {/* Short Definition */}
      <p className="text-on-surface text-xs leading-relaxed font-medium">
        {term.shortDefinition}
      </p>

      {/* Detailed Context */}
      <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-on-surface-variant text-3xs font-mono leading-relaxed space-y-1">
        <span className="text-amber-400 font-bold uppercase tracking-wider block">
          Contexto Oficial:
        </span>
        <p className="font-sans text-xs text-on-surface/90">
          {term.detailedContext}
        </p>
      </div>

      {/* Source Citation */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 text-3xs font-mono text-zinc-400">
        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="truncate">Fuente: {term.sourceCitation}</span>
      </div>
    </Popover>
  );
};
