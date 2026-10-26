import type { VolumeData } from '../types';

export type SegmentState = 'seen' | 'next' | 'filler' | 'pending';

/** Más segmentos que esto se vuelven rayitas ilegibles: pasan a una barra continua. */
const MAX_SEGMENTS = 30;

/** Un segmento por episodio: visto, siguiente, relleno o pendiente. Null si el lapso es demasiado largo. */
export function buildSegments(
  volume: Pick<VolumeData, 'episodesCount' | 'startEpisode' | 'fillerEpisodes'>,
  isRead: boolean,
  progressPercent: number,
  nextEpisode?: number,
  seenEpisodes?: number[],
): SegmentState[] | null {
  const count = volume.episodesCount;
  if (!count || count > MAX_SEGMENTS) return null;
  const start = volume.startEpisode;
  const fillers = new Set(volume.fillerEpisodes ?? []);
  const seenSet = seenEpisodes ? new Set(seenEpisodes) : null;
  const seenByPercent = Math.round((count * progressPercent) / 100);

  return Array.from({ length: count }, (_, i): SegmentState => {
    const ep = start !== undefined ? start + i : undefined;
    // Con la lista real de episodios vistos se pinta exacto; sin ella, se estima por porcentaje.
    const seen = isRead || (seenSet && ep !== undefined ? seenSet.has(ep) : i < seenByPercent);
    if (seen) return 'seen';
    if (!isRead && ep !== undefined && ep === nextEpisode) return 'next';
    if (ep !== undefined && fillers.has(ep)) return 'filler';
    return 'pending';
  });
}

/** Estado del lapso para la tarjeta: sin archivos, visto, en curso o pendiente. */
type SpanStatus = 'unavailable' | 'seen' | 'in-progress' | 'pending';

export function spanStatus(isRead: boolean, progressPercent: number, hasLocalSeries: boolean): SpanStatus {
  if (isRead) return 'seen';
  if (progressPercent > 0 && progressPercent < 100) return 'in-progress';
  return hasLocalSeries ? 'pending' : 'unavailable';
}

interface PlayTarget {
  label: string;
  episode: number;
}

/**
 * El botón principal dice qué va a pasar: seguir donde quedaste, empezar o repetir.
 * Visto → "Ver de nuevo" desde el primer episodio; en curso → "Continuar" en el siguiente; si no, "Empezar".
 */
export function playTargetFor(
  volume: Pick<VolumeData, 'startEpisode' | 'recommendedStartEpisode'>,
  isRead: boolean,
  progressPercent: number,
  nextEpisode?: number,
): PlayTarget {
  const defaultEp = volume.recommendedStartEpisode || volume.startEpisode || 1;
  if (isRead) return { label: 'Ver de nuevo', episode: volume.startEpisode || defaultEp };
  if (progressPercent > 0 && progressPercent < 100 && nextEpisode) {
    return { label: `Continuar · Ep. ${nextEpisode}`, episode: nextEpisode };
  }
  return { label: `Empezar · Ep. ${defaultEp}`, episode: defaultEp };
}

/** "1–13" a partir de los números de episodio, o del texto heredado ("Caps 01 al 13"). */
export function formatEpisodeRange(
  volume: Pick<VolumeData, 'startEpisode' | 'endEpisode' | 'episodesRange'>,
): string {
  if (volume.startEpisode && volume.endEpisode) {
    return volume.startEpisode === volume.endEpisode
      ? `${volume.startEpisode}`
      : `${volume.startEpisode}–${volume.endEpisode}`;
  }
  return volume.episodesRange
    .replace(/^caps?\s*/i, '')
    .replace(/\s*al\s*/i, '–')
    .replace(/^0+/g, '')
    .replace(/–0+/g, '–');
}

/** "1 episodio" / "13 episodios". */
export function episodesLabel(count: number): string {
  return `${count} ${count === 1 ? 'episodio' : 'episodios'}`;
}

/** Línea de avance bajo la barra: "Visto", "3/13 vistos" o "13 episodios". */
export function progressCaption(
  status: SpanStatus,
  seenCount: number | null,
  progressPercent: number,
  episodesCount: number,
): string {
  if (status === 'seen') return 'Visto';
  if (status === 'in-progress') {
    return seenCount !== null ? `${seenCount}/${episodesCount} vistos` : `${progressPercent}% visto`;
  }
  return episodesLabel(episodesCount);
}
