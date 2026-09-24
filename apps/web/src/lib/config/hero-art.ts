/**
 * Registro único del arte de los Hero (Home / Series / Películas / detalle).
 *
 * Cada imagen declara su PUNTO FOCAL (dónde está el sujeto, 0–100 en X/Y) y
 * cómo está compuesta. `<HeroBackdrop>` usa esos datos para encuadrar sola en
 * cualquier proporción (mobile vertical incluido) y para elegir máscara/scrim,
 * así que sumar una imagen nueva es UNA entrada acá, sin tocar CSS.
 *
 * Las imágenes son siempre 16:9 horizontales (≥1920×1080). NUNCA pósters 2:3.
 * Los locales viven en `public/backdrops/<id>.webp` + LQIP en
 * `public/backdrops/lq/<id>.webp` (~64px); `hero-art.test.ts` valida ambos.
 */
import type { EraId } from "./eras"

/**
 * Composición de la imagen, guía la máscara lateral en desktop:
 * - `right`  → sujeto a la derecha: la izquierda puede fundirse a negro.
 * - `left` / `center` / `group` → hay personajes a la izquierda: máscara suave.
 */
export type HeroSubject = "left" | "center" | "right" | "group"

export interface HeroFocal {
    /** 0 (izquierda) – 100 (derecha) */
    x: number
    /** 0 (arriba) – 100 (abajo) */
    y: number
}

export interface HeroArt {
    /** URL local ("/backdrops/x.webp") o de TMDB (cualquier tamaño `/t/p/...`). */
    src: string
    focal: HeroFocal
    subject: HeroSubject
    /** Brillo general. Si falta, `<HeroBackdrop>` lo estima con la paleta. */
    tone?: "light" | "dark"
    /** Placeholder minúsculo para imágenes locales (TMDB usa w185 automáticamente). */
    lowRes?: string
    /**
     * Línea superior intocable (0–100 del alto de la imagen, típicamente el
     * tope de las cabezas). En contenedores muy panorámicos el recorte vertical
     * nunca sube de acá: se sacrifica la parte de abajo, que tapa el scrim.
     * Si falta, se usa `DEFAULT_SAFE_TOP`.
     */
    safeTop?: number
    /** Ancho/alto real si no es 16:9 (póster de último recurso: 2/3). */
    aspect?: number
}

/** Encuadre por defecto para arte sin curar: sujeto típico a la derecha. */
export const DEFAULT_SERIES_FOCAL: HeroFocal = { x: 70, y: 42 }
export const DEFAULT_MOVIE_FOCAL: HeroFocal = { x: 70, y: 45 }
/** Póster vertical usado como último recurso: cara arriba y centrada. */
export const POSTER_FOCAL: HeroFocal = { x: 50, y: 25 }
/** Arte sin curar: en el anime las cabezas suelen arrancar cerca del borde superior. */
export const DEFAULT_SAFE_TOP = 10
/** Proporción del arte de hero (siempre 16:9, ver cabecera). */
export const HERO_ART_ASPECT = 16 / 9

const local = (id: string, art: Omit<HeroArt, "src" | "lowRes">): HeroArt => ({
    src: `/backdrops/${id}.webp`,
    lowRes: `/backdrops/lq/${id}.webp`,
    ...art,
})

// ─── Series (arte curado local, uno por era) ─────────────────────────────────
export const SERIES_HERO_ART: Record<EraId, HeroArt> = {
    // Goku niño saltando, a la derecha del centro (pelo desde ~10%)
    db: local("db", { focal: { x: 66, y: 38 }, subject: "right", tone: "light", safeTop: 9 }),
    // Elenco completo frente al Tenkaichi Budokai (cabezas desde ~17%)
    dbz: local("dbz", { focal: { x: 50, y: 48 }, subject: "group", tone: "light", safeTop: 15 }),
    // Goku SSJ4 alcanzando la esfera, pegado al borde derecho (pelo desde el borde)
    dbgt: local("dbgt", { focal: { x: 78, y: 40 }, subject: "right", tone: "dark", safeTop: 4 }),
    // Goku de frente sobre fondo naranja, a la derecha (punta del pelo ~3%)
    dbkai: local("dbkai", { focal: { x: 74, y: 38 }, subject: "right", tone: "light", safeTop: 3 }),
    // Elenco Super sobre el mar, centrado (cabezas desde ~20%)
    dbs: local("dbs", { focal: { x: 48, y: 55 }, subject: "group", tone: "light", safeTop: 18 }),
    // Goku sobre el dragón a la derecha, castillo a la izquierda (alas desde ~12%)
    dbdaima: local("dbdaima", { focal: { x: 76, y: 36 }, subject: "right", tone: "light", safeTop: 12 }),
}

