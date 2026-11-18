import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ChronologyBackdrop } from './ChronologyBackdrop';

describe('ChronologyBackdrop', () => {
  it('se portalea en el body con z-index negativo y contiene la matriz de puntos', () => {
    const { unmount } = render(<ChronologyBackdrop eraFilter="all" />);
    const portalContainer = document.body.querySelector('[aria-hidden="true"]');
    expect(portalContainer).not.toBeNull();
    expect(portalContainer?.getAttribute('style')).toContain('z-index: -3');
    unmount();
  });

  it('activa la capa de fondo y el tinte de la era seleccionada', () => {
    const { rerender, unmount } = render(<ChronologyBackdrop eraFilter="db-z" />);

    const activeBackdrop = document.body.querySelector('[data-era-backdrop="db-z"]');
    expect(activeBackdrop?.getAttribute('data-active')).toBe('true');
    expect(activeBackdrop?.className).toContain('opacity-100');

    const inactiveBackdrop = document.body.querySelector('[data-era-backdrop="db-clasico"]');
    expect(inactiveBackdrop?.getAttribute('data-active')).toBe('false');
    expect(inactiveBackdrop?.className).toContain('opacity-0');

    const activeTint = document.body.querySelector('[data-era-tint="db-z"]');
    expect(activeTint?.getAttribute('data-active')).toBe('true');
    expect(activeTint?.className).toContain('opacity-100');

    const previousImage = activeBackdrop?.querySelector('img');
    expect(previousImage).toBeTruthy();

    // Cambiar a otra era actualiza la capa activa
    rerender(<ChronologyBackdrop eraFilter="db-clasico" />);
    expect(activeBackdrop?.querySelector('img')).toBe(previousImage);
    expect(document.body.querySelector('[data-era-backdrop="db-clasico"]')?.getAttribute('data-active')).toBe('true');
    expect(document.body.querySelector('[data-era-backdrop="db-z"]')?.getAttribute('data-active')).toBe('false');

    unmount();
  });
});
