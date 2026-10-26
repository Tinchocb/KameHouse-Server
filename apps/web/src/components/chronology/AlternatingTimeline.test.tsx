import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { usePerformanceStore } from '@/lib/hardware/performance-store';
import { useAppStore } from '@/lib/stores';
import { AlternatingTimeline } from './AlternatingTimeline';
import { SPAN_VOLUMES } from './data/spansToVolumes';
import { CHRONOLOGY_INTERLUDES } from './data/interludes';
import { nearObserver, farObserver } from './utils/useNearViewport';

// Preferencia de movimiento reducido que lee AlternatingTimeline (el resto del hook sigue real).
const motionPrefs = vi.hoisted(() => ({ reduced: false }));

vi.mock('@/components/ui/kinetics/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/kinetics/hooks')>()),
  useReducedMotion: () => motionPrefs.reduced,
}));

// Las piezas pesadas de cada fila (miniaturas, detalles, héroes) no intervienen en la entrada de la tarjeta.
vi.mock('./TimelineVolumeCard', async () => {
  const { createElement } = await import('react');
  return { TimelineVolumeCard: () => createElement('div', { 'data-testid': 'volume-card' }) };
});

describe('AlternatingTimeline · tarjetas expandidas en vista detallada y colapso por usuario', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function setup() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const observers: { callback: IntersectionObserverCallback; targets: Set<Element> }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      targets = new Set<Element>();
      constructor(callback: IntersectionObserverCallback) { observers.push({ callback, targets: this.targets }); }
      observe = (el: Element) => { this.targets.add(el); };
      unobserve = (el: Element) => { this.targets.delete(el); };
      disconnect = () => { this.targets.clear(); };
    });
    const scroller = document.createElement('div');
    scroller.setAttribute('data-scroll-container', 'true');
    document.body.appendChild(scroller);
    let scrollTop = 0;
    Object.defineProperty(scroller, 'scrollTop', { get: () => scrollTop, set: (value: number) => { scrollTop = value; } });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 800, height: 800 } as DOMRect);
    const volumes = SPAN_VOLUMES.slice(0, 10);
    const view = render(<AlternatingTimeline
      volumes={volumes} readVolumeIds={new Set()} onToggleRead={vi.fn()}
      showInterludes={false} onInspectThumbnail={vi.fn()}
    />, { container: scroller });
    const nodes = volumes.map(v => {
      const node = document.getElementById(`timeline-node-${v.id}`);
      if (!node) throw new Error(`Falta la fila ${v.id}`);
      return node;
    });

    const expandedIndexes = () => nodes.flatMap((node, i) => (node.className.includes('my-4') ? [i] : []));
    return { nodes, expandedIndexes, unmount: () => { view.unmount(); scroller.remove(); } };
  }

  it('en vista detallada todas las tarjetas nacen expandidas de forma predecible sin saltos', () => {
    const { expandedIndexes, unmount } = setup();
    // Todas las tarjetas nacen en estado expandido (índices 0 a 9)
    expect(expandedIndexes()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    unmount();
  });

  it('Escape pliega todas las tarjetas abiertas', () => {
    const { expandedIndexes, unmount } = setup();
    expect(expandedIndexes()).toHaveLength(10);

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(expandedIndexes()).toEqual([]);
    unmount();
  });

  it('un Escape que ya cerró un diálogo o menú (preventDefault) no pliega las tarjetas', () => {
    const { expandedIndexes, unmount } = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); });
    expect(expandedIndexes()).toEqual([]);
    unmount();

    const again = setup();
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    act(() => { window.dispatchEvent(handled); });
    expect(again.expandedIndexes()).toHaveLength(10);
    again.unmount();
  });

  it('un Escape con el foco dentro de un diálogo no pliega las tarjetas', () => {
    const { expandedIndexes, unmount } = setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    button.focus();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(expandedIndexes()).toHaveLength(10);
    unmount();
  });
});

vi.mock('./EraHero', () => ({ EraHero: () => null }));
vi.mock('./InterludeDivider', async () => {
  const { createElement } = await import('react');
  return {
    InterludeDivider: ({ interlude }: { interlude: { id: string } }) =>
      createElement('div', { 'data-testid': 'interlude-divider', 'data-interlude': interlude.id }),
  };
});
vi.mock('./ContralateralDetailsCard', () => ({ ContralateralDetailsCard: () => null }));
vi.mock('./TimelineCardSkeleton', () => ({ TimelineCardSkeleton: () => null }));

