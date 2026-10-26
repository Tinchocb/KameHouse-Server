import { parseTimelineOrder, type TimelineOrder } from './releaseOrder';

/** Cómo se ve la lista: tarjetas completas o una lista densa con los 35 lapsos de un vistazo. */
export type TimelineView = 'detailed' | 'compact';

export const TIMELINE_VIEW_KEY = 'kamehouse_chrono_view';
export const TIMELINE_ORDER_KEY = 'kamehouse_chrono_order';

export function parseTimelineView(raw: string | null | undefined): TimelineView {
  return raw === 'compact' ? 'compact' : 'detailed';
}

/** Lee una preferencia de este dispositivo; sin storage devuelve el valor por defecto. */
function readPref<T>(key: string, parse: (raw: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin storage la preferencia dura lo que la sesión.
  }
}

export const readTimelineView = () => readPref(TIMELINE_VIEW_KEY, parseTimelineView);
export const readTimelineOrder = (): TimelineOrder => readPref(TIMELINE_ORDER_KEY, parseTimelineOrder);
