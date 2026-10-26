import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CompactTimeline } from './CompactTimeline';
import { SPAN_VOLUMES, compareInUniverse } from './data/spansToVolumes';
import { compareRelease } from './data/releaseOrder';
import type { SpanProgress } from './data/spanProgress';

vi.mock('./EpisodeThumbnailImg', () => ({ EpisodeThumbnailImg: () => null }));

const chronological = [...SPAN_VOLUMES].sort(compareInUniverse).map((v) => ({ ...v, mediaId: 7 }));

// Todas las filas cuentan como "cerca de la pantalla": el observer de prueba avisa que intersectan al observarlas.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

const base = {
  order: 'chronological' as const,
  readVolumeIds: new Set<string>(),
  showInterludes: true,
  onOpenVolume: () => {},
};

describe('CompactTimeline', () => {
  it('muestra una fila por lapso agrupadas por era, con el id de sección que usa la barra de eras', () => {
    const { container } = render(<CompactTimeline {...base} volumes={chronological} />);
    expect(container.querySelectorAll('li[id^="timeline-node-"]')).toHaveLength(chronological.length);
    expect(container.querySelectorAll('section[id^="era-section-"]')).toHaveLength(5);
    expect(container.querySelector('#era-section-classic')).toBeTruthy();
  });

  it('muestra los interludios como separadores solo en orden cronológico y si están activados', () => {
    const on = render(<CompactTimeline {...base} volumes={chronological} />);
    expect(on.container.querySelectorAll('[data-compact-interlude]').length).toBeGreaterThan(20);
    on.unmount();
    const off = render(<CompactTimeline {...base} showInterludes={false} volumes={chronological} />);
    expect(off.container.querySelectorAll('[data-compact-interlude]')).toHaveLength(0);
    off.unmount();
    const release = [...chronological].sort(compareRelease);
    const rel = render(<CompactTimeline {...base} order="release" volumes={release} />);
    expect(rel.container.querySelectorAll('[data-compact-interlude]')).toHaveLength(0);
    // En el orden de estreno las eras se rotulan con su emisión.
    expect(screen.getAllByText(/Emitida en 1986–1989/).length).toBe(1);
  });

  it('abrir una fila abre el inspector y reproducir va directo al episodio', () => {
    const onOpen = vi.fn();
    const onPlay = vi.fn();
    render(<CompactTimeline {...base} volumes={chronological} onOpenVolume={onOpen} onPlayVolume={onPlay} />);
    const first = chronological[0];
    fireEvent.click(screen.getByRole('button', { name: `Abrir ${first.title}` }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Empezar · Ep\\. \\d+: ${first.title}`) }));
    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: first.id }),
      first.recommendedStartEpisode || first.startEpisode || 1,
    );
  });

  it('refleja el estado: visto, en curso y sin archivos', () => {
    const [a, b, c] = chronological;
    const progress = new Map<string, SpanProgress>([
      [a.id, { derivedWatched: true, watched: true, percent: 100, watchedEpisodes: a.episodesCount, seenEpisodes: [], totalEpisodes: a.episodesCount }],
      [b.id, { derivedWatched: false, watched: false, percent: 40, watchedEpisodes: 2, seenEpisodes: [b.startEpisode ?? 1], totalEpisodes: b.episodesCount, nextEpisode: (b.startEpisode ?? 1) + 1 }],
    ]);
    const volumes = chronological.map((v) => (v.id === c.id ? { ...v, mediaId: undefined } : v));
    const { container } = render(
      <CompactTimeline {...base} volumes={volumes} progressById={progress} readVolumeIds={new Set([a.id])} onPlayVolume={() => {}} />,
    );
    const row = (id: string) => container.querySelector(`#timeline-node-${id}`) as HTMLElement;
    expect(row(a.id).getAttribute('data-status')).toBe('seen');
    expect(row(b.id).getAttribute('data-status')).toBe('in-progress');
    expect(row(c.id).getAttribute('data-status')).toBe('unavailable');
    expect(within(row(c.id)).getByText('Sin archivos')).toBeTruthy();
    expect((within(row(c.id)).getByRole('button', { name: /^Empezar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(row(a.id)).getByRole('button', { name: /^Ver de nuevo/ })).toBeTruthy();
    expect(within(row(b.id)).getByRole('button', { name: /^Continuar/ })).toBeTruthy();
  });

  it('el botón de la era alterna entre ver solo esa era y todas', () => {
    const onSolo = vi.fn();
    const { rerender } = render(<CompactTimeline {...base} volumes={chronological} onToggleSoloEra={onSolo} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver solo esta era' })[0]);
    expect(onSolo).toHaveBeenCalledWith('db-clasico');
    rerender(<CompactTimeline {...base} volumes={chronological} eraFilter="db-clasico" onToggleSoloEra={onSolo} />);
    expect(screen.getAllByRole('button', { name: 'Ver todas las eras' }).length).toBeGreaterThan(0);
  });
});
