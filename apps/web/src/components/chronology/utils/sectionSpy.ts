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
    let atBottom = false;
    let atTop = false;

    const update = () => {
      raf = 0;
      let containerAtTop = atTop;
      let containerAtBottom = atBottom;
      const scroller = document.getElementById('main-content');
      if (scroller) {
        if (scroller.scrollTop <= 8) containerAtTop = true;
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) containerAtBottom = true;
      }
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null);
      const best = pickActiveSection(ids, tops, window.innerHeight * LINE_RATIO, containerAtBottom, containerAtTop);
      setActiveId((prev) => (prev === best ? prev : best));
    };

    const onScroll = (event: Event) => {
      const target = event.target;
      const first = document.getElementById(ids[0]);
      if (target instanceof HTMLElement && target.scrollHeight > target.clientHeight && first && target.contains(first)) {
        atTop = target.scrollTop <= 8;
        atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 4;
      }
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);

  return activeId;
}
