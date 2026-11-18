import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ERA_THEME_PRESETS } from '@/lib/theme/themes-registry';
import { SagaCarousel, keyTargetIndex, sagaKanji, swipeStep, SWIPE_MIN_PX } from './-saga-carousel';

const presets = ERA_THEME_PRESETS;

describe('swipeStep', () => {
  it('un gesto hacia la izquierda pasa a la siguiente saga; hacia la derecha, a la anterior', () => {
    expect(swipeStep(-(SWIPE_MIN_PX + 20))).toBe(1);
    expect(swipeStep(SWIPE_MIN_PX + 20)).toBe(-1);
  });

  it('un gesto corto no cambia de saga (no se confunde con un toque)', () => {
    expect(swipeStep(0)).toBe(0);
    expect(swipeStep(SWIPE_MIN_PX - 1)).toBe(0);
    expect(swipeStep(-(SWIPE_MIN_PX - 1))).toBe(0);
  });
});

describe('keyTargetIndex', () => {
  it('flechas avanzan y retroceden, dando la vuelta en los extremos', () => {
    expect(keyTargetIndex('ArrowRight', 2, 7)).toBe(3);
    expect(keyTargetIndex('ArrowLeft', 2, 7)).toBe(1);
    expect(keyTargetIndex('ArrowRight', 6, 7)).toBe(0);
    expect(keyTargetIndex('ArrowLeft', 0, 7)).toBe(6);
  });

  it('Inicio y Fin van a los extremos y el resto de teclas no navega', () => {
    expect(keyTargetIndex('Home', 4, 7)).toBe(0);
    expect(keyTargetIndex('End', 1, 7)).toBe(6);
    expect(keyTargetIndex('ArrowDown', 1, 7)).toBeNull();
    expect(keyTargetIndex('Enter', 1, 7)).toBeNull();
  });
});

describe('sagaKanji', () => {
  it('usa el kanji de la era de cada saga y 龍 para Universo DB', () => {
    expect(sagaKanji('era-dbz')).toBe('悟');
    expect(sagaKanji('era-db')).toBe('亀');
    expect(sagaKanji('era-daima')).toBe('魔');
    expect(sagaKanji('era-universe')).toBe('龍');
    expect(sagaKanji('era-black')).toBe('黒');
  });
});

describe('SagaCarousel', () => {
  it('ofrece Negro como paleta fija dentro de Por era', () => {
    render(<SagaCarousel presets={presets} activeId="era-black" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ir a Negro' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Negro', { exact: true })).toBeTruthy();
  });

  it('muestra la posición de la saga activa', () => {
    render(<SagaCarousel presets={presets} activeId="era-dbz" onSelect={() => {}} />);
    expect(screen.getByText(`3 de ${presets.length}`, { exact: false })).toBeTruthy();
  });

  it('Universo DB va primero', () => {
    render(<SagaCarousel presets={presets} activeId="era-universe" onSelect={() => {}} />);
    expect(screen.getByText(`1 de ${presets.length}`, { exact: false })).toBeTruthy();
  });

  it('las flechas en pantalla aplican la saga siguiente y la anterior, dando la vuelta', () => {
    const onSelect = vi.fn();
    render(<SagaCarousel presets={presets} activeId="era-dbz" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saga siguiente' }));
    expect(onSelect).toHaveBeenLastCalledWith(presets[3]);
    fireEvent.click(screen.getByRole('button', { name: 'Saga anterior' }));
    expect(onSelect).toHaveBeenLastCalledWith(presets[1]);
  });

  it('en la última saga, «siguiente» vuelve a Universo DB', () => {
    const onSelect = vi.fn();
    render(<SagaCarousel presets={presets} activeId={presets[presets.length - 1].id} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saga siguiente' }));
    expect(onSelect).toHaveBeenLastCalledWith(presets[0]);
  });

  it('el teclado navega con ← → Inicio Fin sobre el carrusel', () => {
    const onSelect = vi.fn();
    render(<SagaCarousel presets={presets} activeId="era-dbz" onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Sagas' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith(presets[3]);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith(presets[1]);
    fireEvent.keyDown(group, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(presets[presets.length - 1]);
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(presets[0]);
  });

  it('una tecla que no navega no cambia de saga', () => {
    const onSelect = vi.fn();
    render(<SagaCarousel presets={presets} activeId="era-dbz" onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('group', { name: 'Sagas' }), { key: 'a' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('los puntos llevan directo a una saga y marcan la activa', () => {
    const onSelect = vi.fn();
    render(<SagaCarousel presets={presets} activeId="era-dbz" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Dragon Ball GT' }));
    expect(onSelect).toHaveBeenLastCalledWith(presets[3]);
    expect(screen.getByRole('button', { name: 'Ir a Dragon Ball Z' }).getAttribute('aria-current')).toBe('true');
  });

  it('la tarjeta toma la paleta de su saga con data-theme', () => {
    const { container } = render(<SagaCarousel presets={presets} activeId="era-dbs" onSelect={() => {}} />);
    expect(container.querySelector('[data-theme="era-dbs"]')).not.toBeNull();
  });
});
