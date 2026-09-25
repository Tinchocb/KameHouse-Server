import { useEffect, useState, type RefObject } from 'react';

/** Margen por encima y por debajo de la pantalla: las filas se arman antes de que el scroll llegue. */
const NEAR_MARGIN = '1200px 0px';

type Listener = () => void;
const listeners = new WeakMap<Element, Listener>();
let observer: IntersectionObserver | null = null;
let observerRoot: Element | null = null;

/**
 * Las páginas scrollean dentro de `#main-content`, no en la ventana: la raíz tiene que ser ese
 * contenedor para que el margen cuente (con la ventana de raíz, el recorte del contenedor lo anula).
 */
function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  const root = document.querySelector('[data-scroll-container="true"]');
  if (observer && observerRoot === root) return observer;
  observer?.disconnect();
  observerRoot = root;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const listener = listeners.get(entry.target);
        if (!listener) continue;
        listeners.delete(entry.target);
        observer?.unobserve(entry.target);
        listener();
      }
    },
    { root, rootMargin: NEAR_MARGIN },
  );
  return observer;
}

/**
 * true una vez que el elemento estuvo cerca de la pantalla, y queda así. Un solo observer compartido
 * para todas las filas en vez de uno por fila.
 */
export function useNearViewport(ref: RefObject<Element | null>, initial = false): boolean {
  const [near, setNear] = useState(initial);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    const io = getObserver();
    if (!el || !io) {
      setNear(true);
      return;
    }
    listeners.set(el, () => setNear(true));
    io.observe(el);
    return () => {
      listeners.delete(el);
      io.unobserve(el);
    };
  }, [near, ref]);

  return near;
}
