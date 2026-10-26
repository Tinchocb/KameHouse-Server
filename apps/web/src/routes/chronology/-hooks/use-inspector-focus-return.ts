import { useCallback, useRef } from 'react';

/** Mantiene el origen al recorrer otros lapsos dentro del inspector. */
export function useInspectorFocusReturn() {
  const originRef = useRef<{ element: HTMLElement | null; volumeId: string } | null>(null);
  const capture = useCallback((volumeId: string) => {
    originRef.current = {
      element: document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null,
      volumeId,
    };
  }, []);
  const restore = useCallback((event: Event) => {
    event.preventDefault();
    const origin = originRef.current;
    const target = origin?.element?.isConnected ? origin.element : origin
      ? document.getElementById(`timeline-card-${origin.volumeId}`) || document.getElementById(`timeline-node-${origin.volumeId}`)
      : null;
    target?.focus({ preventScroll: true });
    originRef.current = null;
  }, []);
  return { capture, restore };
}