/** TMDB ID de cada serie → era (con y sin offset 1_000_000). */
const SERIES_TMDB_TO_ERA: Record<number, EraId> = {
    12609: "db",
    12971: "dbz",
    12697: "dbgt",
    61709: "dbkai",
    62715: "dbs",
    236994: "dbdaima",
}

// ─── Películas / especiales (TMDB, por TMDB ID y AniDB/legacy ID) ────────────
// Backdrops sin texto (iso_639_1 = null), elegidos midiendo la nitidez real
// (bordes a resolución completa vs. a la mitad): muchos de TMDB son capturas SD
// reescaladas que en el hero se ven blandas; se prefieren ilustraciones oficiales. Cada uno con su encuadre curado: el genérico cortaba cabezas en el
// stage panorámico (≈2.4:1) y fundía a negro personajes que estaban a la izquierda.
type MovieFraming = Pick<HeroArt, "focal" | "subject"> & Partial<Pick<HeroArt, "safeTop" | "tone">>

const tmdb = (path: string, framing: MovieFraming): HeroArt => ({
    src: `https://image.tmdb.org/t/p/w1280${path}`,
    ...framing,
})

// Dragon Ball Clásico
const DB_TRAFFIC = tmdb("/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg", { focal: { x: 55, y: 45 }, subject: "group", safeTop: 3, tone: "light" })
const DB_M1 = tmdb("/lY0mkwtMZTDwXSKtcTLi0EQxxPk.jpg", { focal: { x: 72, y: 40 }, subject: "right", safeTop: 15, tone: "dark" })
const DB_M2 = tmdb("/o8laRnRa6BLMNsMi4nqeSMx3zRV.jpg", { focal: { x: 55, y: 35 }, subject: "group", safeTop: 0 })
const DB_M3 = tmdb("/xvq3BaNgmAkdmdoz7isqX68XS40.jpg", { focal: { x: 55, y: 40 }, subject: "group", safeTop: 0, tone: "light" })
const DB_M4 = tmdb("/1R9xxxweS2se0pbcLToYZPXVbtv.jpg", { focal: { x: 45, y: 10 }, subject: "group", safeTop: 0 })
// Dragon Ball Z
const DBZ_M1 = tmdb("/vrO39EtblVpFNExJO5bitJiAwXI.jpg", { focal: { x: 50, y: 45 }, subject: "group", safeTop: 3 })
const DBZ_M2 = tmdb("/pLuoFuzygOdWBRJhLQWSbKeoZ0s.jpg", { focal: { x: 50, y: 35 }, subject: "group", safeTop: 3 })
const DBZ_M3 = tmdb("/9mZGGJJP04RBmrzh9XVSfqRXl0d.jpg", { focal: { x: 55, y: 35 }, subject: "group", safeTop: 2, tone: "light" })
const DBZ_M4 = tmdb("/jznY4TwOaVWZJoXA3D5FkvX3cUc.jpg", { focal: { x: 45, y: 0 }, subject: "group", safeTop: 0, tone: "light" })
const DBZ_M5 = tmdb("/8bBwrxTwj4MVoy2ivYCqNLCxRcf.jpg", { focal: { x: 60, y: 0 }, subject: "group", safeTop: 0, tone: "light" })
const DBZ_M6 = tmdb("/vBfE5L6p3iTrYxjokCHdwNRJ3HM.jpg", { focal: { x: 65, y: 45 }, subject: "right", safeTop: 0 })
const DBZ_M7 = tmdb("/br9p5Liij0JVXUtrvZPUZQTy9Tt.jpg", { focal: { x: 65, y: 35 }, subject: "right", safeTop: 0 })
const DBZ_M8 = tmdb("/Gsno5VK24rIMR1yVkfv6rDSl6E.jpg", { focal: { x: 65, y: 40 }, subject: "right", safeTop: 5 })
const DBZ_M9 = tmdb("/h5Rvh7TUOLqmY2AOebwSEnHolwB.jpg", { focal: { x: 58, y: 60 }, subject: "group", safeTop: 15 })
const DBZ_M10 = tmdb("/2WTjYoswcKZTQrokeUOhY3Xb3mZ.jpg", { focal: { x: 52, y: 40 }, subject: "center", safeTop: 5, tone: "light" })
const DBZ_M11 = tmdb("/w4AwSd8igVyAE1A1KsR4waa1KAW.jpg", { focal: { x: 72, y: 45 }, subject: "right", safeTop: 5 })
const DBZ_M12 = tmdb("/t9z8Wm8c0HnxfPN9YvXgmueG6De.jpg", { focal: { x: 50, y: 45 }, subject: "center", safeTop: 5 })
const DBZ_M13 = tmdb("/orROcqUdNe3rdepse6nskbxovXJ.jpg", { focal: { x: 70, y: 40 }, subject: "right", safeTop: 0 })
const DBZ_BARDOCK = tmdb("/yzAwIa8poIxtLB8MCuhs9jFQY9C.jpg", { focal: { x: 68, y: 40 }, subject: "right", safeTop: 8, tone: "dark" })
const DBZ_TRUNKS = tmdb("/eoeHNfUCLsq12rIgTOHZ93cOOsR.jpg", { focal: { x: 62, y: 40 }, subject: "group", safeTop: 5, tone: "light" })
const DBZ_YO_GOKU = tmdb("/hk9nHD5SuV3iGbYBubgxx9ZC9jf.jpg", { focal: { x: 55, y: 40 }, subject: "group", safeTop: 3, tone: "light" })
const DBZ_BARDOCK_OVA = tmdb("/kaLaBjygarZpRg8YzYu2mZqr952.jpg", { focal: { x: 50, y: 35 }, subject: "group", safeTop: 0 })
const DBZ_PLAN = tmdb("/au3nAjeEjip1JWIzG8MdNtaGFF7.jpg", { focal: { x: 50, y: 45 }, subject: "center", safeTop: 20, tone: "dark" })
// Dragon Ball GT
const DBGT_100 = tmdb("/f3CFFYE91RhtqbRtclFHlfhXxhT.jpg", { focal: { x: 75, y: 40 }, subject: "right", safeTop: 0, tone: "light" })
// Dragon Ball Super
const DBS_M1 = tmdb("/ju9RXuzdeXTLF9mmvPcqQopmeSj.jpg", { focal: { x: 60, y: 35 }, subject: "group", safeTop: 5 })
const DBS_M2 = tmdb("/usrUizny0dLNJTrrJSxsvu5V0z0.jpg", { focal: { x: 80, y: 30 }, subject: "right", safeTop: 0, tone: "dark" })
const DBS_M3 = tmdb("/8Tpq06iKw3Kpwz79yz6m5k36Mfl.jpg", { focal: { x: 50, y: 35 }, subject: "group", safeTop: 0, tone: "dark" })
const DBS_M4 = tmdb("/iItouOLw880qlICIffMYF664HkH.jpg", { focal: { x: 56, y: 40 }, subject: "group", safeTop: 5 })

