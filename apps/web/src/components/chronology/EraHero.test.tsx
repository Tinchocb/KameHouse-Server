import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EraHero } from './EraHero';

// Movimiento que decide si se dibujan las esferas (EraHero: solo con tier "full" y en Por era).
const motion = vi.hoisted(() => ({ tier: 'full' as 'full' | 'subtle' | 'off' }));

vi.mock('@/components/ui/kinetics/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/kinetics/hooks')>()),
  useMotionTier: () => motion.tier,
}));

const baseProps = {
  seriesId: 'z' as const,
  seriesTag: 'Dragon Ball Z',
  yearsLabel: '1989',
  accentHex: '#F5C242',
  totalVolumes: 7,
};

function litBalls(readVolumes: number): string | null | undefined {
  const { container, unmount } = render(<EraHero {...baseProps} readVolumes={readVolumes} />);
  const value = container.querySelector('.dragon-ball-meter')?.getAttribute('data-lit');
  unmount();
  return value;
}

describe('EraHero · esferas del Dragón', () => {
  beforeEach(() => {
    motion.tier = 'full';
    document.documentElement.dataset.mode = 'era';
  });

  afterEach(() => {
    delete document.documentElement.dataset.mode;
    motion.tier = 'full';
  });

  // Regresión: con el porcentaje redondeado, 1/7, 4/7 y 5/7 encendían una esfera de menos.
  it.each([
    [0, '0'],
    [1, '1'],
    [4, '4'],
    [5, '5'],
    [7, '7'],
  ])('con %i de 7 lapsos leídos enciende %s esferas', (read, lit) => {
    expect(litBalls(read)).toBe(lit);
  });

  it('no dibuja esferas fuera de Por era', () => {
    document.documentElement.dataset.mode = 'classic';
    const { container } = render(<EraHero {...baseProps} readVolumes={4} />);
    expect(container.querySelector('.dragon-ball-meter')).toBeNull();
  });

  it('no dibuja esferas con movimiento reducido o en ahorro', () => {
    motion.tier = 'subtle';
    const { container } = render(<EraHero {...baseProps} readVolumes={4} />);
    expect(container.querySelector('.dragon-ball-meter')).toBeNull();
  });
});