/** Renderiza un solo lapso (la primera fila arma su tarjeta de entrada) y devuelve la capa que anima la entrada. */
function renderFirstRow(index: number): { entrance: HTMLElement; unmount: () => void } {
  const { unmount } = render(
    <AlternatingTimeline
      volumes={[SPAN_VOLUMES[index]]}
      readVolumeIds={new Set()}
      onToggleRead={vi.fn()}
      showInterludes={false}
      onInspectThumbnail={vi.fn()}
    />,
  );
  // La tarjeta de entrada envuelve al mock de TimelineVolumeCard: su padre es el m.div que anima.
  return { entrance: screen.getByTestId('volume-card').parentElement as HTMLElement, unmount };
}

describe('AlternatingTimeline · entrada de la tarjeta según el tier de movimiento', () => {
  // Antes de cada caso: al salir la fila sigue montada y el cambio de store la re-renderiza fuera de act.
  beforeEach(() => {
    usePerformanceStore.setState({ performanceProfile: 'auto', autoThrottleActive: false });
    useAppStore.setState({ tvMode: false });
    motionPrefs.reduced = false;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('con hardware capaz la tarjeta se funde y sube 16 px', () => {
    usePerformanceStore.setState({ performanceProfile: 'ultra' });
    const { entrance, unmount } = renderFirstRow(0);
    expect(entrance.style.opacity).toBe('0');
    expect(entrance.style.transform).toContain('16px');
    unmount();
  });

  it('en modo TV la tarjeta solo se funde, sin desplazamiento', () => {
    usePerformanceStore.setState({ performanceProfile: 'ultra' });
    useAppStore.setState({ tvMode: true });
    const { entrance, unmount } = renderFirstRow(1);
    expect(entrance.style.opacity).toBe('0');
    expect(entrance.style.transform).not.toContain('16px');
    unmount();
  });

  it('con movimiento reducido la tarjeta queda visible y sin desplazarse', () => {
    usePerformanceStore.setState({ performanceProfile: 'ultra' });
    motionPrefs.reduced = true;
    const { entrance, unmount } = renderFirstRow(2);
    expect(entrance.style.opacity).toBe('1');
    expect(entrance.style.transform).not.toContain('16px');
    unmount();
  });
});

describe('AlternatingTimeline · divisores de interludio diferidos', () => {
  beforeEach(() => {
    nearObserver.reset();
    farObserver.reset();
    usePerformanceStore.setState({ performanceProfile: 'auto', autoThrottleActive: false });
    useAppStore.setState({ tvMode: false });
    motionPrefs.reduced = false;
  });

  afterEach(() => {
    nearObserver.reset();
    farObserver.reset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('monta el divisor solo cuando su fila está cerca y deja un hueco del alto medido al soltarla', () => {
    const observers: { callback: IntersectionObserverCallback; targets: Set<Element> }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      targets = new Set<Element>();
      constructor(callback: IntersectionObserverCallback) { observers.push({ callback, targets: this.targets }); }
      observe = (el: Element) => { this.targets.add(el); };
      unobserve = (el: Element) => { this.targets.delete(el); };
      disconnect = () => { this.targets.clear(); };
    });
    // Par consecutivo con interludio entre ambos lapsos.
    const il = CHRONOLOGY_INTERLUDES.find((x) => x.toVolumeId && SPAN_VOLUMES.some((v, i) => v.id === x.fromVolumeId && SPAN_VOLUMES[i + 1]?.id === x.toVolumeId));
    if (!il || !il.toVolumeId) throw new Error('Falta un par con interludio');
    const from = SPAN_VOLUMES.findIndex((v) => v.id === il.fromVolumeId);
    const volumes = SPAN_VOLUMES.slice(from, from + 2);
    const { container } = render(<AlternatingTimeline
      volumes={volumes} readVolumeIds={new Set()} onToggleRead={vi.fn()}
      showInterludes onInspectThumbnail={vi.fn()}
    />);
    const row = document.getElementById(`timeline-node-${volumes[1].id}`);
    if (!row) throw new Error('Falta la fila');
    const fire = (el: Element, isIntersecting: boolean) => {
      act(() => {
        for (const o of observers) {
          if (o.targets.has(el)) o.callback([{ target: el, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      });
    };
    const divider = () => container.querySelector(`[data-interlude="${il.id}"][data-testid="interlude-divider"]`);
    const slot = () => container.querySelector<HTMLElement>(`[data-interlude-slot="${il.id}"]`);

    // Lejos de la pantalla: el hueco usa el alto de respaldo y no se monta el divisor.
    expect(divider()).toBeNull();
    expect(slot()?.style.height).toBe('103px');

    // Al acercarse se monta, y el alto se mide colapsado.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(88);
    fire(row, true);
    expect(divider()).not.toBeNull();
    expect(slot()?.style.height).toBe('');

    // Al alejarse mucho se suelta: vuelve el hueco con el alto medido.
    fire(row, false);
    expect(divider()).toBeNull();
    expect(slot()?.style.height).toBe('88px');
  });
});
