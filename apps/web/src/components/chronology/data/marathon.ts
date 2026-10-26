import type { VolumeData } from '../types';
import type { PlaylistItem } from '@/lib/stores/queue-store';
import { playTargetFor } from './cardModel';
import type { SpanProgress } from './spanProgress';

/** Mi Lista guarda como máximo 50 elementos entre sesiones: el maratón no pasa de ahí. */
export const MARATHON_MAX_ITEMS = 50;

type MarathonScope = 'era' | 'all';

/**
 * Lapsos del maratón: desde el elegido hasta el final de su era (o de toda la línea si `scope` es
 * "all"). Recibe los lapsos en el orden en que se ven en pantalla.
 */
export function spansForMarathon(
  ordered: readonly VolumeData[],
  fromId: string,
  scope: MarathonScope = 'era',
): VolumeData[] {
  const start = ordered.findIndex((v) => v.id === fromId);
  if (start < 0) return [];
  const out: VolumeData[] = [];
  for (let i = start; i < ordered.length; i++) {
    if (scope === 'era' && ordered[i].seriesId !== ordered[start].seriesId) break;
    out.push(ordered[i]);
  }
  return out;
}

interface MarathonEpisodeRef {
  mediaId: number;
  /** Episodio absoluto dentro de la serie. */
  episode: number;
  spanId: string;
  seriesTag: string;
  sagaLabel: string;
  thumbnail?: string;
}

/**
 * Episodios del maratón en orden. El primer lapso arranca en `firstEpisode` (donde seguirías viendo
 * ese lapso); los demás, en su primer episodio. Los lapsos sin serie en la biblioteca se saltan.
 */
export function marathonEpisodeRefs(spans: readonly VolumeData[], firstEpisode?: number): MarathonEpisodeRef[] {
  const refs: MarathonEpisodeRef[] = [];
  spans.forEach((span, index) => {
    if (!span.mediaId || span.startEpisode == null || span.endEpisode == null) return;
    const from = index === 0 && firstEpisode != null ? Math.max(span.startEpisode, firstEpisode) : span.startEpisode;
    for (let ep = from; ep <= span.endEpisode; ep++) {
      refs.push({
        mediaId: span.mediaId,
        episode: ep,
        spanId: span.id,
        seriesTag: span.seriesTag,
        sagaLabel: span.sagaLabel,
        thumbnail: span.posterUrl,
      });
    }
  });
  return refs;
}

/** Episodio con el que arranca el maratón: el mismo que el botón principal de la tarjeta. */
export function marathonStartEpisode(
  volume: Pick<VolumeData, 'startEpisode' | 'recommendedStartEpisode'>,
  progress: Pick<SpanProgress, 'percent' | 'nextEpisode' | 'watched'> | undefined,
): number {
  return playTargetFor(volume, progress?.watched ?? false, progress?.percent ?? 0, progress?.nextEpisode).episode;
}

/** Archivos locales por serie: mediaId → (episodio → ruta). */
export type LocalFileIndex = ReadonlyMap<number, ReadonlyMap<number, string>>;

export interface MarathonPlan {
  items: PlaylistItem[];
  /** Episodios que no tienen archivo local y quedaron fuera. */
  missing: number;
  /** Episodios que sobraron por el tope de Mi Lista. */
  truncated: number;
}

/** Arma los elementos de Mi Lista con los archivos que existen, respetando el tope. */
export function buildMarathonPlan(
  refs: readonly MarathonEpisodeRef[],
  files: LocalFileIndex,
  max: number = MARATHON_MAX_ITEMS,
): MarathonPlan {
  const available: PlaylistItem[] = [];
  let missing = 0;
  for (const ref of refs) {
    const path = files.get(ref.mediaId)?.get(ref.episode);
    if (!path) {
      missing += 1;
      continue;
    }
    available.push({
      id: path,
      title: ref.seriesTag,
      subtitle: `Episodio ${ref.episode} · ${ref.sagaLabel}`,
      playableUrl: path,
      thumbnail: ref.thumbnail,
      mediaId: ref.mediaId,
      episodeNumber: ref.episode,
      mediaFormat: 'TV',
    });
  }
  return { items: available.slice(0, max), missing, truncated: Math.max(0, available.length - max) };
}

export type MarathonMode = 'append' | 'replace';

/** Mi Lista resultante: al final de lo que ya hay (sin repetir) o reemplazándola. */
export function mergeMarathon(
  existing: readonly PlaylistItem[],
  items: readonly PlaylistItem[],
  mode: MarathonMode,
  max: number = MARATHON_MAX_ITEMS,
): PlaylistItem[] {
  if (mode === 'replace') return items.slice(0, max);
  const seen = new Set(existing.map((i) => `${i.id}|${i.episodeNumber ?? ''}`));
  const fresh = items.filter((i) => !seen.has(`${i.id}|${i.episodeNumber ?? ''}`));
  return [...existing, ...fresh].slice(0, max);
}

/** Cuántos episodios entraron de verdad a Mi Lista (con "añadir al final" puede haber menos lugar que episodios). */
export function marathonAdded(existingCount: number, mergedCount: number, mode: MarathonMode): number {
  return mode === 'replace' ? mergedCount : Math.max(0, mergedCount - existingCount);
}

/** Texto del aviso al armar el maratón: cuántos episodios entraron y qué quedó afuera. */
export function marathonSummary(added: number, plan: Pick<MarathonPlan, 'items' | 'missing' | 'truncated'>): string {
  const base = `${added} ${added === 1 ? 'episodio' : 'episodios'}`;
  const left = plan.truncated + Math.max(0, plan.items.length - added);
  const notes: string[] = [];
  if (left > 0) notes.push(`Mi Lista admite hasta ${MARATHON_MAX_ITEMS}: ${left === 1 ? 'quedó fuera 1' : `quedaron fuera ${left}`}`);
  if (plan.missing > 0) notes.push(`${plan.missing} sin archivo en tu biblioteca`);
  return notes.length > 0 ? `${base}. ${notes.join('; ')}.` : base;
}
