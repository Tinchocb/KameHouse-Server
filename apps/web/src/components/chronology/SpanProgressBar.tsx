import React from 'react';
import { cn } from '@/components/ui/core/styling';
import type { SegmentState } from './data/cardModel';

const SEGMENT_CLASS: Record<SegmentState, string> = {
  seen: 'bg-status-success/85',
  next: 'bg-[rgb(var(--era)/0.25)] ring-1 ring-inset ring-[rgb(var(--era))]',
  filler: 'bg-[repeating-linear-gradient(135deg,rgba(var(--status-warning-rgb),0.85)_0_2px,rgba(var(--status-warning-rgb),0.3)_2px_4px)]',
  pending: 'bg-white/[0.12]',
};

interface SpanProgressBarProps {
  title: string;
  /** Un segmento por episodio; null = barra continua. */
  segments: SegmentState[] | null;
  isRead: boolean;
  progressPercent: number;
  /** Alto de la barra en px (5 en la tarjeta, 3 en la vista compacta). */
  height?: 3 | 5;
  className?: string;
}

/** Avance de un lapso: un segmento por episodio o, si son muchos, una barra continua. */
export const SpanProgressBar: React.FC<SpanProgressBarProps> = ({
  title,
  segments,
  isRead,
  progressPercent,
  height = 5,
  className,
}) => {
  const value = isRead ? 100 : progressPercent;
  const h = height === 3 ? 'h-[3px]' : 'h-[5px]';
  return (
    <div
      role="progressbar"
      aria-label={`Avance de ${title}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("chronology-progress-bar", segments ? 'flex min-w-0 gap-[3px]' : cn('min-w-0 overflow-hidden rounded-full bg-white/[0.12]', h), className)}
    >
      {segments ? (
        // Color y anillo (box-shadow) se funden al cambiar de estado; en el primer pintado no hay transición.
        segments.map((state, i) => (
          <span
            key={i}
            className={cn(
              h,
              'chronology-progress-segment flex-1 rounded-full transition-[background-color,box-shadow] duration-base ease-smooth-out motion-reduce:transition-none',
              SEGMENT_CLASS[state],
            )}
          />
        ))
      ) : (
        // scaleX en vez de width: avanza por el compositor, sin recalcular layout. Solo se anima el cambio de valor.
        <div
          className="h-full w-full origin-left bg-status-success/85 transition-transform duration-slow ease-smooth-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      )}
    </div>
  );
};
