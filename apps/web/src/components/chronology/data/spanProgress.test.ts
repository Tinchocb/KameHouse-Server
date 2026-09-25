import { describe, expect, it } from 'vitest';
import { computeSpanProgress, overrideFor } from './spanProgress';

const spans = [
  { id: 'dbz-a', tmdbId: 12971, startEpisode: 1, endEpisode: 4 },
  { id: 'dbz-b', tmdbId: 12971, startEpisode: 5, endEpisode: 6 },
  { id: 'gt-a', tmdbId: 12697, startEpisode: 1, endEpisode: 16 },
  { id: 'daima-a', tmdbId: 236994, startEpisode: 1, endEpisode: 10 },
];

describe('computeSpanProgress', () => {
  it('reparte los episodios vistos entre lapsos según su rango', () => {
    const map = computeSpanProgress(spans, {
      series: [
        { tmdbId: 12971, completed: false, watchedEpisodes: [1, 2, 5, 6] },
        { tmdbId: 12697, completed: true, watchedEpisodes: [] },
      ],
      overrides: {},
    });
    expect(map.get('dbz-a')).toMatchObject({ watched: false, percent: 50, watchedEpisodes: 2, totalEpisodes: 4 });
    expect(map.get('dbz-b')).toMatchObject({ watched: true, derivedWatched: true, percent: 100 });
    expect(map.get('gt-a')).toMatchObject({ watched: true, percent: 100 });
    expect(map.get('daima-a')).toMatchObject({ watched: false, percent: 0 });
  });

  it('las marcas manuales pisan al historial en ambos sentidos', () => {
    const map = computeSpanProgress(spans, {
      series: [{ tmdbId: 12971, completed: false, watchedEpisodes: [5, 6] }],
      overrides: { 'dbz-a': true, 'dbz-b': false },
    });
    expect(map.get('dbz-a')).toMatchObject({ watched: true, derivedWatched: false, percent: 100 });
    expect(map.get('dbz-b')).toMatchObject({ watched: false, derivedWatched: true, percent: 0 });
  });

  it('propone seguir por el episodio siguiente al último visto', () => {
    const map = computeSpanProgress(spans, {
      series: [
        // dbz-a (1–4): vio el 1 y el 3, salteó el 2 → sigue en el 4, no vuelve al 2.
        { tmdbId: 12971, completed: false, watchedEpisodes: [1, 3, 5, 6] },
        { tmdbId: 12697, completed: true, watchedEpisodes: [] },
      ],
      overrides: {},
    });
    expect(map.get('dbz-a')?.nextEpisode).toBe(4);
    expect(map.get('dbz-b')?.nextEpisode).toBeUndefined();
    expect(map.get('gt-a')?.nextEpisode).toBeUndefined();
    expect(map.get('daima-a')?.nextEpisode).toBeUndefined();
  });

  it('si ya vio el último episodio del lapso, propone el primero que falte', () => {
    const map = computeSpanProgress(spans, {
      series: [{ tmdbId: 12971, completed: false, watchedEpisodes: [1, 4] }],
      overrides: {},
    });
    expect(map.get('dbz-a')?.nextEpisode).toBe(2);
  });

  it('sin datos del servidor nada figura como visto', () => {
    const map = computeSpanProgress(spans, undefined);
    expect([...map.values()].every((p) => !p.watched && p.percent === 0)).toBe(true);
  });
});

describe('overrideFor', () => {
  it('borra la marca cuando el deseo coincide con el historial', () => {
    const watchedByHistory = { derivedWatched: true, watched: false, percent: 0, watchedEpisodes: 2, totalEpisodes: 2 };
    expect(overrideFor(watchedByHistory, true)).toBeNull();
    expect(overrideFor(watchedByHistory, false)).toBe(false);
    expect(overrideFor(undefined, true)).toBe(true);
    expect(overrideFor(undefined, false)).toBeNull();
  });
});
