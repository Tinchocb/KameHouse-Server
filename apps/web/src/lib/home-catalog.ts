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
            {
                id: "dbsuper-heroes",
                title: "Dragon Ball Super: Super Hero",
                artwork: `${TMDB}/qEFjCrK1SLLaXcL3cFKZMhH6Bna.jpg`,
                badge: "Película 2022",
                subtitle: "2022 • Toei Animation",
                description:
                    "Gohan y Piccolo se enfrentan a la nueva Red Ribbon Army y sus androides definitivos.",
                href: "/series/dbz",
                aspect: "poster",
            },
        ],
    },

    // ────────────────────────────────────────────────
    // 2. Películas Clásicas
    // ────────────────────────────────────────────────
    {
        id: "peliculas-clasicas",
        label: "Películas Clásicas",
        items: [
            {
                id: "movie-bardock",
                title: "Bardock: El Padre de Goku",
                artwork: `${TMDB}/6l2GHCaBiHxbfLwqc06HNLBT5B4.jpg`,
                badge: "TV Special 1990",
                subtitle: "1990 • 48 min",
                description:
                    "La trágica historia del guerrero que desafió al tirano Freezer para salvar a su pueblo.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "movie-history-trunks",
                title: "La Historia de Trunks",
                artwork: `${TMDB}/8mzBBrSo7zf7v4X57jtlOCdKNUf.jpg`,
                badge: "TV Special 1993",
                subtitle: "1993 • 47 min",
                description:
                    "En un futuro apocalíptico, Gohan y Trunks adolescente luchan contra Androides invencibles.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "movie-fusion",
                title: "La Fusión de Goku y Vegeta",
                artwork: `${TMDB}/eDtsTGLPFCuFYj3l45h4tkVMFZm.jpg`,
                badge: "Película 12",
                subtitle: "1995 • 78 min",
                description:
                    "Janenba distorsiona la realidad entre el mundo de los vivos y muertos. Goku y Vegeta deben fusionarse.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "movie-broly",
                title: "Broly: El Guerrero Legendario",
                artwork: `${TMDB}/lRrPmRD1D06rFCv1HVMO9OP1O29.jpg`,
                badge: "Película 8",
                subtitle: "1993 • 73 min",
                description:
                    "Broly, el Súper Saiyajin Legendario de poder incontrolable, amenaza con destruirlo todo.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "movie-cooler",
                title: "El Regreso de Cooler",
                artwork: `${TMDB}/qMaIXMFQhVqpxfCeRFR0bK1PBOk.jpg`,
                badge: "Película 6",
                subtitle: "1992 • 48 min",
                description:
                    "El hermano de Freezer regresa convertido en un ser mecánico y toma control del Planeta Namek.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "movie-wrath-of-dragon",
                title: "El Camino hacia el Poder",
                artwork: `${TMDB}/7FEjI7LWNUiJr3dPf8bFYsLLhNh.jpg`,
                badge: "Película 13",
                subtitle: "1996 • 60 min",
                description:
                    "Goku y los Z Warriors enfrentan a Hirudegarn, un monstruo que fue sellado hace siglos.",
                href: "/series/dbz",
                aspect: "wide",
            },
        ],
    },

    // ────────────────────────────────────────────────
    // 3. Sagas de Dragon Ball Super
    // ────────────────────────────────────────────────
    {
        id: "dbs-sagas",
        label: "Dragon Ball Super – Arcos Narrativos",
        items: [
            {
                id: "dbs-beerus",
                title: "Saga del Dios de la Destrucción",
                artwork: `${TMDB}/4CkrRwGNGXQ7s9MJAqrMrygNxPd.jpg`,
                badge: "Arco 1 • ep 1-14",
                subtitle: "Beerus y Whis",
                description:
                    "El Dios de la Destrucción Beerus llega a la Tierra buscando al Super Saiyajin Dios de su sueño.",
                href: "/series/dbs",
                aspect: "poster",
            },
            {
                id: "dbs-goldenfriezra",
                title: "Saga de la Resurrección de F",
                artwork: `${TMDB}/Ao5M9Oi0UWFGjwSdEbFRtjCp0VE.jpg`,
                badge: "Arco 2 • ep 15-27",
                subtitle: "Freezer Golden",
                description:
                    "Freezer regresa después de ser entrenado en el inframundo con una transformación nunca vista.",
                href: "/series/dbs",
                aspect: "poster",
            },
            {
                id: "dbs-universe6",
                title: "Saga del Universo 6",
                artwork: `${TVDB}/seasons/295068-3.jpg`,
                badge: "Arco 3 • ep 28-46",
                subtitle: "Torneo vs Champa",
                description:
                    "Los Dioses de la Destrucción Beerus y Champa organizan un torneo entre el Universo 6 y 7.",
                href: "/series/dbs",
                aspect: "poster",
            },
            {
                id: "dbs-zamasu",
                title: "Saga de Goku Black",
                artwork: `${TVDB}/seasons/295068-4.jpg`,
                badge: "Arco 4 • ep 47-76",
                subtitle: "Zamasu / Goku Black",
                description:
                    "Un misterioso guerrero con la apariencia de Goku siembra el caos en un futuro distópico.",
                href: "/series/dbs",
                aspect: "poster",
            },
            {
                id: "dbs-top",
                title: "Torneo del Poder",
                artwork: `${TVDB}/seasons/295068-5.jpg`,
                badge: "Arco 5 • ep 77-131",
                subtitle: "Ultra Instinto",
                description:
                    "Ocho universos compiten en el Torneo del Poder. El perdedor será aniquilado por el Gran Sacerdote.",
                href: "/series/dbs",
                aspect: "poster",
            },
        ],
    },

    // ────────────────────────────────────────────────
    // 4. Especiales de TV
    // ────────────────────────────────────────────────
    {
        id: "especiales-tv",
        label: "Especiales de TV",
        items: [
            {
                id: "esp-episode-of-bardock",
                title: "Episode of Bardock",
                artwork: `${TMDB}/pGFqVDrHhbTWHBVN1nGTv4e7ggT.jpg`,
                badge: "OVA 2011",
                subtitle: "2011 • 20 min",
                description:
                    "Bardock viaja al pasado de Namek y se convierte en el primer Super Saiyajin de la historia.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "esp-dbz-kai",
                title: "Dragon Ball Z Kai",
                artwork: `${TMDB}/rcmhBJBHBzRTz3zVNNXDnkYJVhf.jpg`,
                badge: "Remasterizado",
                subtitle: "2009 • 159 ep",
                description:
                    "La versión remasterizada y editada de DBZ, más fiel al manga, sin relleno y con audio mejorado.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "esp-plan-eradicate",
                title: "Plan para Erradicar a los Super Saiyajin",
                artwork: `${TMDB}/jRxdFEAcDQhlSLDGtKNqGmJMXmR.jpg`,
                badge: "OVA 1993",
                subtitle: "1993 • 50 min",
                description:
                    "El Doctor Raichi usa el Destron Gas para eliminar a todos los Saiyajin vivos de la Tierra.",
                href: "/series/dbz",
                aspect: "wide",
            },
            {
                id: "esp-yo-son-goku",
                title: "¡Yo Soy Son Goku!",
                artwork: `${TMDB}/bcl2RfGnbO7yiX93GOuKF0rrWBY.jpg`,
                badge: "Especial 1992",
                subtitle: "1992 • 20 min",
                description:
                    "Goku toma control del relato y presenta al elenco de Dragon Ball Z de forma interactiva.",
                href: "/series/dbz",
                aspect: "wide",
            },
        ],
    },

    // ────────────────────────────────────────────────
    // 5. Sagas Clásicas de DBZ
    // ────────────────────────────────────────────────
    {
        id: "dbz-sagas",
        label: "Dragon Ball Z – Sagas Épicas",
        items: [
            {
                id: "dbz-saiyan",
                title: "Saga de los Saiyajin",
                artwork: `${TVDB}/seasons/81472-1.jpg`,
                badge: "ep 1-35",
                subtitle: "Raditz • Nappa • Vegeta",
                description:
                    "La llegada de los guerreros del espacio revela el verdadero origen de Goku.",
                href: "/series/dbz",
                aspect: "poster",
            },
            {
                id: "dbz-namek",
                title: "Saga de Namek",
                artwork: `${TVDB}/seasons/81472-2.jpg`,
                badge: "ep 36-67",
                subtitle: "Zarbon • Ginyu • Freezer",
                description:
                    "El viaje al planeta Namek en busca de las Esferas del Dragón y el enfrentamiento con Freezer.",
                href: "/series/dbz",
                aspect: "poster",
            },
            {
                id: "dbz-freezer",
                title: "Saga de Freezer",
                artwork: `${TVDB}/seasons/81472-2.jpg`,
                badge: "ep 68-107",
                subtitle: "El Súper Saiyajin Legendario",
                description:
                    "El clímax de Namek: Goku despierta la transformación legendaria del Súper Saiyajin.",
                href: "/series/dbz",
                aspect: "poster",
            },
            {
                id: "dbz-androids",
                title: "Saga de los Androides",
                artwork: `${TVDB}/seasons/81472-3.jpg`,
                badge: "ep 119-179",
                subtitle: "Cell • C-17 • C-18",
                description:
                    "Los androides del Dr. Gero amenazan la Tierra mientras Cell absorbe seres vivos para crecer.",
                href: "/series/dbz",
                aspect: "poster",
            },
            {
                id: "dbz-majinbuu",
                title: "Saga de Majin Buu",
                artwork: `${TVDB}/seasons/81472-4.jpg`,
                badge: "ep 220-291",
                subtitle: "SSJ3 • Vegito • Kid Buu",
                description:
                    "El ser más poderoso y caótico del universo despierta. Goku y Vegeta deben detenerlo.",
                href: "/series/dbz",
                aspect: "poster",
            },
        ],
    },
]
