import React, { useEffect, useRef, useState, memo } from 'react';
import { Check, RotateCcw, SlidersHorizontal, CheckCheck } from 'lucide-react';
import { sounds } from './utils/audio';
import type { StatusFilter } from './Header';

export interface ChronologyViewMenuProps {
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  showInterludes: boolean;
  onToggleInterludes: () => void;
  totalVolumes: number;
  readCount: number;
  /** Se aplica al instante; el llamador ofrece "Deshacer". */
  onMarkAllRead: () => void;
  /** Se aplica al instante; el llamador ofrece "Deshacer". */
  onResetRead: () => void;
}

const STATUS_OPTIONS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'watched', label: 'Vistos' },
];

/**
 * Opciones de la lista en un solo botón: qué lapsos mostrar, interludios y acciones de progreso.
 * Con un filtro activo el botón lo nombra ("Pendientes") para que la lista filtrada no sorprenda.
 */
export const ChronologyViewMenu: React.FC<ChronologyViewMenuProps> = memo(
  ({ statusFilter, onStatusFilterChange, showInterludes, onToggleInterludes, totalVolumes, readCount, onMarkAllRead, onResetRead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    const isFiltered = statusFilter !== 'all';
    const activeLabel = STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label ?? 'Todos';
    const allRead = totalVolumes > 0 && readCount === totalVolumes;

    const itemClass =
      'w-full min-h-[40px] px-3 flex items-center gap-2.5 rounded-lg text-left text-xs hover:bg-white/10 cursor-pointer disabled:opacity-40 disabled:pointer-events-none';

    return (
      <div className="relative shrink-0" ref={rootRef}>
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={isFiltered ? `Opciones de vista (mostrando ${activeLabel.toLowerCase()})` : 'Opciones de vista'}
          onClick={() => {
            sounds.playSelect();
            setIsOpen((v) => !v);
          }}
          className={`min-h-[44px] min-w-[44px] px-3 min-[400px]:px-4 rounded-full inline-flex items-center justify-center gap-2 border text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out-strong cursor-pointer active:scale-[0.97] ${
            isFiltered
              ? 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/15 text-on-surface hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="hidden min-[400px]:inline">{isFiltered ? activeLabel : 'Vista'}</span>
        </button>

        {isOpen && (
          <div
            role="menu"
            aria-label="Opciones de vista"
            // Crece desde la esquina del botón que lo abre (arriba a la derecha).
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-white/15 bg-zinc-900 p-1.5 shadow-elevation-3 origin-top-right animate-menu-dropdown [animation-duration:180ms] [animation-timing-function:var(--ease-out)]"
          >
            <p className="px-3 pt-1.5 pb-1 font-mono text-3xs uppercase tracking-wider text-on-surface-variant">Mostrar</p>
            {STATUS_OPTIONS.map((opt) => {
              const checked = statusFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  onClick={() => {
                    sounds.playSelect();
                    onStatusFilterChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`${itemClass} ${checked ? 'text-white font-semibold' : 'text-on-surface-variant'}`}
                >
                  <Check className={`w-3.5 h-3.5 ${checked ? 'text-brand-accent' : 'invisible'}`} aria-hidden="true" />
                  {opt.label}
                </button>
              );
            })}

            <div className="my-1.5 h-px bg-white/10" />

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showInterludes}
              onClick={() => {
                sounds.playSelect();
                onToggleInterludes();
              }}
              className={`${itemClass} text-on-surface`}
            >
              <Check className={`w-3.5 h-3.5 ${showInterludes ? 'text-brand-accent' : 'invisible'}`} aria-hidden="true" />
              Interludios entre lapsos
            </button>

            <div className="my-1.5 h-px bg-white/10" />

            <button
              type="button"
              role="menuitem"
              disabled={allRead}
              onClick={() => {
                sounds.playSuccess();
                onMarkAllRead();
                setIsOpen(false);
              }}
              className={`${itemClass} text-on-surface`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-brand-accent" aria-hidden="true" />
              Marcar todos como vistos
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={readCount === 0}
              onClick={() => {
                sounds.playSelect();
                onResetRead();
                setIsOpen(false);
              }}
              className={`${itemClass} text-red-300`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
              Reiniciar progreso
            </button>
          </div>
        )}
      </div>
    );
  },
);

ChronologyViewMenu.displayName = 'ChronologyViewMenu';
