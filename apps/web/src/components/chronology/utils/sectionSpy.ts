import { useEffect, useState } from 'react';

/**
 * Sección activa por posición: la última cuyo comienzo ya pasó la línea de referencia, o la última
 * si el scroll llegó al fondo. Con IntersectionObserver y "mayor ratio" las secciones cortas ganaban
 * a las largas y, al saltar, el indicador quedaba en otra.
 *
 * `tops` son las posiciones superiores en el mismo orden que `ids`; `null` = la sección no está en el DOM.
 */
export function pickActiveSection(
  ids: readonly string[],
  tops: readonly (number | null)[],
  line: number,
  atBottom: boolean,
  atTop?: boolean,
): string | undefined {
  if (ids.length === 0 || atTop) return undefined;
  if (atBottom) return ids[ids.length - 1];
  let best: string | undefined = undefined;
  for (let i = 0; i < ids.length; i++) {
    const top = tops[i];
    if (top !== null && top <= line) best = ids[i];
  }
  return best;
}

/** Fracción de la ventana donde se fija la línea de referencia. */
const LINE_RATIO = 0.35;

/**
 * Id de la sección (`id` del DOM) que se está viendo. Escucha `scroll` en captura: las páginas
 * scrollean dentro de `#main-content`, no en la ventana.
 */
export function useSectionSpy(sectionDomIds: readonly string[]): string | undefined {
  const key = sectionDomIds.join('|');
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (typeof window === 'undefined' || ids.length === 0) return;
    let raf = 0;
    let cachedScroller: HTMLElement | null = null;
    let cachedElements: (HTMLElement | null)[] | null = null;

    const getScroller = () => {
      if (cachedScroller && cachedScroller.isConnected) return cachedScroller;
      cachedScroller = document.getElementById('main-content');
      return cachedScroller;
    };

    const getElements = () => {
      if (cachedElements && cachedElements.every((el) => el === null || el.isConnected)) {
        return cachedElements;
      }
      cachedElements = ids.map((id) => document.getElementById(id));
      return cachedElements;
    };

    const update = () => {
      raf = 0;
      const scroller = getScroller();
      const containerAtTop = scroller ? scroller.scrollTop <= 8 : false;
      const containerAtBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
        : false;
      const els = getElements();
      const tops = els.map((el) => el?.getBoundingClientRect().top ?? null);
      const best = pickActiveSection(ids, tops, window.innerHeight * LINE_RATIO, containerAtBottom, containerAtTop);
      setActiveId((prev) => (prev === best ? prev : best));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);

  // Sin secciones no hay activo: no devolver el de una lista anterior (la paleta de la Cronología lo usa).
  return key ? activeId : undefined;
}
