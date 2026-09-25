import type { VolumeData } from '../types';

/** TMDB IDs canónicos por serie (misma fuente que dragonball_scanner_series). */
export const TMDB_ID_BY_SERIES_SLUG: Record<string, number> = {
  classic: 12609,
  z: 12971,
  gt: 12697,
  super: 62715,
  daima: 236994,
};

/**
 * AniList IDs canónicos por serie (verificados contra graphql.anilist.co).
 * Red de seguridad: solo se usan si falla local + TMDB.
 */
export const ANILIST_ID_BY_SERIES_SLUG: Record<string, number> = {
  classic: 223,
  z: 813,
  gt: 225,
  super: 21175,
  daima: 170083,
};

/** Slug de carpeta local para /public/episodes/<slug>/<abs>.webp */
export const LOCAL_SLUG_BY_VOLUME: Record<string, string> = {
  'vol-clasico-origen': 'classic',
  'vol-clasico-redribbon': 'classic',
  'vol-clasico-piccolo': 'classic',
  'vol-saiyan-choque': 'z',
  'vol-freezer-ssj': 'z',
  'vol-cell-trunks': 'z',
  'vol-cell-games': 'z',
  'vol-buu-caos': 'z',
  'vol-daima-reino': 'daima',
  'vol-super-dioses': 'super',
  'vol-super-black': 'super',
  'vol-super-torneo': 'super',
  'vol-gt-viaje': 'gt',
};

export function getSeriesSlugForVolume(volume: Pick<VolumeData, 'id' | 'seriesTag'> & { seriesId?: string }): string {
  const withSeries = volume as { seriesId?: string };
  if (withSeries.seriesId && TMDB_ID_BY_SERIES_SLUG[withSeries.seriesId]) return withSeries.seriesId;
  const direct = LOCAL_SLUG_BY_VOLUME[volume.id];
  if (direct) return direct;
  const tag = volume.seriesTag.toLowerCase();
  if (tag.includes('gt')) return 'gt';
  if (tag.includes('daima')) return 'daima';
  if (tag.includes('super')) return 'super';
  if (tag.includes('clásico') || tag.includes('clasico')) return 'classic';
  return 'z';
}

export function getTmdbIdForVolume(volume: Pick<VolumeData, 'id' | 'seriesTag' | 'tmdbId'>): number | undefined {
  if (typeof volume.tmdbId === 'number' && volume.tmdbId > 0) return volume.tmdbId;
  return TMDB_ID_BY_SERIES_SLUG[getSeriesSlugForVolume(volume)];
}

export function getAnilistIdForVolume(volume: Pick<VolumeData, 'id' | 'seriesTag'>): number | undefined {
  return ANILIST_ID_BY_SERIES_SLUG[getSeriesSlugForVolume(volume)];
}

/** Extrae el número absoluto de "Cap. 159", "Cap 159 Z", "Caps 001 al 028", etc. */
export function parseAbsoluteEpisode(label: string | undefined | null): number | undefined {
  if (!label) return undefined;
  const m = label.match(/(\d{1,4})/);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getLocalEpisodeThumbnail(
  volume: Pick<VolumeData, 'id' | 'seriesTag'> & { seriesId?: string },
  absoluteEpisode: number | undefined,
  explicitUrl?: string,
): string | undefined {
  if (explicitUrl && explicitUrl.trim() !== '') return explicitUrl;
  // No hay set curado en /public/episodes: adivinar la ruta daba un 404 por miniatura
  // (y un re-render al caer a la fuente siguiente). Solo cuenta una URL explícita.
  void volume;
  void absoluteEpisode;
  return undefined;
}
