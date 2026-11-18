import * as React from 'react';
import { createPortal } from 'react-dom';
import type { EraFilter } from './types';
import { eraAccentHex } from './data/spansToVolumes';
import { ERA_FILTER_BY_SERIES } from './data/eraBar';
import { ALL_ERAS_HEX, hexToRgbChannels } from './utils/eraColor';
import { useIsClassicMode, useIsFlatMode } from '@/lib/theme/use-classic-mode';

const ERA_BACKDROP: Record<EraFilter, string> = {
  all: '/backdrops/dbz.webp',
  'db-clasico': '/backdrops/db.webp',
  'db-z': '/backdrops/dbz.webp',
  'db-daima': '/backdrops/dbdaima.webp',
  'db-super': '/backdrops/dbs.webp',
  'db-gt': '/backdrops/dbgt.webp',
};

const TINTS: ReadonlyArray<{ era: EraFilter; channels: string; backdrop: string }> = [
  { era: 'all', channels: hexToRgbChannels(ALL_ERAS_HEX), backdrop: ERA_BACKDROP.all },
  ...(Object.entries(ERA_FILTER_BY_SERIES) as Array<[keyof typeof ERA_FILTER_BY_SERIES, EraFilter]>).map(
    ([series, era]) => ({
      era,
      channels: hexToRgbChannels(eraAccentHex(series)),
      backdrop: ERA_BACKDROP[era],
    }),
  ),
];

interface ChronologyBackdropProps {
  /** Era que se ve (la del scroll o la del filtro): su tinte entra y los demás salen. */
  eraFilter: EraFilter;
}

/**
 * Fondo cinematográfico y arquitectónico para la Cronología de Dragon Ball.
 * - Lienzo oscuro con textura de archivo cronológico (dot matrix).
 * - Aura ambiental de arte oficial de la era con desenfoque cinematográfico y máscara radial.
 * - Resplandor de ki sutil con la paleta de la saga activa.
 * - Al cambiar o scrollear entre eras, las capas se funden suavemente (crossfade de opacidad).
 * - Portaleado a document.body con z-index: -3 para quedar entre el lienzo base y el kanji central (-2).
 */
export const ChronologyBackdrop: React.FC<ChronologyBackdropProps> = ({ eraFilter }) => {
  const isClassic = useIsClassicMode();
  const isFlat = useIsFlatMode();
  // SPA sin SSR: document existe desde el primer render, no hace falta esperar al montaje.
  if (typeof document === 'undefined') return null;

  const targetImageOpacity = isClassic ? 0.12 : 0.22;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      style={{ zIndex: -3, backgroundColor: 'var(--neutral-elev-0)' }}
    >
      {/* 1. Arte ambiental difuminado por era: las capas persisten para poder invertir el fundido durante el scroll */}
      {TINTS.map(({ era, backdrop }) => {
        const active = era === eraFilter;
        return (
          <div
            key={`backdrop-${era}`}
            data-era-backdrop={era}
            data-active={active}
            className={`absolute -inset-10 pointer-events-none transition-opacity duration-slower ease-in-out motion-reduce:transition-none ${
              active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {!isFlat && (
              <img
                src={backdrop}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                className="w-full h-full object-cover object-[center_20%] pointer-events-none"
                style={{
                  opacity: targetImageOpacity,
                  filter: 'blur(54px) saturate(135%)',
                  maskImage: 'radial-gradient(ellipse 105% 85% at 50% 30%, black 15%, transparent 85%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 105% 85% at 50% 30%, black 15%, transparent 85%)',
                }}
              />
            )}
          </div>
        );
      })}

      {/* 2. Tinte ambiental de ki por era: resplandor cenital atmosférico */}
      {!isClassic &&
        TINTS.map(({ era, channels }) => {
          const active = era === eraFilter;
          return (
            <div
              key={`tint-${era}`}
              data-era-tint={era}
              data-active={active}
              className={`absolute inset-0 pointer-events-none transition-opacity duration-slower ease-in-out motion-reduce:transition-none ${
                active ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: `radial-gradient(ellipse 95% 65% at 50% 15%, rgb(${channels} / 0.14) 0%, transparent 75%)`,
              }}
            />
          );
        })}

      {/* 3. Matriz arquitectónica de puntos discretos (estética de archivo cronológico) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 90% 75% at 50% 30%, black 25%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 75% at 50% 30%, black 25%, transparent 85%)',
        }}
      />
    </div>,
    document.body
  );
};
