import { describe, expect, it } from 'vitest';
import { buildYearScale, nearestMark, parseYearRange, type YearScaleModel } from './yearScale';
import { AIR_YEARS_BY_ERA, compareRelease, eraKeysForOrder } from './releaseOrder';
import { SPAN_VOLUMES } from './spansToVolumes';
import { CHRONOLOGY_INTERLUDES } from './interludes';

/** Escala con datos válidos: en estos tests nunca es null. */
const build = (...args: Parameters<typeof buildYearScale>) => buildYearScale(...args) as YearScaleModel;

const v = (id: string, seriesId: 'classic' | 'z' | 'daima' | 'super' | 'gt', year: string) => ({
  id,
  seriesId,
  officialYear: year,
  officialYearNumber: parseYearRange(year)?.start ?? 0,
});

describe('parseYearRange', () => {
  it('lee años sueltos, rangos y notas', () => {
    expect(parseYearRange('Año 749')).toEqual({ start: 749, end: 749 });
    expect(parseYearRange('Año 790 – 889')).toEqual({ start: 790, end: 889 });
    expect(parseYearRange('Año 762 (Diciembre)')).toEqual({ start: 762, end: 762 });
    expect(parseYearRange('sin años')).toBeNull();
  });
});

describe('buildYearScale', () => {
  const vols = [
    v('a', 'classic', 'Año 749'),
    v('b', 'classic', 'Año 749'),
    v('c', 'classic', 'Año 753'),
    v('d', 'z', 'Año 761'),
    v('e', 'z', 'Año 774'),
  ];

  it('proporciona los años: el mismo ancho por año y un hueco notable entre eras', () => {
    const scale = build(vols);
    expect(scale.minYear).toBe(749);
    expect(scale.maxYear).toBe(774);
    // 749 y 753 están a 4 años: su distancia es 4/26 del eje (más lo que se reparte dentro del año).
    const a = scale.marks[0].x;
    const c = scale.marks[2].x;
    expect(c - a).toBeGreaterThan(3.5 / 26);
    expect(c - a).toBeLessThan(4.5 / 26);
    expect(scale.marks.every((m) => m.x > 0 && m.x < 1)).toBe(true);
  });

  it('reparte los lapsos de un mismo año sin pisarse', () => {
    const [a, b] = build(vols).marks;
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x - a.x).toBeLessThan(1 / 26);
  });

  it('rotula el hueco entre eras con sus años', () => {
    const { gaps } = build(vols);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ fromYear: 754, toYear: 760, years: 7 });
  });

  it('un final lejano no estira el eje', () => {
    const scale = build([v('x', 'gt', 'Año 789 – 790'), v('y', 'gt', 'Año 790 – 889')]);
    expect(scale.maxYear).toBe(790);
  });

  it('marcas cada 5 años alineadas al múltiplo', () => {
    expect(build(vols).ticks.map((t) => t.year)).toEqual([750, 755, 760, 765, 770]);
  });

  it('ancla los interludios al rango de años y omite los del mismo año', () => {
    const scale = build(vols, [
      { id: 'i1', fromVolumeId: 'c', toVolumeId: 'd' },
      { id: 'i2', fromVolumeId: 'a', toVolumeId: 'b' },
      { id: 'i3', fromVolumeId: 'e', toVolumeId: null },
    ]);
    expect(scale.interludes.map((i) => i.id)).toEqual(['i1']);
    expect(scale.interludes[0].x1).toBeGreaterThan(scale.interludes[0].x0);
  });

  it('devuelve null sin lapsos', () => {
    expect(buildYearScale([])).toBeNull();
  });

  it('con los datos reales cubre 749–790 y los 35 lapsos', () => {
    const scale = build(SPAN_VOLUMES.slice().sort((a, b) => a.officialYearNumber - b.officialYearNumber || (a.order ?? 0) - (b.order ?? 0)), CHRONOLOGY_INTERLUDES);
    expect(scale.minYear).toBe(749);
    expect(scale.maxYear).toBe(790);
    expect(scale.marks).toHaveLength(SPAN_VOLUMES.length);
    expect(scale.gaps.length).toBeGreaterThan(0);
  });
});

describe('nearestMark', () => {
  it('elige el lapso más cercano a una posición', () => {
    const scale = build([v('a', 'classic', 'Año 749'), v('d', 'z', 'Año 761')]);
    expect(nearestMark(scale.marks, 0.05)?.id).toBe('a');
    expect(nearestMark(scale.marks, 0.95)?.id).toBe('d');
    expect(nearestMark([], 0.5)).toBeUndefined();
  });
});

describe('orden de estreno', () => {
  const mk = (seriesId: 'classic' | 'z' | 'daima' | 'super' | 'gt', startEpisode: number) => ({ seriesId, startEpisode, order: 0, officialYearNumber: 0 });

  it('ordena las series por emisión: Dragon Ball, Z, GT, Super, Daima', () => {
    const sorted = [mk('daima', 1), mk('super', 1), mk('gt', 1), mk('z', 1), mk('classic', 1)].sort(compareRelease);
    expect(sorted.map((s) => s.seriesId)).toEqual(['classic', 'z', 'gt', 'super', 'daima']);
  });

  it('dentro de una serie, por episodio', () => {
    expect([mk('z', 100), mk('z', 5)].sort(compareRelease).map((s) => s.startEpisode)).toEqual([5, 100]);
  });

  it('con los datos reales las eras quedan agrupadas y GT va antes que Super', () => {
    const sorted = SPAN_VOLUMES.slice().sort(compareRelease).map((s) => s.seriesId);
    const firstIndex = (id: string) => sorted.indexOf(id as never);
    expect(firstIndex('gt')).toBeLessThan(firstIndex('super'));
    expect(firstIndex('daima')).toBe(sorted.length - sorted.filter((s) => s === 'daima').length);
    // Sin intercalados: cada serie es un solo bloque.
    expect(sorted.filter((s, i) => i > 0 && s !== sorted[i - 1]).length).toBe(4);
  });

  it('el orden de eras de la barra sigue al orden elegido', () => {
    expect(eraKeysForOrder('chronological')).toEqual(['db-clasico', 'db-z', 'db-daima', 'db-super', 'db-gt']);
    expect(eraKeysForOrder('release')).toEqual(['db-clasico', 'db-z', 'db-gt', 'db-super', 'db-daima']);
  });

  it('cada era tiene años de emisión', () => {
    expect(Object.keys(AIR_YEARS_BY_ERA)).toHaveLength(5);
  });
});

describe('preferencias de la línea de tiempo', () => {
  it('vista y orden persisten por dispositivo y toleran valores inválidos', async () => {
    const { parseTimelineView, readTimelineView, writePref, TIMELINE_VIEW_KEY } = await import('./timelinePrefs');
    expect(parseTimelineView('compact')).toBe('compact');
    expect(parseTimelineView('xx')).toBe('detailed');
    expect(readTimelineView()).toBe('detailed');
    writePref(TIMELINE_VIEW_KEY, 'compact');
    expect(readTimelineView()).toBe('compact');
    localStorage.removeItem(TIMELINE_VIEW_KEY);
  });
});
