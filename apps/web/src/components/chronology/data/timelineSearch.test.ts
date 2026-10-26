import { describe, expect, it } from 'vitest';
import { normalizeText, searchTimeline } from './timelineSearch';
import { VOLUMES_DATA } from './volumes';
import type { VolumeData } from '../types';

const ids = (query: string, limit = 12) => searchTimeline(VOLUMES_DATA, query, limit).map((h) => h.volumeId);

describe('normalizeText', () => {
  it('quita tildes, mayúsculas y espacios de más', () => {
    expect(normalizeText('  Kámehameha   KAIŌ ')).toBe('kamehameha kaio');
  });
});

describe('searchTimeline con los datos reales', () => {
  it('sin texto no devuelve nada', () => {
    expect(searchTimeline(VOLUMES_DATA, '')).toEqual([]);
    expect(searchTimeline(VOLUMES_DATA, '   ')).toEqual([]);
  });

  it('encuentra por título de lapso y lo pone primero', () => {
    const first = VOLUMES_DATA[0];
    const hits = searchTimeline(VOLUMES_DATA, first.title.slice(0, 18));
    expect(hits[0].volumeId).toBe(first.id);
    expect(hits[0].label).toBe('Lapso');
  });

  it('encuentra por personaje, sin importar tildes ni mayúsculas', () => {
    const hits = searchTimeline(VOLUMES_DATA, 'VEGETA');
    expect(hits.length).toBeGreaterThan(3);
    expect(hits.some((h) => h.field === 'character')).toBe(true);
    expect(searchTimeline(VOLUMES_DATA, 'vegeta').map((h) => h.volumeId)).toEqual(hits.map((h) => h.volumeId));
  });

  it('encuentra por esferas y devuelve un fragmento', () => {
    const hits = searchTimeline(VOLUMES_DATA, 'esferas', 30);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.snippet.length).toBeGreaterThan(0);
  });

  it('encuentra por saga', () => {
    const hits = searchTimeline(VOLUMES_DATA, 'cell');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('respeta el límite y no repite lapsos', () => {
    const hits = searchTimeline(VOLUMES_DATA, 'goku', 5);
    expect(hits.length).toBeLessThanOrEqual(5);
    const all = searchTimeline(VOLUMES_DATA, 'goku', 100).map((h) => h.volumeId);
    expect(new Set(all).size).toBe(all.length);
  });

  it('una búsqueda sin coincidencias devuelve lista vacía', () => {
    expect(ids('zzzxqwv')).toEqual([]);
  });

  it('con varias palabras todas deben aparecer en el lapso', () => {
    const both = ids('goku vegeta', 100);
    const goku = new Set(ids('goku', 100));
    const vegeta = new Set(ids('vegeta', 100));
    for (const id of both) {
      expect(goku.has(id) && vegeta.has(id)).toBe(true);
    }
    expect(ids('goku zzzxqwv')).toEqual([]);
  });
});

describe('searchTimeline: relevancia', () => {
  const vol = (id: string, over: Partial<VolumeData>): VolumeData =>
    ({
      id, title: id, subtitle: '', volumeNumber: `Lapso ${id}`, sagaLabel: '', seriesTag: 'Dragon Ball Z', officialYear: 'Año 750',
      characters: [], keyArtifacts: [], narrative: {}, ...over,
    }) as unknown as VolumeData;

  it('el título pesa más que una mención en la trama y el personaje exacto más que uno parcial', () => {
    const volumes = [
      vol('trama', { detailedPlot: 'Aquí se menciona a Vegeta de pasada.' }),
      vol('parcial', { characters: ['Vegetto y Bulma'] }),
      vol('titulo', { title: 'Vegeta llega a la Tierra' }),
      vol('exacto', { characters: ['Vegeta'] }),
    ];
    expect(searchTimeline(volumes, 'vegeta').map((h) => h.volumeId)).toEqual(['titulo', 'exacto', 'trama']);
  });

  it('a igual relevancia conserva el orden de entrada', () => {
    const volumes = [vol('a', { characters: ['Piccolo'] }), vol('b', { characters: ['Piccolo'] })];
    expect(searchTimeline(volumes, 'piccolo').map((h) => h.volumeId)).toEqual(['a', 'b']);
  });

  it('el fragmento recorta textos largos alrededor de la coincidencia', () => {
    const long = `${'Mucho texto antes. '.repeat(10)}El Kamehameha final.${' Y mucho después.'.repeat(10)}`;
    const [hit] = searchTimeline([vol('x', { detailedPlot: long })], 'kamehameha');
    expect(hit.field).toBe('plot');
    expect(hit.snippet).toContain('Kamehameha');
    expect(hit.snippet.length).toBeLessThan(120);
    expect(hit.snippet.startsWith('…')).toBe(true);
  });
});
