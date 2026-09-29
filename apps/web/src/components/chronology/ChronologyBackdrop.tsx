import * as React from 'react';
import { createPortal } from 'react-dom';
import type { EraFilter } from './types';

const ERA_ACCENT: Record<EraFilter, string> = {
  all: '#f59e0b',
  'db-clasico': '#e65100',
  'db-z': '#1e88e5',
  'db-super': '#0288d1',
  'db-daima': '#8e24aa',
  'db-gt': '#d81b60',
};

interface ChronologyBackdropProps {
  eraFilter: EraFilter;
}

/**
 * Fondo minimalista y arquitectónico para la Cronología de Dragon Ball.
 * - Sin imágenes fotográficas borrosas ni resplandores/auras que saturen la vista.
 * - Lienzo oscuro profundo con textura sutil de matriz de puntos (dot-grid).
 * - Tinte ambiental superior extremadamente leve (3-4% opacidad) que identifica la era activa con elegancia.
 * - Portaleado a document.body con z-index: -1 para mantener coordenadas fijas inmunes a filtros de scroll.
 */
export const ChronologyBackdrop: React.FC<ChronologyBackdropProps> = ({ eraFilter }) => {
  const accent = ERA_ACCENT[eraFilter] ?? ERA_ACCENT.all;

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

      {/* 2. Tinte de era sutil y elegante en la cabecera (sin resplandor) */}
      <div
        className="absolute inset-x-0 top-0 h-96 pointer-events-none transition-colors duration-700 ease-out"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${accent} 4%, transparent) 0%, transparent 100%)`,
        }}
      />
    </div>,
    document.body
  );
};
