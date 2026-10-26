import type { VolumeData } from '../types';

/** Qué parte del lapso coincidió con la búsqueda. */
type TimelineField =
  | 'title'
  | 'saga'
  | 'character'
  | 'artifact'
  | 'dragonBalls'
  | 'battle'
  | 'fact'
  | 'moment'
  | 'year'
  | 'plot';

interface TimelineHit {
  volumeId: string;
  field: TimelineField;
  /** Etiqueta corta del motivo ("Personaje", "Esferas"…), lista para mostrar. */
  label: string;
  /** Fragmento donde aparece lo buscado. */
  snippet: string;
  score: number;
}

const FIELD_LABEL: Record<TimelineField, string> = {
  title: 'Lapso',
  saga: 'Saga',
  character: 'Personaje',
  artifact: 'Artefacto',
  dragonBalls: 'Esferas',
  battle: 'Combate',
  fact: 'Dato clave',
  moment: 'Momento',
  year: 'Año',
  plot: 'Trama',
};

/** Peso de cada campo: el título del lapso pesa más que una mención en la trama. */
const FIELD_WEIGHT: Record<TimelineField, number> = {
  title: 130,
  saga: 110,
  character: 80,
  artifact: 70,
  dragonBalls: 65,
  battle: 55,
  fact: 45,
  moment: 35,
  year: 30,
  plot: 15,
};

interface Candidate {
  field: TimelineField;
  text: string;
  norm: string;
}

/** Minúsculas y sin tildes: «Kamehameha», «kámehameha» y «KAMEHAMEHA» son lo mismo. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const candidateCache = new WeakMap<object, Candidate[]>();

/** Textos buscables de un lapso, normalizados una sola vez. */
function candidatesFor(volume: VolumeData): Candidate[] {
  const cached = candidateCache.get(volume);
  if (cached) return cached;

  const out: Candidate[] = [];
  const add = (field: TimelineField, text: string | undefined | null) => {
    const value = text?.trim();
    if (value) out.push({ field, text: value, norm: normalizeText(value) });
  };

  add('title', volume.title);
  add('title', volume.subtitle);
  add('title', volume.volumeNumber);
  add('saga', volume.sagaLabel);
  add('saga', volume.seriesTag);
  add('saga', volume.sagaId?.replace(/-/g, ' '));
  for (const c of new Set([...(volume.characters ?? []), ...(volume.narrative?.characters ?? [])])) add('character', c);
  for (const a of new Set([...(volume.keyArtifacts ?? []), ...(volume.narrative?.keyArtifacts ?? [])])) add('artifact', a);
  add('dragonBalls', volume.dragonBallsStatus);
  for (const b of volume.detailedStory?.keyBattles ?? []) {
    add('battle', `${b.fighter1} contra ${b.fighter2}`);
    add('battle', b.outcome);
  }
  add('battle', volume.narrative?.climax?.decisiveBattle);
  for (const f of volume.keyFacts ?? []) add('fact', `${f.label}: ${f.value}`);
  for (const k of volume.quickCatchUpKeys ?? []) add('moment', k);
  for (const m of volume.detailedStory?.episodeMilestones ?? []) add('moment', m.title);
  add('year', volume.officialYear);
  add('plot', volume.previouslyOn);
  add('plot', volume.detailedPlot);

  candidateCache.set(volume, out);
  return out;
}

/** Fragmento de ~70 caracteres alrededor de la coincidencia, con puntos suspensivos si se corta. */
function snippetAround(text: string, norm: string, needle: string): string {
  // El texto normalizado conserva la longitud solo si no hubo espacios múltiples: se busca en el original.
  const index = norm.indexOf(needle);
  if (index < 0 || text.length <= 80) return text.length <= 80 ? text : `${text.slice(0, 77)}…`;
  const from = Math.max(0, index - 25);
  const to = Math.min(text.length, index + needle.length + 45);
  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}

/**
 * Busca en la cronología por título de lapso, saga, personaje, esferas, artefactos, combates, datos
 * clave y momentos. Cada lapso aparece una sola vez, con el mejor motivo, y se ordena por relevancia
 * (campo + coincidencia exacta o al inicio) y, a igual relevancia, por orden de entrada.
 * Todas las palabras de la búsqueda deben aparecer (en el mismo campo o repartidas por el lapso).
 */
export function searchTimeline(volumes: readonly VolumeData[], query: string, limit = 12): TimelineHit[] {
  const norm = normalizeText(query);
  if (norm.length < 1) return [];
  const words = norm.split(' ').filter(Boolean);

  const scored: Array<{ hit: TimelineHit; order: number }> = [];
  volumes.forEach((volume, order) => {
    const candidates = candidatesFor(volume);
    // Cada palabra tiene que estar en algún campo del lapso.
    const allWordsPresent = words.every((w) => candidates.some((c) => c.norm.includes(w)));
    if (!allWordsPresent) return;

    let best: { c: Candidate; score: number } | null = null;
    for (const c of candidates) {
      // El motivo es el campo que contiene la búsqueda completa o, si no, la primera palabra.
      const needle = c.norm.includes(norm) ? norm : words.find((w) => c.norm.includes(w));
      if (!needle) continue;
      let score = FIELD_WEIGHT[c.field];
      if (c.norm === norm) score += 40;
      else if (c.norm.startsWith(norm)) score += 25;
      else if (c.norm.split(' ').some((w) => w.startsWith(norm))) score += 15;
      if (needle !== norm) score -= 20;
      if (!best || score > best.score) best = { c, score };
    }
    if (!best) return;
    const needle = best.c.norm.includes(norm) ? norm : (words.find((w) => best?.c.norm.includes(w)) ?? norm);
    scored.push({
      order,
      hit: {
        volumeId: volume.id,
        field: best.c.field,
        label: FIELD_LABEL[best.c.field],
        snippet: snippetAround(best.c.text, best.c.norm, needle),
        score: best.score,
      },
    });
  });

  return scored
    .sort((a, b) => b.hit.score - a.hit.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.hit);
}