export const MOVIE_HERO_ART: Record<number, HeroArt> = {
    // ─── Dragon Ball Clásico (Películas 1 - 4) ───────────────────────────────
    // Corto educativo: Seguridad Vial de Goku (1988; TMDB real 1259215)
    39322: DB_TRAFFIC,
    1259215: DB_TRAFFIC,
    // M1: La Leyenda de Shenlong (1986)
    39144: DB_M1,
    33499: DB_M1,
    // M2: La Princesa Durmiente en el Castillo del Mal (1987)
    39145: DB_M2,
    33500: DB_M2,
    // M3: Gran Aventura Mística (1988)
    116776: DB_M3,
    33513: DB_M3,
    // M4: El Camino hacia el Poder (1996)
    39148: DB_M4,

    // ─── Dragon Ball Z (Películas 1 - 13) ────────────────────────────────────
    // M1: ¡Devuélvanme a mi Gohan! / Dead Zone (1989)
    28609: DBZ_M1,
    15448: DBZ_M1,
    // M2: El Hombre Más Fuerte de Este Mundo (1990)
    39100: DBZ_M2,
    15449: DBZ_M2,
    // M3: La Batalla Más Grande de Este Mundo / Turles (1990)
    39101: DBZ_M3,
    15450: DBZ_M3,
    // M4: El Súper Guerrero Son Goku / Lord Slug (1991)
    39102: DBZ_M4,
    15451: DBZ_M4,
    // M5: Los Rivales Más Poderosos / Cooler (1991)
    24752: DBZ_M5,
    15452: DBZ_M5,
    // M6: Los Guerreros Más Poderosos / Metal Cooler (1992)
    39103: DBZ_M6,
    15453: DBZ_M6,
    // M7: La Batalla de los Tres Saiyajin / Androide 13 (1992)
    39104: DBZ_M7,
    15454: DBZ_M7,
    // M8: El Poder Invencible / Broly (1993)
    34433: DBZ_M8,
    15455: DBZ_M8,
    // M9: La Galaxia Corre Peligro / Bojack (1993)
    39105: DBZ_M9,
    15456: DBZ_M9,
    // M10: El Regreso del Guerrero Legendario / Broly 2 (1994)
    44251: DBZ_M10,
    15457: DBZ_M10,
    // M11: El Combate Definitivo / Bio-Broly (1994)
    39106: DBZ_M11,
    15458: DBZ_M11,
    // M12: La Fusión de Goku y Vegeta / Janemba - Gogeta (1995)
    39107: DBZ_M12,
    15459: DBZ_M12,
    // M13: El Ataque del Dragón / Tapion (1995)
    39108: DBZ_M13,
    15460: DBZ_M13,

    // ─── Dragon Ball Z (Especiales de TV y OVAs) ─────────────────────────────
    // Especial 1: El Padre de Goku / Bardock (1990)
    39323: DBZ_BARDOCK,
    15461: DBZ_BARDOCK,
    // Especial 2: Un Futuro Diferente / Trunks (1993)
    39324: DBZ_TRUNKS,
    // OVA 2008: ¡Hola! Son Goku y sus Amigos
    38594: DBZ_YO_GOKU,
    // OVA 2011: El Episodio de Bardock
    120475: DBZ_BARDOCK_OVA,
    // OVA 2010: Plan para Erradicar a los Saiyajin (y el original de 1993)
    55127: DBZ_PLAN,
    89636: DBZ_PLAN,
    652754: DBZ_PLAN,

    // ─── Dragon Ball GT (Especial de TV) ─────────────────────────────────────
    // Especial: 100 Años Después / Goku Jr. (1997)
    18095: DBGT_100,
    39149: DBGT_100,

    // ─── Dragon Ball Super (Películas) ───────────────────────────────────────
    // M1: La Batalla de los Dioses (2013)
    126963: DBS_M1,
    // M2: La Resurrección de Freezer (2015)
    303857: DBS_M2,
    // M3: Dragon Ball Super: Broly (2018)
    503314: DBS_M3,
    // M4: Dragon Ball Super: Super Hero (2022)
    610150: DBS_M4,
}

