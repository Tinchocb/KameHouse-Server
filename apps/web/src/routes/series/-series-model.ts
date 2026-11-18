import type { Anime_LibraryCollection } from '@/api/generated/types';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { getMediumResImage } from '@/lib/helpers/images';
import {
    DAIMA_VERTICAL_POSTER,
    DRAGON_BALL_SERIES_INFO,
    DRAGON_BALL_SERIES_ORDER,
    getSeriesIdFromMedia,
    getSeriesYear,
} from '@/lib/helpers/series';

/** Serie ya normalizada para la pantalla (lomo, portada y fila "A continuación"). */
export interface SeriesItem {
    id: number;
    title: string;
    eps: number;
    year: string | number;
    progress: number;
    img: string;
    poster: string;
    desc: string;
    seriesId?: string;
    /** Episodios vistos. */
    watched?: number;
    yearNum?: number;
    orderNum?: number;
}

// ─── Orden ────────────────────────────────────────────────────────────────────

const COLLATOR = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const bySaga = (a: SeriesItem, b: SeriesItem) =>
    (a.orderNum ?? 999) - (b.orderNum ?? 999) || (a.yearNum ?? 9999) - (b.yearNum ?? 9999) || COLLATOR.compare(a.title, b.title);

export function sortSeries(list: readonly SeriesItem[]): SeriesItem[] {
    return [...list].sort(bySaga);
}

// ─── Preferencias por dispositivo ─────────────────────────────────────────────

type SeriesViewPref = 'cards' | 'shelf';

interface SeriesPrefs {
    view?: SeriesViewPref;
}

const SERIES_PREFS_KEY = 'kamehouse-series-prefs';

export function parseSeriesPrefs(raw: string | null): SeriesPrefs {
    if (!raw) return {};
    try {
        const v = JSON.parse(raw) as Record<string, unknown>;
        const prefs: SeriesPrefs = {};
        if (v.view === 'shelf' || v.view === 'cards') prefs.view = v.view;
        return prefs;
    } catch {
        return {};
    }
}

export function loadSeriesPrefs(): SeriesPrefs {
    try {
        return parseSeriesPrefs(window.localStorage.getItem(SERIES_PREFS_KEY));
    } catch {
        return {};
    }
}

export function saveSeriesPrefs(patch: Partial<SeriesPrefs>): void {
    try {
        window.localStorage.setItem(SERIES_PREFS_KEY, JSON.stringify({ ...loadSeriesPrefs(), ...patch }));
    } catch {
        // Sin almacenamiento (modo privado, bloqueado): la pantalla funciona igual.
    }
}

// ─── Colección → series ───────────────────────────────────────────────────────

type CollectionEntry = ReturnType<typeof getSafeCollectionEntries>[number];

/** Series (no películas ni especiales) de la colección, sin repetidos y en orden de saga. */
export function buildSeriesList(
    collection: Anime_LibraryCollection | undefined,
): SeriesItem[] {
    if (!collection?.lists) return [];
    const raw = getSafeCollectionEntries(collection).filter(entry => {
        if (!entry) return false;
        const media = entry.media;
        const format = media?.format?.toUpperCase();
        const type = media?.type?.toUpperCase();
        if (format === 'MOVIE' || format === 'OVA' || format === 'SPECIAL') return false;
        if (type === 'MOVIE') return false;

        const allTitles = [media?.titleSpanish, media?.titleEnglish, media?.titleRomaji, media?.titleOriginal]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        const totalEps = media?.totalEpisodes || entry.libraryData?.mainFileCount || 0;
        return !(totalEps <= 1 && /movie|pelicula|película|film/.test(allTitles));
    });

    const unique = new Map<number, NonNullable<CollectionEntry>>();
    raw.forEach(s => { if (s?.mediaId) unique.set(s.mediaId, s); });

    const mapped = Array.from(unique.values()).map((s): SeriesItem => {
        const media = s.media;
        const title = media?.titleSpanish || media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || 'Sin título';
        const seriesId = getSeriesIdFromMedia(media, title);
        const canonicalInfo = seriesId ? DRAGON_BALL_SERIES_INFO[seriesId] : undefined;

        const rawTotalEps = media?.totalEpisodes || s.libraryData?.mainFileCount || 0;
        const totalEps = rawTotalEps > 0 ? rawTotalEps : (canonicalInfo?.episodes || 0);

        const watchedFromLibrary = s.libraryData
            ? Math.max(0, (s.libraryData.mainFileCount || 0) - (s.libraryData.unwatchedCount || 0))
            : 0;
        const watched = s.listData?.progress || watchedFromLibrary;
        const progress = totalEps > 0 ? Math.min(100, Math.round((watched / totalEps) * 100)) : 0;
        const year = getSeriesYear(title, media?.year, media?.startDate, seriesId);

        const rawDesc = media?.description?.replace(/<[^>]*>?/gm, '').trim();
        const desc = canonicalInfo?.description || ((rawDesc && rawDesc.toLowerCase() !== 'sin descripción') ? rawDesc : 'Sin sinopsis disponible.');

        const posterImg = seriesId === 'dragon_ball_daima'
            ? DAIMA_VERTICAL_POSTER
            : (media?.posterImage || media?.bannerImage || canonicalInfo?.poster || '');
        const bannerImg = media?.bannerImage || media?.posterImage || canonicalInfo?.banner || '';

        return {
            id: s.mediaId as number,
            title: canonicalInfo?.title || title,
            eps: totalEps,
            year,
            progress,
            watched: totalEps > 0 ? Math.min(watched, totalEps) : watched,
            img: getMediumResImage(bannerImg),
            poster: getMediumResImage(posterImg),
            desc,
            seriesId,
            yearNum: year === 'N/A' ? 9999 : Number(year),
            orderNum: DRAGON_BALL_SERIES_ORDER[seriesId] ?? 999,
        };
    });

    return sortSeries(mapped);
}
