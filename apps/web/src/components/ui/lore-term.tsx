import * as React from 'react';
import { Popover } from '@/components/ui/popover';
import { LORE_GLOSSARY_TERMS } from '@/lib/config/lore/glossary-terms';
import type { LoreGlossaryTerm } from '@/lib/config/lore/types';
import { Sparkles, BookOpen } from 'lucide-react';

interface LoreTermProps {
  /** Clave del término en LORE_GLOSSARY_TERMS (ej. 'mafuba', 'zenkai', 'senzu') */
  termKey?: string;
  /** O definición directa de término */
  termDefinition?: LoreGlossaryTerm;
  /** Texto personalizado para envolver; si no se provee se usa el nombre del término */
  children?: React.ReactNode;
  className?: string;
}

const CATEGORY_COLORS: Record<LoreGlossaryTerm['category'], { badge: string; text: string }> = {
  técnica: { badge: 'bg-status-error/15 border-status-error/30 text-status-error', text: 'text-status-error' },
  objeto: { badge: 'bg-blue-500/15 border-blue-500/30 text-blue-300', text: 'text-blue-400' },
  raza: { badge: 'bg-status-success/15 border-status-success/30 text-status-success', text: 'text-status-success' },
  'concepto-ki': { badge: 'bg-status-warning/15 border-status-warning/30 text-status-warning', text: 'text-status-warning' },
  lugar: { badge: 'bg-purple-500/15 border-purple-500/30 text-purple-300', text: 'text-purple-400' },
  evento: { badge: 'bg-orange-500/15 border-orange-500/30 text-orange-300', text: 'text-orange-400' },
};

const CATEGORY_LABELS: Record<LoreGlossaryTerm['category'], string> = {
  técnica: 'Técnica',
  objeto: 'Objeto',
  raza: 'Raza',
  'concepto-ki': 'Concepto de ki',
  lugar: 'Lugar',
  evento: 'Evento',
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
      className={`inline-flex items-center gap-0.5 min-h-[32px] -my-1.5 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:-my-3 font-medium underline decoration-status-warning/50 decoration-dotted underline-offset-4 hover:decoration-status-warning hover:text-status-warning active:scale-[0.97] transition-[color,text-decoration-color,transform] duration-fast ease-out-strong cursor-pointer select-text text-inherit ${className}`}
    >
      <span>{children ?? term.term}</span>
      <Sparkles aria-hidden="true" className="w-2.5 h-2.5 text-status-warning inline shrink-0 ml-0.5 opacity-80" />
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      align="center"
      sideOffset={6}
      className="w-80 max-w-[90vw] p-4 bg-surface-container-lowest/95 border border-white/20 rounded-2xl shadow-elevation-3 backdrop-blur-overlay-xl space-y-2.5 text-left font-sans text-xs"
    >
      {/* Header: Title + Kanji + Category */}
      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-display font-black text-sm text-on-surface tracking-wide">
              {term.term}
            </h4>
            {term.kanji && (
              <span className="font-kanji text-xs text-status-warning font-bold bg-status-warning/10 px-1.5 py-0.5 rounded border border-status-warning/20">
                {term.kanji}
              </span>
            )}
          </div>
          {term.romaji && (
            <span className="text-2xs text-label-2 block">
              {term.romaji}
            </span>
          )}
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-2xs font-semibold border shrink-0 ${categoryStyle.badge}`}
        >
          {CATEGORY_LABELS[term.category] ?? term.category}
        </span>
      </div>

      {/* Short Definition */}
      <p className="text-on-surface text-xs leading-relaxed font-medium">
        {term.shortDefinition}
      </p>

      {/* Detailed Context */}
      <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-label-2 text-2xs leading-relaxed space-y-1">
        <span className="text-status-warning font-semibold block">
          Contexto oficial
        </span>
        <p className="text-xs text-on-surface">
          {term.detailedContext}
        </p>
      </div>

      {/* Source Citation */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 text-2xs text-label-2">
        <BookOpen aria-hidden="true" className="w-3 h-3 text-status-warning shrink-0" />
        <span className="truncate">Fuente: {term.sourceCitation}</span>
      </div>
    </Popover>
  );
};