// ─── Resolución ──────────────────────────────────────────────────────────────

/** Arte sin curar (banner de AniList, backdrop dinámico): encuadre por defecto. */
export function heroArtFromUrl(src: string, overrides?: Partial<Omit<HeroArt, "src">>): HeroArt {
    return { src, focal: DEFAULT_SERIES_FOCAL, subject: "right", ...overrides }
}

function withOffsetVariants(...ids: (number | null | undefined)[]): number[] {
    const out: number[] = []
    for (const id of ids) {
        if (id == null || id <= 0) continue
        out.push(id)
        if (id >= 1_000_000) out.push(id - 1_000_000)
    }
    return out
}

/** Banner existente solo si es horizontal de verdad (distinto del póster). */
function usableBanner(banner?: string | null, poster?: string | null): string | null {
    const b = banner?.trim()
    if (!b) return null
    if (poster && b === poster.trim()) return null
    return b
}

/**
 * Arte 16:9 de una película: mapa curado (TMDB ID, ID con offset, AniDB ID)
 * y, si no, su bannerImage cuando no es el póster. NUNCA devuelve el póster.
 */
export function getMovieHeroArt(
    mediaOrId: { mediaId?: number | null; tmdbId?: number | null; bannerImage?: string | null; posterImage?: string | null } | number | null | undefined
): HeroArt | null {
    if (!mediaOrId) return null
    const media = typeof mediaOrId === "number" ? { mediaId: mediaOrId } : mediaOrId

    for (const id of withOffsetVariants(media.tmdbId, media.mediaId)) {
        const art = MOVIE_HERO_ART[id]
        if (art) return art
    }

    const banner = usableBanner(media.bannerImage, media.posterImage)
    return banner ? heroArtFromUrl(banner, { focal: DEFAULT_MOVIE_FOCAL }) : null
}

