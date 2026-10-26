import * as React from 'react';
import { createPortal } from 'react-dom';
import type { EraFilter } from './types';
import { eraAccentHex } from './data/spansToVolumes';
import { ERA_FILTER_BY_SERIES } from './data/eraBar';
import { ALL_ERAS_HEX, hexToRgbChannels } from './utils/eraColor';

const TINTS: ReadonlyArray<{ era: EraFilter; channels: string }> = [
  { era: 'all', channels: hexToRgbChannels(ALL_ERAS_HEX) },
  ...(Object.entries(ERA_FILTER_BY_SERIES) as Array<[keyof typeof ERA_FILTER_BY_SERIES, EraFilter]>).map(
    ([series, era]) => ({ era, channels: hexToRgbChannels(eraAccentHex(series)) }),
  ),
];

interface ChronologyBackdropProps {
  /** Era que se ve (la del scroll o la del filtro): su tinte entra y los demás salen. */
  eraFilter: EraFilter;
}

/**
 * Fondo minimalista y arquitectónico para la Cronología de Dragon Ball.
 * - Lienzo oscuro con textura sutil de puntos y un tinte superior leve con el color de la era.
 * - Al cambiar de era los tintes se funden: cada era tiene su capa y solo cambian `opacity` y
 *   `transform` (nada de animar el color), con los tokens de duración y curva de animation.css.
 *   Con `prefers-reduced-motion` el cambio es instantáneo.
 * - Portaleado a document.body con z-index: -1 para mantener coordenadas fijas inmunes a filtros de scroll.
 */
export const ChronologyBackdrop: React.FC<ChronologyBackdropProps> = ({ eraFilter }) => {
  // SPA sin SSR: document existe desde el primer render, no hace falta esperar al montaje.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      style={{ zIndex: -1 }}
    >
      {/* 1. Matriz arquitectónica de puntos discretos (estética de archivo cronológico) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 85% 70% at 50% 30%, black 15%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 70% at 50% 30%, black 15%, transparent 85%)',
        }}
      />

      {/* 2. Tinte de era: una capa por era; la activa sube a opacidad 1 y las demás se funden */}
      {TINTS.map(({ era, channels }) => {
        const active = era === eraFilter;
        return (
          <div
            key={era}
            data-era-tint={era}
            data-active={active}
            className={`absolute inset-x-0 top-0 h-96 pointer-events-none transition-[opacity,transform] duration-slower ease-smooth-out motion-reduce:transition-none ${
              active ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
            style={
              {
                '--era': channels,
                background: 'linear-gradient(to bottom, rgb(var(--era) / 0.05) 0%, transparent 100%)',
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>,
    document.body
  );
};
