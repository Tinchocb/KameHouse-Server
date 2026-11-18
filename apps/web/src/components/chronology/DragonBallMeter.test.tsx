import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DragonBallMeter, litDragonBalls } from './DragonBallMeter';

describe('litDragonBalls', () => {
  it('enciende una esfera por cada séptimo completado', () => {
    expect(litDragonBalls(0)).toBe(0);
    expect(litDragonBalls(14)).toBe(0); // 14 % es 0,98 séptimos: todavía no
    expect(litDragonBalls(15)).toBe(1);
    expect(litDragonBalls(50)).toBe(3);
    expect(litDragonBalls(99)).toBe(6);
    expect(litDragonBalls(100)).toBe(7);
  });

  it('acepta valores fuera de rango o inválidos sin romperse', () => {
    expect(litDragonBalls(-20)).toBe(0);
    expect(litDragonBalls(180)).toBe(7);
    expect(litDragonBalls(Number.NaN)).toBe(0);
  });

  it('cuenta exacto en los límites de cada séptimo', () => {
    // 100 / 7 · k nunca debe quedar una esfera corta por redondeo de punto flotante
    for (let k = 1; k <= 7; k++) expect(litDragonBalls((100 / 7) * k)).toBe(k);
  });
});

describe('DragonBallMeter', () => {
  it('dibuja 7 esferas y marca las encendidas', () => {
    const { container } = render(<DragonBallMeter percent={50} accentHex="#F2762E" />);
    const balls = container.querySelectorAll('img');
    expect(balls).toHaveLength(7);
    expect(container.querySelectorAll('img[data-on]')).toHaveLength(3);
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('3 de 7 esferas del Dragón');
  });

  it('apunta a las 7 imágenes de estrellas en orden y son decorativas', () => {
    const { container } = render(<DragonBallMeter percent={100} accentHex="#F5C242" />);
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `/icons/dragon-balls/star-${n}.png`));
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');
  });
});
