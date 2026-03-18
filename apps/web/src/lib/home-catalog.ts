/**
 * home-catalog.ts
 * ─────────────────────────────────────────────────────
 * Typed mock catalog for the KameHouse Home screen.
 * Organized into named rows / categories ready for the
 * Netflix-style horizontal sliders.
 */

// ─── Core Types ───────────────────────────────────────

/** Visual style hint for the card renderer */
export type CardAspect = "poster" | "wide"

export interface CatalogItem {
    id: string
    title: string
    /** Absolute URL to artwork */
    artwork: string
    /** Optional short label shown in orange below the title */
    badge?: string
    /** Sub-title text (year, studio, etc.) */
    subtitle?: string
    /** Brief synopsis / description */
    description?: string
    /** Where to navigate when clicking the card */
    href: string
    /** Card aspect ratio hint */
    aspect: CardAspect
}

export interface CatalogRow {
    id: string
    /** Section heading displayed above the row */
    label: string
    items: CatalogItem[]
}

// ─── Artwork helpers (TVDB / TMDB public CDN) ─────────

const TVDB = "https://artworks.thetvdb.com/banners"
const TMDB = "https://image.tmdb.org/t/p/w500"

// ─── Rows ─────────────────────────────────────────────

export const homeCatalog: CatalogRow[] = [
    // ────────────────────────────────────────────────
    // 1. Series Principales
    // ────────────────────────────────────────────────
    {
        id: "series-principales",
        label: "Series Principales",
        items: [
            {
                id: "db",
                title: "Dragon Ball",
                artwork: `${TVDB}/posters/76666-3.jpg`,
                badge: "153 ep",
                subtitle: "1986",
                description:
                    "Goku y Bulma buscan las siete Esferas del Dragón en una aventura llena de acción y humor.",
                href: "/series/db",
                aspect: "poster",
            },
            {
                id: "dbz",
                title: "Dragon Ball Z",
                artwork: `${TVDB}/posters/81472-1.jpg`,
                badge: "291 ep",
                subtitle: "1989",
                description:
                    "Goku descubre sus raíces Saiyajin y defiende la Tierra de amenazas cósmicas.",
                href: "/series/dbz",
                aspect: "poster",
            },
            {
                id: "dbgt",
                title: "Dragon Ball GT",
                artwork: `${TVDB}/posters/73111-1.jpg`,
                badge: "64 ep",
                subtitle: "1996",
                description:
                    "Goku es convertido en niño y debe viajar por el universo para recuperar las Esferas.",
                href: "/series/dbgt",
                aspect: "poster",
            },
            {
                id: "dbs",
                title: "Dragon Ball Super",
                artwork: `${TVDB}/posters/295068-1.jpg`,
                badge: "131 ep",
                subtitle: "2015",
                description:
                    "Tras la derrota de Majin Buu, Goku se enfrenta a Dioses de la Destrucción y el Torneo del Poder.",
                href: "/series/dbs",
                aspect: "poster",
            },
        ],
    },
]
