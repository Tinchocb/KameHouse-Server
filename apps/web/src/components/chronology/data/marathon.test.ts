import { describe, expect, it } from 'vitest';
import {
  MARATHON_MAX_ITEMS,
  buildMarathonPlan,
  marathonAdded,
  marathonEpisodeRefs,
  marathonStartEpisode,
  marathonSummary,
  mergeMarathon,
  spansForMarathon,
} from './marathon';
import type { VolumeData } from '../types';
import type { PlaylistItem } from '@/lib/stores/queue-store';

const span = (id: string, seriesId: VolumeData['seriesId'], start: number, end: number, mediaId: number | null = 10) =>
  ({ id, seriesId, startEpisode: start, endEpisode: end, mediaId: mediaId ?? undefined, seriesTag: 'Dragon Ball Z', sagaLabel: `Saga ${id}`, recommendedStartEpisode: undefined }) as unknown as VolumeData;

const ordered = [
  span('a', 'classic', 1, 3, 5),
  span('b', 'classic', 4, 6, 5),
  span('c', 'z', 1, 2),
  span('d', 'z', 3, 4),
  span('e', 'gt', 1, 2, 7),
];

describe('spansForMarathon', () => {
  it('va desde el lapso hasta el final de su era', () => {
    expect(spansForMarathon(ordered, 'c').map((s) => s.id)).toEqual(['c', 'd']);
    expect(spansForMarathon(ordered, 'a').map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('con "all" sigue hasta el final de la línea', () => {
    expect(spansForMarathon(ordered, 'b', 'all').map((s) => s.id)).toEqual(['b', 'c', 'd', 'e']);
  });
  it('un id desconocido no arma nada', () => {
    expect(spansForMarathon(ordered, 'zzz')).toEqual([]);
  });
});

describe('marathonEpisodeRefs', () => {
  it('arranca el primer lapso en el episodio indicado y los demás en su inicio', () => {
    const refs = marathonEpisodeRefs([ordered[2], ordered[3]], 2);
    expect(refs.map((r) => `${r.spanId}${r.episode}`)).toEqual(['c2', 'd3', 'd4']);
  });
  it('no empieza antes del primer episodio del lapso', () => {
    expect(marathonEpisodeRefs([ordered[2]], 0).map((r) => r.episode)).toEqual([1, 2]);
  });
  it('salta los lapsos sin serie en la biblioteca', () => {
    expect(marathonEpisodeRefs([span('x', 'z', 1, 3, null), ordered[3]]).map((r) => r.spanId)).toEqual(['d', 'd']);
  });
});

describe('marathonStartEpisode', () => {
  it('sigue donde quedaste o empieza en el recomendado', () => {
    expect(marathonStartEpisode({ startEpisode: 10 }, undefined)).toBe(10);
    expect(marathonStartEpisode({ startEpisode: 10, recommendedStartEpisode: 12 }, undefined)).toBe(12);
    expect(marathonStartEpisode({ startEpisode: 10 }, { percent: 40, nextEpisode: 13, watched: false })).toBe(13);
    expect(marathonStartEpisode({ startEpisode: 10 }, { percent: 100, nextEpisode: undefined, watched: true })).toBe(10);
  });
});

describe('buildMarathonPlan', () => {
  const files = new Map([[10, new Map([[1, '/z/1.mkv'], [2, '/z/2.mkv'], [4, '/z/4.mkv']])]]);
  const refs = marathonEpisodeRefs([ordered[2], ordered[3]]);

  it('arma los elementos con archivo y cuenta los que faltan', () => {
    const plan = buildMarathonPlan(refs, files);
    expect(plan.items.map((i) => i.episodeNumber)).toEqual([1, 2, 4]);
    expect(plan.missing).toBe(1);
    expect(plan.truncated).toBe(0);
    expect(plan.items[0]).toMatchObject({ id: '/z/1.mkv', playableUrl: '/z/1.mkv', mediaId: 10, subtitle: 'Episodio 1 · Saga c' });
  });

  it('respeta el tope de Mi Lista y dice cuántos quedaron fuera', () => {
    const many = new Map([[10, new Map(Array.from({ length: 80 }, (_, i) => [i + 1, `/z/${i + 1}.mkv`] as [number, string]))]]);
    const plan = buildMarathonPlan(marathonEpisodeRefs([span('big', 'z', 1, 80)]), many);
    expect(plan.items).toHaveLength(MARATHON_MAX_ITEMS);
    expect(plan.truncated).toBe(30);
  });

  it('el resumen cuenta episodios y avisa de lo que quedó afuera', () => {
    const plan = (n: number, missing: number, truncated: number) => ({ items: new Array(n).fill({}) as PlaylistItem[], missing, truncated });
    expect(marathonSummary(1, plan(1, 0, 0))).toBe('1 episodio');
    expect(marathonSummary(3, plan(3, 2, 0))).toBe('3 episodios. 2 sin archivo en tu biblioteca.');
    expect(marathonSummary(50, plan(50, 0, 12))).toContain('quedaron fuera 12');
    expect(marathonSummary(48, plan(50, 0, 103))).toContain('quedaron fuera 105');
    expect(marathonSummary(49, plan(50, 0, 0))).toContain('quedó fuera 1');
    expect(marathonAdded(2, 50, 'append')).toBe(48);
    expect(marathonAdded(2, 50, 'replace')).toBe(50);
  });
});

describe('mergeMarathon', () => {
  const item = (id: string, ep: number) => ({ id, episodeNumber: ep, title: 't', playableUrl: id, mediaId: 1 }) as PlaylistItem;
  const existing = [item('/a', 1), item('/b', 2)];

  it('replace descarta lo anterior', () => {
    expect(mergeMarathon(existing, [item('/c', 3)], 'replace').map((i) => i.id)).toEqual(['/c']);
  });
  it('append agrega al final y no repite', () => {
    expect(mergeMarathon(existing, [item('/b', 2), item('/c', 3)], 'append').map((i) => i.id)).toEqual(['/a', '/b', '/c']);
  });
  it('append no pasa del tope', () => {
    const full = Array.from({ length: MARATHON_MAX_ITEMS }, (_, i) => item(`/x${i}`, i));
    expect(mergeMarathon(full, [item('/n', 1)], 'append')).toHaveLength(MARATHON_MAX_ITEMS);
  });
});
