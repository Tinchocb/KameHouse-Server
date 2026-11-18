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
    yearNum: 2000,
    orderNum: over.id,
    ...over,
});

const LIST: SeriesItem[] = [
    make({ id: 1, title: 'Dragon Ball', yearNum: 1986, year: 1986, orderNum: 1, progress: 100 }),
    make({ id: 2, title: 'Dragon Ball Z', yearNum: 1989, year: 1989, orderNum: 2, progress: 40 }),
    make({ id: 3, title: 'Dragon Ball GT', yearNum: 1996, year: 1996, orderNum: 3, progress: 0 }),
    make({ id: 4, title: 'Ángel de Dragon Ball', yearNum: 2024, year: 2024, orderNum: 6, progress: 10 }),
];

const ids = (list: SeriesItem[]) => list.map(s => s.id);

describe('sortSeries', () => {
    it('orden de la saga por defecto', () => {
        expect(ids(sortSeries([LIST[3], LIST[0], LIST[2], LIST[1]]))).toEqual([1, 2, 3, 4]);
    });

    it('no modifica la lista original', () => {
        const copy = [...LIST];
        sortSeries(LIST);
        expect(LIST).toEqual(copy);
    });
});

describe('parseSeriesPrefs', () => {
    it('lee vista válida', () => {
        expect(parseSeriesPrefs('{"view":"cards"}')).toEqual({ view: 'cards' });
        expect(parseSeriesPrefs('{"view":"shelf"}')).toEqual({ view: 'shelf' });
    });

    it('descarta valores desconocidos, valores obsoletos como etapas, y JSON roto', () => {
        expect(parseSeriesPrefs('{"view":"etapas"}')).toEqual({});
        expect(parseSeriesPrefs('{"view":"x","sort":"y"}')).toEqual({});
        expect(parseSeriesPrefs('no es json')).toEqual({});
        expect(parseSeriesPrefs(null)).toEqual({});
    });
});
