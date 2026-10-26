import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { YearScale } from './YearScale';
import { SPAN_VOLUMES, compareInUniverse } from './data/spansToVolumes';

const volumes = [...SPAN_VOLUMES].sort(compareInUniverse);

afterEach(cleanup);

describe('YearScale', () => {
  it('es un slider con nombre y rango según la cantidad de lapsos', () => {
    render(<YearScale volumes={volumes} accentByEra={{}} onJumpToVolume={() => {}} />);
    const slider = screen.getByRole('slider', { name: /escala de años/i });
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe(String(volumes.length - 1));
    expect(slider.getAttribute('aria-description')).toMatch(/749 a 790/);
  });

  it('las flechas recorren los lapsos y saltan a cada uno', () => {
    const onJump = vi.fn();
    render(<YearScale volumes={volumes} accentByEra={{}} onJumpToVolume={onJump} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onJump).toHaveBeenLastCalledWith(volumes[1].id);
    expect(slider.getAttribute('aria-valuenow')).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toContain(volumes[1].title);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onJump).toHaveBeenLastCalledWith(volumes[0].id);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onJump).toHaveBeenLastCalledWith(volumes[volumes.length - 1].id);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onJump).toHaveBeenLastCalledWith(volumes[0].id);
  });

  it('no sale del rango con las flechas', () => {
    const onJump = vi.fn();
    render(<YearScale volumes={volumes} accentByEra={{}} onJumpToVolume={onJump} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onJump).toHaveBeenLastCalledWith(volumes[0].id);
  });

  it('rotula los huecos entre eras y dibuja las bandas', () => {
    const { container } = render(<YearScale volumes={volumes} accentByEra={{}} onJumpToVolume={() => {}} />);
    expect(container.querySelectorAll('[data-year-gap]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-era-band]').length).toBe(5);
    expect(container.querySelectorAll('[data-interlude-bar]').length).toBeGreaterThan(0);
  });

  it('con un solo lapso no se muestra', () => {
    const { container } = render(<YearScale volumes={volumes.slice(0, 1)} accentByEra={{}} onJumpToVolume={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
