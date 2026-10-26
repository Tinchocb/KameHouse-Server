import type { VolumeData } from '../types';
import { ERA_KEYS, type EraKey } from './eraBar';

/** Cómo se ordena la línea de tiempo: por la historia o por cuándo salió cada serie. */
export type TimelineOrder = 'chronological' | 'release';

export const TIMELINE_ORDERS: readonly TimelineOrder[] = ['chronological', 'release'];

/**
 * Orden de estreno de las series: Dragon Ball (1986), Z (1989), GT (1996), Super (2015), Daima (2024).
 * Dentro de cada serie, el número de episodio ya es el orden de emisión.
 */
const RELEASE_RANK: Record<NonNullable<VolumeData['seriesId']>, number> = {
  classic: 0,
  z: 1,
  gt: 2,
  super: 3,
  daima: 4,
};

/** Años de emisión de cada serie (a nivel de serie: no hay fechas por lapso en los datos). */
export const AIR_YEARS_BY_ERA: Record<EraKey, string> = {
  'db-clasico': '1986–1989',
  'db-z': '1989–1996',
  'db-gt': '1996–1997',
  'db-super': '2015–2018',
  'db-daima': '2024–2025',
};

type OrderedVolume = Pick<VolumeData, 'seriesId' | 'startEpisode' | 'order' | 'officialYearNumber'>;

/** Orden de estreno: serie por fecha de emisión y, dentro de la serie, por episodio. */
export function compareRelease(a: OrderedVolume, b: OrderedVolume): number {
  const rankA = a.seriesId ? RELEASE_RANK[a.seriesId] : Number.MAX_SAFE_INTEGER;
  const rankB = b.seriesId ? RELEASE_RANK[b.seriesId] : Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
  const epDiff = (a.startEpisode ?? 0) - (b.startEpisode ?? 0);
  if (epDiff !== 0) return epDiff;
  return (a.order ?? 0) - (b.order ?? 0);
}

/** Eras en el orden de la barra: in-universe o de estreno. */
export function eraKeysForOrder(order: TimelineOrder): readonly EraKey[] {
  if (order === 'chronological') return ERA_KEYS;
  return [...ERA_KEYS].sort((a, b) => eraRank(a) - eraRank(b));
}

const ERA_RELEASE_RANK: Record<EraKey, number> = {
  'db-clasico': 0,
  'db-z': 1,
  'db-gt': 2,
  'db-super': 3,
  'db-daima': 4,
};

function eraRank(era: EraKey): number {
  return ERA_RELEASE_RANK[era];
}

export function parseTimelineOrder(raw: string | null | undefined): TimelineOrder {
  return raw === 'release' ? 'release' : 'chronological';
}
