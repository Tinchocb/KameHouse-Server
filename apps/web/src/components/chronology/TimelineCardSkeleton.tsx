import React from 'react';
import { cn } from '@/components/ui/core/styling';

/** Bloque liso para el fondo del esqueleto: una capa de degradado por pieza (un solo nodo en total). */
const block = (alpha: number) => `linear-gradient(rgb(255 255 255 / ${alpha}), rgb(255 255 255 / ${alpha}))`;

/**
 * Esqueleto de una tarjeta de lapso plegada, con su misma geometría (portada, título, línea de
 * episodios, barra de avance y los dos botones). La fila reserva el alto real antes de armarse y el
 * scroll no salta al montarla. Es un solo nodo con las piezas pintadas como degradados: 35 filas
 * pendientes no pesan en el DOM y no hay animaciones corriendo fuera de pantalla.
 */
export const TimelineCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    data-skeleton="card"
    className={cn(
      'rounded-2xl border border-[var(--neutral-separator)] bg-surface-container-lowest shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]',
      className,
    )}
    style={{
      backgroundRepeat: 'no-repeat',
      backgroundImage: [
        block(0.1), // título
        block(0.06), // saga
        block(0.08), // episodios (izquierda)
        block(0.08), // episodios (derecha)
        block(0.12), // barra de avance
        block(0.09), // botón principal
        block(0.05), // botón secundario
        block(0.04), // portada
      ].join(','),
      backgroundSize: [
        '55% 20px', '30% 11px', '28% 10px', '18% 10px', 'calc(100% - 36px) 4px', 'calc(100% - 180px) 34px', '110px 34px', '100% 220px',
      ].join(','),
      backgroundPosition: [
        '14px 165px', '14px 140px', '14px 240px', 'calc(100% - 14px) 240px', '14px 265px', '14px 288px', 'calc(100% - 14px) 288px', '0 0',
      ].join(','),
    }}
  />
);
