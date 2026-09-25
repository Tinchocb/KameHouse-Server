import type { ChronologyProgressResponse } from '@/api/generated/types';

export interface SpanRange {
  id: string;
  tmdbId?: number;
  startEpisode?: number;
  endEpisode?: number;
}

export interface SpanProgress {
  /** Visto según el historial, antes de aplicar marcas manuales. */
  derivedWatched: boolean;
  /** Estado final: marca manual si existe, si no el derivado. */
  watched: boolean;
  /** 0–100; una marca manual lo fuerza a 0 o 100. */
  percent: number;
  watchedEpisodes: number;
  totalEpisodes: number;
  /**
   * Episodio para seguir: el siguiente al último visto (así no te devuelve al relleno
   * que salteaste) o, si el último del rango ya está visto, el primero que falte.
   * undefined si el lapso no está empezado o está completo.
   */
  nextEpisode?: number;
}

/**
 * Reparte los episodios vistos por serie entre los lapsos según su rango de
 * episodios. Los rangos solo viven en dragonball_story_spans.json: el servidor
 * no los conoce.
 */
export function computeSpanProgress(
  spans: SpanRange[],
  progress: ChronologyProgressResponse | undefined
): Map<string, SpanProgress> {
  const seriesByTmdb = new Map<number, { completed: boolean; watched: Set<number> }>();
  for (const s of progress?.series ?? []) {
    seriesByTmdb.set(s.tmdbId, { completed: s.completed, watched: new Set(s.watchedEpisodes ?? []) });
  }
  const overrides = progress?.overrides ?? {};

  const out = new Map<string, SpanProgress>();
  for (const span of spans) {
    const series = span.tmdbId != null ? seriesByTmdb.get(span.tmdbId) : undefined;
    const start = span.startEpisode ?? 0;
    const end = span.endEpisode ?? -1;
    const totalEpisodes = Math.max(0, end - start + 1);

    let watchedEpisodes = 0;
    let firstUnwatched: number | undefined;
    let lastWatched: number | undefined;
    if (series?.completed) {
      watchedEpisodes = totalEpisodes;
    } else if (series) {
      for (let ep = start; ep <= end; ep++) {
        if (series.watched.has(ep)) {
          watchedEpisodes++;
          lastWatched = ep;
        } else {
          firstUnwatched ??= ep;
        }
      }
    }

    const derivedWatched = totalEpisodes > 0 && watchedEpisodes === totalEpisodes;
    const override = overrides[span.id];
    const watched = override ?? derivedWatched;
    const percent =
      override === true ? 100
        : override === false ? 0
          : totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;

    const nextEpisode =
      lastWatched === undefined || firstUnwatched === undefined
        ? undefined
        : lastWatched < end
          ? lastWatched + 1
          : firstUnwatched;

    out.set(span.id, { derivedWatched, watched, percent, watchedEpisodes, totalEpisodes, nextEpisode });
  }
  return out;
}

/**
 * Marca que hay que guardar para que el lapso quede en `desired`: si coincide
 * con lo que dice el historial se borra la marca (null) y el lapso vuelve a
 * seguir el historial.
 */
export function overrideFor(progress: SpanProgress | undefined, desired: boolean): boolean | null {
  return (progress?.derivedWatched ?? false) === desired ? null : desired;
}
