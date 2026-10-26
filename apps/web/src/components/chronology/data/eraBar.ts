import type { EraFilter, VolumeData } from '../types';
import type { SpanProgress } from './spanProgress';

export type EraKey = Exclude<EraFilter, 'all'>;

/** Orden in-universe de las eras (el de la barra). */
export const ERA_KEYS: readonly EraKey[] = ['db-clasico', 'db-z', 'db-daima', 'db-super', 'db-gt'];

export const ERA_FILTER_BY_SERIES: Record<NonNullable<VolumeData['seriesId']>, EraKey> = {
  classic: 'db-clasico',
  z: 'db-z',
  daima: 'db-daima',
  super: 'db-super',
  gt: 'db-gt',
};

const SERIES_BY_ERA_FILTER = Object.fromEntries(
  Object.entries(ERA_FILTER_BY_SERIES).map(([series, era]) => [era, series]),
) as Record<EraKey, NonNullable<VolumeData['seriesId']>>;

/** Id del elemento DOM de cada era en la línea de tiempo (`<section id>`). */
export function sectionIdForEra(era: EraKey): string {
  return `era-section-${SERIES_BY_ERA_FILTER[era]}`;
}

/** Era de la sección DOM (`era-section-<serie>`), o null si el id no es de una era. */
export function eraOfSectionId(sectionId: string | undefined): EraKey | null {
  if (!sectionId?.startsWith('era-section-')) return null;
  const series = sectionId.slice('era-section-'.length) as NonNullable<VolumeData['seriesId']>;
  return ERA_FILTER_BY_SERIES[series] ?? null;
}

/** Era de un lapso, o null si el lapso no declara serie. */
export function eraOfVolume(volume: Pick<VolumeData, 'seriesId'>): EraKey | null {
  return volume.seriesId ? ERA_FILTER_BY_SERIES[volume.seriesId] : null;
}

interface EraBarEntry {
  /** Lapsos de la era y cuántos están vistos. */
  count: number;
  read: number;
  /** Episodios de la era y cuántos están vistos (respeta las marcas manuales). */
  episodes: number;
  watchedEpisodes: number;
  /** 0–1: episodios vistos sobre episodios totales (0 si no hay episodios). */
  fraction: number;
}

function emptyEntry(): EraBarEntry {
  return { count: 0, read: 0, episodes: 0, watchedEpisodes: 0, fraction: 0 };
}

/**
 * Avance por era y global, para la barra de eras. Cuenta lapsos y episodios: un lapso con marca manual
 * de visto cuenta todos sus episodios; uno con marca de no visto, ninguno.
 */
export function computeEraBar(
  volumes: readonly Pick<VolumeData, 'id' | 'seriesId' | 'episodesCount'>[],
  progressById:
    | ReadonlyMap<string, Pick<SpanProgress, 'watched' | 'watchedEpisodes' | 'totalEpisodes'>>
    | undefined,
): Record<EraFilter, EraBarEntry> {
  const out = { all: emptyEntry() } as Record<EraFilter, EraBarEntry>;
  for (const era of ERA_KEYS) out[era] = emptyEntry();

  for (const vol of volumes) {
    const progress = progressById?.get(vol.id);
    const total = progress?.totalEpisodes || vol.episodesCount || 0;
    const watched = progress ? (progress.watched ? total : Math.min(total, progress.watchedEpisodes)) : 0;
    const era = eraOfVolume(vol);
    for (const key of era ? (['all', era] as const) : (['all'] as const)) {
      const entry = out[key];
      entry.count += 1;
      if (progress?.watched) entry.read += 1;
      entry.episodes += total;
      entry.watchedEpisodes += watched;
    }
  }
  for (const key of Object.keys(out) as EraFilter[]) {
    const entry = out[key];
    entry.fraction = entry.episodes > 0 ? entry.watchedEpisodes / entry.episodes : 0;
  }
  return out;
}
