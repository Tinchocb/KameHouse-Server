import React from 'react';

type ChipTone = 'neutral' | 'era' | 'success' | 'accent' | 'saga' | 'quiet';

interface ChipProps {
  tone?: ChipTone;
  /** Clases de color de la saga (bg/border/text), solo con tone="saga". */
  sagaClass?: string;
  /** Sobre una portada: velo oscuro con desenfoque para leerse sobre cualquier arte. */
  overlay?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Etiqueta única de la cronología: misma altura, tipografía, borde y desenfoque en todas
 * las tarjetas; solo cambia el tono. Evita que cada pastilla tenga su propio estilo.
 */
const TONE: Record<Exclude<ChipTone, 'saga'>, string> = {
  neutral: 'border-white/15 bg-white/[0.05] text-on-surface',
  quiet: 'border-white/10 bg-white/[0.04] text-on-surface-variant',
  era: 'border-[rgb(var(--era)/0.55)] bg-[rgb(var(--era)/0.22)] text-on-surface',
  accent: 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent-readable',
  success: 'border-status-success/40 bg-status-success/15 text-status-success',
};

export const Chip: React.FC<ChipProps> = ({
  tone = 'neutral',
  sagaClass = '',
  overlay = false,
  icon,
  className = '',
  children,
}) => {
  const surface = tone === 'saga' ? sagaClass : TONE[tone];
  const pill = `chrono-chip inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none tabular-nums whitespace-nowrap ${surface}`;
  if (!overlay) return <span className={`${pill} shrink-0 ${className}`}>{icon}<span className="truncate">{children}</span></span>;
  // El velo oscuro va en un envoltorio para que el tinte translúcido del tono no choque con él.
  return (
    <span
      className={`chrono-chip inline-flex max-w-full shrink-0 rounded-full bg-black/75 shadow-[0_1px_8px_rgb(0_0_0/0.35)] ${className}`}
    >
      <span className={pill}>
        {icon}
        <span className="truncate">{children}</span>
      </span>
    </span>
  );
};
