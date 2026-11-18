import { useEffect, useState, type RefObject } from 'react';

/**
 * Margen por encima y por debajo de la pantalla: las filas se arman bastante antes de que llegue el scroll,
 * así un scroll rápido encuentra las tarjetas ya armadas (y sus miniaturas pedidas) en vez de esqueletos.
 */
export const NEAR_MARGIN = '900px 0px';
/**
 * Más allá de este margen una fila ya armada se suelta (vuelve a su esqueleto del mismo alto): con la
 * lista completa recorrida no quedan montadas las 35 tarjetas con sus miniaturas.
 */
export const FAR_MARGIN = '1800px 0px';

type Listener = (isIntersecting: boolean) => void;

/** Un observer compartido por margen: todas las filas se vigilan con el mismo en vez de uno por fila. */
function createSharedObserver(margin: string) {
  const listeners = new WeakMap<Element, Listener>();
  let observer: IntersectionObserver | null = null;
  let observerRoot: Element | null = null;

  // Las páginas scrollean dentro de `#main-content`, no en la ventana: la raíz tiene que ser ese
  // contenedor para que el margen cuente (con la ventana de raíz, el recorte del contenedor lo anula).
  function get(): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') return null;
    const root = document.querySelector('[data-scroll-container="true"]');
    if (observer && observerRoot === root) return observer;
    observer?.disconnect();
    observerRoot = root;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
      },
      { root, rootMargin: margin },
    );
    return observer;
  }

  return {
    observe(el: Element, listener: Listener): (() => void) | null {
      const io = get();
      if (!io) return null;
      listeners.set(el, listener);
      io.observe(el);
      return () => {
        listeners.delete(el);
        io.unobserve(el);
      };
    },
    reset(): void {
      observer?.disconnect();
      observer = null;
      observerRoot = null;
    },
  };
}

export const nearObserver = createSharedObserver(NEAR_MARGIN);
export const farObserver = createSharedObserver(FAR_MARGIN);

/**
 * true cuando el elemento está cerca de la pantalla. Se arma al acercarse y, si `release` es true y
 * `keep` es false, se suelta al alejarse mucho. Con `keep` (tarjeta abierta, resaltada…) nunca se suelta.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  initial = false,
  options: { release?: boolean; keep?: boolean } = {},
): boolean {
  const { release = false, keep = false } = options;
  const [near, setNear] = useState(initial);

  // Armar: espera a que el elemento se acerque.
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    const stop = nearObserver.observe(el, (isIntersecting) => {
      if (isIntersecting) setNear(true);
    });
    if (!stop) {
      setNear(true);
      return;
    }
    return stop;
  }, [near, ref]);

  // Soltar: ya armada, se vigila el margen lejano.
  useEffect(() => {
    if (!near || !release || keep) return;
    const el = ref.current;
    if (!el) return;
    const stop = farObserver.observe(el, (isIntersecting) => {
      if (!isIntersecting) setNear(false);
    });
    return stop ?? undefined;
  }, [near, release, keep, ref]);

  return near;
}
