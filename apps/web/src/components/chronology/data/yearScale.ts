import type { VolumeData } from '../types';
import type { ChronologyInterlude } from './interludes';
import { eraOfVolume, type EraKey } from './eraBar';

/** Años mínimos de un hueco entre eras para rotularlo en el eje. */
const GAP_LABEL_MIN_YEARS = 3;

/** Primer y último año de un texto como "Año 749 – 750" o "762 (Noviembre)"; null si no trae años. */
export function parseYearRange(label: string): { start: number; end: number } | null {
  const years = label.match(/\d{3,4}/g)?.map(Number);
  if (!years || years.length === 0) return null;
  return { start: years[0], end: years[years.length - 1] };
}

interface YearMark {
  id: string;
  era: EraKey | null;
  /** Año en que empieza el lapso. */
  year: number;
  /** Posición 0–1 sobre el eje (varios lapsos del mismo año se reparten dentro de su año). */
  x: number;
}

interface YearTick {
  year: number;
  x: number;
}

export interface EraBand {
  era: EraKey | null;
  x0: number;
  x1: number;
}

interface YearGap {
  fromYear: number;
  toYear: number;
  /** Años enteros sin lapsos entre dos eras. */
  years: number;
  x0: number;
  x1: number;
}

interface InterludeBar {
  id: string;
  toVolumeId: string | null;
  x0: number;
  x1: number;
}

export interface YearScaleModel {
  minYear: number;
  maxYear: number;
  marks: YearMark[];
  ticks: YearTick[];
  bands: EraBand[];
  gaps: YearGap[];
  interludes: InterludeBar[];
}

type ScaleVolume = Pick<VolumeData, 'id' | 'seriesId' | 'officialYear' | 'officialYearNumber'>;

/**
 * Eje de años proporcional: cada año ocupa el mismo ancho, así los huecos entre eras (7 años entre
 * la saga clásica y los Saiyajin, ~10 hasta Super…) se notan. Recibe los lapsos en orden in-universe.
 * Los años de un lapso son los de su inicio; un final lejano ("790 – 889") no estira el eje.
 */
export function buildYearScale(
  volumes: readonly ScaleVolume[],
  interludes: readonly Pick<ChronologyInterlude, 'id' | 'fromVolumeId' | 'toVolumeId'>[] = [],
  tickStep = 5,
): YearScaleModel | null {
  const starts = volumes.map((v) => parseYearRange(v.officialYear)?.start ?? v.officialYearNumber);
  const valid = starts.filter((y) => Number.isFinite(y) && y > 0);
  if (valid.length === 0) return null;
  const minYear = Math.min(...valid);
  const maxYear = Math.max(...valid);
  const span = maxYear - minYear + 1;
  const toX = (yearFloat: number) => (yearFloat - minYear) / span;

  // Lapsos por año, para repartirlos dentro de su año sin que se pisen.
  const countByYear = new Map<number, number>();
  for (const y of starts) countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  const seenByYear = new Map<number, number>();

  const marks: YearMark[] = volumes.map((v, i) => {
    const year = starts[i];
    const k = seenByYear.get(year) ?? 0;
    seenByYear.set(year, k + 1);
    const n = countByYear.get(year) ?? 1;
    return { id: v.id, era: eraOfVolume(v), year, x: toX(year + (k + 0.5) / n) };
  });

  const ticks: YearTick[] = [];
  for (let y = Math.ceil(minYear / tickStep) * tickStep; y <= maxYear; y += tickStep) {
    ticks.push({ year: y, x: toX(y + 0.5) });
  }

  // Una banda por tramo consecutivo de la misma era.
  const bandYears: { era: EraKey | null; first: number; last: number }[] = [];
  marks.forEach((m) => {
    const current = bandYears[bandYears.length - 1];
    if (current && current.era === m.era) current.last = Math.max(current.last, m.year);
    else bandYears.push({ era: m.era, first: m.year, last: m.year });
  });
  const bands: EraBand[] = bandYears.map((b) => ({ era: b.era, x0: toX(b.first), x1: toX(b.last + 1) }));

  const gaps: YearGap[] = [];
  for (let i = 1; i < bandYears.length; i++) {
    const years = bandYears[i].first - (bandYears[i - 1].last + 1);
    if (years >= GAP_LABEL_MIN_YEARS) {
      gaps.push({
        fromYear: bandYears[i - 1].last + 1,
        toYear: bandYears[i].first - 1,
        years,
        x0: toX(bandYears[i - 1].last + 1),
        x1: toX(bandYears[i].first),
      });
    }
  }

  const markById = new Map(marks.map((m) => [m.id, m]));
  const interludeBars: InterludeBar[] = [];
  for (const il of interludes) {
    const from = markById.get(il.fromVolumeId);
    const to = il.toVolumeId ? markById.get(il.toVolumeId) : undefined;
    if (!from || !to || to.year <= from.year) continue;
    interludeBars.push({ id: il.id, toVolumeId: il.toVolumeId, x0: from.x, x1: to.x });
  }

  return { minYear, maxYear, marks, ticks, bands, gaps, interludes: interludeBars };
}

/** Lapso más cercano a una posición 0–1 del eje (para tocar el eje y saltar). */
export function nearestMark(marks: readonly YearMark[], x: number): YearMark | undefined {
  let best: YearMark | undefined;
  let bestDist = Infinity;
  for (const m of marks) {
    const d = Math.abs(m.x - x);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}
