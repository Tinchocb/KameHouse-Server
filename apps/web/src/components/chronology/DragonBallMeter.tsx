import React from 'react';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';

/** Cuántas de las 7 esferas del Dragón encienden con este avance (0–100): una por cada séptimo completo. */
export function litDragonBalls(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(7, Math.max(0, Math.floor((percent / 100) * 7 + 1e-9)));
}

interface DragonBallMeterProps {
  /** Avance de la era, 0–100. */
  percent: number;
  /** Color de la era: el brillo de las esferas encendidas. */
  accentHex: string;
  className?: string;
}

/**
 * Las 7 esferas del Dragón como hitos del avance de una era (guiño de Por era, docs/TEMA-POR-ERA.md).
 * Cada séptimo completado enciende una; a las 7, la era está completa. Decorativo: el avance exacto ya
 * está en el texto y en la línea de progreso, por eso el contenedor es una imagen con su resumen.
 */
export const DragonBallMeter = React.memo(function DragonBallMeter({ percent, accentHex, className = '' }: DragonBallMeterProps) {
  const isClassic = useIsClassicMode();
  const lit = litDragonBalls(percent);
  return (
    <span
      role="img"
      aria-label={`${lit} de 7 esferas del Dragón`}
      data-lit={lit}
      className={`dragon-ball-meter inline-flex shrink-0 items-center gap-1 ${className}`}
    >
      {Array.from({ length: 7 }, (_, i) => {
        const on = i < lit;
        return (
          <img
            key={i}
            src={`/icons/dragon-balls/star-${i + 1}.png`}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            decoding="async"
            draggable={false}
            data-on={on || undefined}
            className="size-4 sm:size-5 select-none object-contain transition-[filter,opacity] duration-slow ease-smooth-out motion-reduce:transition-none"
            style={{
              opacity: on ? 1 : 0.3,
              filter: on
                ? isClassic
                  ? 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))'
                  : `drop-shadow(0 0 4px ${accentHex}b3)`
                : 'grayscale(1)',
            }}
          />
        );
      })}
    </span>
  );
});

DragonBallMeter.displayName = 'DragonBallMeter';