/**
 * Arte 16:9 de una serie: por EraId ("dbz") o por TMDB/media ID, y si no,
 * su bannerImage cuando no es el póster. NUNCA devuelve el póster.
 */
export function getSeriesHeroArt(
    eraOrId: string | number | null | undefined,
    existingBanner?: string | null,
    existingPoster?: string | null
): HeroArt | null {
    if (typeof eraOrId === "string") {
        const byEra = SERIES_HERO_ART[eraOrId.toLowerCase() as EraId]
        if (byEra) return byEra
    }
    if (typeof eraOrId === "number") {
        for (const id of withOffsetVariants(eraOrId)) {
            const era = SERIES_TMDB_TO_ERA[id]
            if (era) return SERIES_HERO_ART[era]
        }
    }

    const banner = usableBanner(existingBanner, existingPoster)
    return banner ? heroArtFromUrl(banner) : null
}

/** Atajos por URL para quien solo necesita la imagen (cards, backdrop global). */
export const getMovieWidescreenBackdrop = (...args: Parameters<typeof getMovieHeroArt>): string | null =>
    getMovieHeroArt(...args)?.src ?? null

export const getSeriesWidescreenBackdrop = (...args: Parameters<typeof getSeriesHeroArt>): string | null =>
    getSeriesHeroArt(...args)?.src ?? null

/**
 * `object-position` CSS del punto focal. Con el tamaño del contenedor, además
 * evita que un encuadre muy panorámico (detalle ≈ 2.9:1) recorte por encima de
 * `safeTop`: el `y%` de object-position reparte el sobrante vertical, así que
 * con focal.y ≈ 40 se comía la parte de arriba (cabezas) igual que la de abajo.
 */
export function heroObjectPosition(
    art: Pick<HeroArt, "focal" | "safeTop" | "aspect">,
    box?: { width: number; height: number } | null
): string {
    const { x, y } = art.focal
    if (!box || box.width <= 0 || box.height <= 0) return `${x}% ${y}%`

    // object-fit: cover → alto renderizado y sobrante vertical en px.
    const renderedHeight = Math.max(box.height, box.width / (art.aspect ?? HERO_ART_ASPECT))
    const excess = renderedHeight - box.height
    if (excess < 1) return `${x}% ${y}%`

    const maxTop = ((art.safeTop ?? DEFAULT_SAFE_TOP) / 100) * renderedHeight
    const top = Math.min((excess * y) / 100, maxTop)
    return `${x}% ${Math.round((top / excess) * 1000) / 10}%`
}
