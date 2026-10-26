import { describe, expect, it } from 'vitest';
import {
    parseSeriesPrefs,
    sortSeries,
    type SeriesItem,
} from './-series-model';

const make = (over: Partial<SeriesItem> & { id: number }): SeriesItem => ({
    title: `Serie ${over.id}`,
    eps: 100,
    year: 2000,
    progress: 0,
    img: '',
    poster: '',
    desc: '',
    watched: 0,
    lastVisit: 0,
    yearNum: 2000,
    orderNum: over.id,
    ...over,
});

const LIST: SeriesItem[] = [
    make({ id: 1, title: 'Dragon Ball', yearNum: 1986, year: 1986, orderNum: 1, progress: 100, lastVisit: 100 }),
    make({ id: 2, title: 'Dragon Ball Z', yearNum: 1989, year: 1989, orderNum: 2, progress: 40, lastVisit: 300 }),
    make({ id: 3, title: 'Dragon Ball GT', yearNum: 1996, year: 1996, orderNum: 3, progress: 0 }),
    make({ id: 4, title: 'Ángel de Dragon Ball', yearNum: 2024, year: 2024, orderNum: 6, progress: 10, lastVisit: 200 }),
];

const ids = (list: SeriesItem[]) => list.map(s => s.id);

describe('sortSeries', () => {
    it('orden de la saga por defecto', () => {
        expect(ids(sortSeries([LIST[3], LIST[0], LIST[2], LIST[1]], 'saga'))).toEqual([1, 2, 3, 4]);
    });

    it('alfabético ignora tildes y mayúsculas', () => {
        expect(ids(sortSeries(LIST, 'alpha'))).toEqual([4, 1, 3, 2]);
    });

    it('año ascendente', () => {
        expect(ids(sortSeries([LIST[3], LIST[1], LIST[0]], 'year'))).toEqual([1, 2, 4]);
    });

    it('última visita: recientes primero y sin historial al final', () => {
        expect(ids(sortSeries(LIST, 'recent'))).toEqual([2, 4, 1, 3]);
    });

    it('progreso: a medias, luego sin empezar, al final las completas', () => {
        expect(ids(sortSeries(LIST, 'progress'))).toEqual([2, 4, 3, 1]);
    });

    it('no modifica la lista original', () => {
        const copy = [...LIST];
        sortSeries(LIST, 'alpha');
        expect(LIST).toEqual(copy);
    });
});

describe('parseSeriesPrefs', () => {
    it('lee vista y orden válidos', () => {
        expect(parseSeriesPrefs('{"view":"etapas","sort":"alpha"}')).toEqual({ view: 'etapas', sort: 'alpha' });
    });

    it('descarta valores desconocidos y JSON roto', () => {
        expect(parseSeriesPrefs('{"view":"x","sort":"y"}')).toEqual({});
        expect(parseSeriesPrefs('no es json')).toEqual({});
        expect(parseSeriesPrefs(null)).toEqual({});
    });
});
