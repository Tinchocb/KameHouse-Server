import { act, cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useNearViewport, NEAR_MARGIN, FAR_MARGIN } from './useNearViewport';

interface FakeObserver {
  margin: string;
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
}
const observers: FakeObserver[] = [];

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly record: FakeObserver;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.record = { margin: options?.rootMargin ?? '', callback, targets: new Set() };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.targets.add(target);
      }
      unobserve(target: Element) {
        this.record.targets.delete(target);
      }
      disconnect() {
        this.record.targets.clear();
      }
    },
  );
});

// Los observers del módulo son compartidos y persisten entre tests: no se vacía la lista de los falsos.
afterEach(cleanup);

/** Avisa a los observers de un margen que el elemento entró o salió. */
function fire(margin: string, isIntersecting: boolean) {
  act(() => {
    for (const o of observers.filter((x) => x.margin === margin)) {
      for (const target of o.targets) o.callback([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  });
}

function Probe({ release = false, keep = false }: { release?: boolean; keep?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, false, { release, keep });
  return <div ref={ref} data-near={near} />;
}

const near = (container: HTMLElement) => container.firstElementChild?.getAttribute('data-near');

describe('useNearViewport', () => {
  it('se arma cuando el elemento se acerca a la pantalla', () => {
    const { container } = render(<Probe />);
    expect(near(container)).toBe('false');
    fire(NEAR_MARGIN, false);
    expect(near(container)).toBe('false');
    fire(NEAR_MARGIN, true);
    expect(near(container)).toBe('true');
  });

  it('sin release queda armada aunque se aleje', () => {
    const { container } = render(<Probe />);
    fire(NEAR_MARGIN, true);
    fire(FAR_MARGIN, false);
    expect(near(container)).toBe('true');
  });

  it('con release se suelta al alejarse mucho y se vuelve a armar al volver', () => {
    const { container } = render(<Probe release />);
    fire(NEAR_MARGIN, true);
    expect(near(container)).toBe('true');
    fire(FAR_MARGIN, false);
    expect(near(container)).toBe('false');
    fire(NEAR_MARGIN, true);
    expect(near(container)).toBe('true');
  });

  it('con keep (tarjeta abierta o resaltada) no se suelta', () => {
    const { container } = render(<Probe release keep />);
    fire(NEAR_MARGIN, true);
    fire(FAR_MARGIN, false);
    expect(near(container)).toBe('true');
  });

  it('sin IntersectionObserver se arma de inmediato', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<Probe />);
    expect(near(container)).toBe('true');
  });
});
