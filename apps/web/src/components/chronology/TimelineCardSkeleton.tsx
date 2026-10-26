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
        '55% 22px', '30% 12px', '28% 10px', '18% 10px', 'calc(100% - 40px) 5px', 'calc(100% - 200px) 38px', '128px 38px', '100% 230px',
      ].join(','),
      backgroundPosition: [
        '16px 175px', '16px 150px', '16px 255px', 'calc(100% - 16px) 255px', '16px 280px', '16px 305px', 'calc(100% - 16px) 305px', '0 0',
      ].join(','),
    }}
  />
);
