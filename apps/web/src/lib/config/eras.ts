// Definition of the 6 canonical Dragon Ball eras in chronological order
export const ERAS = [
    { id: "db", title: "Dragon Ball", shortTitle: "DB Original", subtitle: "Dragon Ball (Original)", year: 1986, tag: "Original", kanji: "亀", tagline: "La Gran Aventura Comienza", defaultSaga: "pilaf" },
    { id: "dbz", title: "Dragon Ball Z", shortTitle: "Dragon Ball Z", subtitle: "Dragon Ball Z", year: 1989, tag: "Z", kanji: "悟", tagline: "La Leyenda de los Guerreros Z", defaultSaga: "saiyajin" },
    { id: "dbgt", title: "Dragon Ball GT", shortTitle: "Dragon Ball GT", subtitle: "Dragon Ball GT", year: 1996, tag: "GT", kanji: "星", tagline: "El Gran Viaje por el Cosmos", defaultSaga: "black-star" },
    { id: "dbkai", title: "Dragon Ball Kai", shortTitle: "DB Kai", subtitle: "Dragon Ball Z Kai", year: 2009, tag: "Kai", kanji: "改", tagline: "Remasterizado Sin Relleno", defaultSaga: "saiyajin" },
    { id: "dbs", title: "Dragon Ball Super", shortTitle: "DB Super", subtitle: "Dragon Ball Super", year: 2015, tag: "Super", kanji: "超", tagline: "El Despertar de los Dioses", defaultSaga: "batalla-dioses" },
    { id: "dbdaima", title: "Dragon Ball Daima", shortTitle: "DB Daima", subtitle: "Dragon Ball Daima", year: 2024, tag: "Daima", kanji: "魔", tagline: "El Misterio del Reino Demoníaco", defaultSaga: "daima" },
] as const

export type EraId = typeof ERAS[number]["id"]

// Theme colors and glows for each era. Los colores viven en tokens --spotlight-*-vivid (colors.css)
export const ERA_COLOR_MAP: Record<EraId, { accent: string; glow: string; glowStrong: string; textBrand: string; ambientGlow1: string; ambientGlow2: string }> = {
    db: {
        accent: "var(--spotlight-db-vivid)",
        glow: "var(--spotlight-glow-db)",
        glowStrong: "var(--spotlight-border-db)",
        textBrand: "text-[var(--spotlight-db-vivid)]",
        ambientGlow1: "var(--spotlight-db-vivid)",
        ambientGlow2: "var(--spotlight-db-vivid-2)"
    },
    dbz: {
        accent: "var(--spotlight-dbz-vivid)",
        glow: "var(--spotlight-glow-dbz)",
        glowStrong: "var(--spotlight-border-dbz)",
        textBrand: "text-[var(--spotlight-dbz-vivid)]",
        ambientGlow1: "var(--spotlight-dbz-vivid)",
        ambientGlow2: "var(--spotlight-dbz-vivid-2)"
    },
    dbgt: {
        accent: "var(--spotlight-dbgt-vivid)",
        glow: "var(--spotlight-glow-dbgt)",
        glowStrong: "var(--spotlight-border-dbgt)",
        textBrand: "text-[var(--spotlight-dbgt-vivid)]",
        ambientGlow1: "var(--spotlight-dbgt-vivid)",
        ambientGlow2: "var(--spotlight-dbgt-vivid-2)"
    },
    dbkai: {
        accent: "var(--spotlight-dbkai-vivid)",
        glow: "var(--spotlight-glow-dbkai)",
        glowStrong: "var(--spotlight-border-dbkai)",
        textBrand: "text-[var(--spotlight-dbkai-vivid)]",
        ambientGlow1: "var(--spotlight-dbkai-vivid)",
        ambientGlow2: "var(--spotlight-dbkai-vivid-2)"
    },
    dbs: {
        accent: "var(--spotlight-dbs-vivid)",
        glow: "var(--spotlight-glow-dbs)",
        glowStrong: "var(--spotlight-border-dbs)",
        textBrand: "text-[var(--spotlight-dbs-vivid)]",
        ambientGlow1: "var(--spotlight-dbs-vivid)",
        ambientGlow2: "var(--spotlight-dbs-vivid-2)"
    },
    dbdaima: {
        accent: "var(--spotlight-daima-vivid)",
        glow: "var(--spotlight-glow-daima)",
        glowStrong: "var(--spotlight-border-daima)",
        textBrand: "text-[var(--spotlight-daima-vivid)]",
        ambientGlow1: "var(--spotlight-daima-vivid)",
        ambientGlow2: "var(--spotlight-daima-vivid-2)"
    }
}

export interface EraDefaultInfo {
    title: string
    subtitle: string
    description: string
    backdropUrl: string
    posterUrl: string
    year: number
    episodes: string
}

export const ERA_DEFAULTS: Record<EraId, EraDefaultInfo> = {
    db: {
        title: "Dragon Ball",
        subtitle: "Dragon Ball (Original)",
        description: "Goku, un niño con cola de mono y una fuerza sobrehumana, conoce a Bulma y emprende un viaje legendario en busca de las siete Esferas del Dragón, entrenando con el Maestro Roshi y enfrentando villanos en torneos de artes marciales.",
        backdropUrl: "/backdrops/db.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/30L49n4Dhn7dzuGG50GV3ybMhC3.jpg",
        year: 1986,
        episodes: "153 Episodios",
    },
    dbz: {
        title: "Dragon Ball Z",
        subtitle: "Dragon Ball Z",
        description: "Cinco años después del final de Dragon Ball, Goku descubre su origen extraterrestre como guerrero Saiyajin. Junto a los Guerreros Z, defiende la Tierra y el universo de amenazas colosales como Vegeta, Freezer, Cell y Majin Buu.",
        backdropUrl: "/backdrops/dbz.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
        year: 1989,
        episodes: "291 Episodios",
    },
    dbgt: {
        title: "Dragon Ball GT",
        subtitle: "Dragon Ball GT",
        description: "Tras un deseo accidental de las Esferas de la Estrella Negra, Goku vuelve a ser niño y viaja por el cosmos junto a Trunks y Pan para salvar la Tierra, enfrentando a Baby, Super 17 y los temibles 7 Dragones Malignos con el legendario Super Saiyajin 4.",
        backdropUrl: "/backdrops/dbgt.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/aJOlYXjxb5IvnTsO4I1tmFpC7GH.jpg",
        year: 1996,
        episodes: "64 Episodios",
    },
    dbkai: {
        title: "Dragon Ball Kai",
        subtitle: "Dragon Ball Z Kai",
        description: "Versión remasterizada en alta definición de Dragon Ball Z, fiel al manga original de Akira Toriyama sin episodios de relleno, con edición dinámica y sonido renovado.",
        backdropUrl: "/backdrops/dbkai.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/oz5zbMBKCUsb7hsbjdxvK8yagPD.jpg",
        year: 2009,
        episodes: "167 Episodios",
    },
    dbs: {
        title: "Dragon Ball Super",
        subtitle: "Dragon Ball Super",
        description: "Goku y Vegeta alcanzan el reino de los dioses enfrentando al Dios de la Destrucción Beerus, al renacido Freezer Dorado, a Goku Black y compitiendo en el Torneo del Poder entre universos con el poder del Ultra Instinto.",
        backdropUrl: "/backdrops/dbs.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/qA2UwUQbj05aeBMCuC0mHSQ4loE.jpg",
        year: 2015,
        episodes: "131 Episodios",
    },
    dbdaima: {
        title: "Dragon Ball Daima",
        subtitle: "Dragon Ball Daima",
        description: "Debido a una misteriosa conspiración, Goku y sus amigos son transformados en niños pequeños. Para desentrañar el misterio y revertir la transformación, parten hacia el Reino Demoniaco en una nueva aventura llena de acción y magia.",
        backdropUrl: "/backdrops/dbdaima.webp",
        posterUrl: "https://image.tmdb.org/t/p/w500/oUmWLyeko3kYdUr8DBLIsxwcugl.jpg",
        year: 2024,
        episodes: "20 Episodios",
    },
}

export const MEDIA_ID_TO_ERA: Record<number, EraId> = {
    // Kai
    61709: "dbkai",
    1061709: "dbkai",
    42705: "dbkai",
    1042705: "dbkai",
    60572: "dbkai",
    1060572: "dbkai",
    6033: "dbkai",
    20635: "dbkai",
    // DB Original
    12609: "db",
    1033499: "db",
    1033500: "db",
    1033513: "db",
    // DB Movies
    116776: "db",
    1116776: "db",
    39145: "db",
    1039145: "db",
    39144: "db",
    1039144: "db",
    39148: "db",
    1039148: "db",
    // DBZ
    12971: "dbz",
    1015448: "dbz",
    1015449: "dbz",
    1015450: "dbz",
    1015451: "dbz",
    1015452: "dbz",
    1015453: "dbz",
    1015454: "dbz",
    1015455: "dbz",
    1015456: "dbz",
    1015457: "dbz",
    1015458: "dbz",
    1012704: "dbz",
    1015459: "dbz",
    1015460: "dbz",
    // DBZ Movies & Specials
    28609: "dbz",
    1028609: "dbz",
    39100: "dbz",
    1039100: "dbz",
    39101: "dbz",
    1039101: "dbz",
    39102: "dbz",
    1039102: "dbz",
    24752: "dbz",
    1024752: "dbz",
    39103: "dbz",
    1039103: "dbz",
    39104: "dbz",
    1039104: "dbz",
    34433: "dbz",
    1034433: "dbz",
    39105: "dbz",
    1039105: "dbz",
    44251: "dbz",
    1044251: "dbz",
    39106: "dbz",
    1039106: "dbz",
    39107: "dbz",
    1039107: "dbz",
    39108: "dbz",
    1039108: "dbz",
    126963: "dbz",
    1126963: "dbz",
    303857: "dbz",
    1303857: "dbz",
    39323: "dbz",
    1039323: "dbz",
    39324: "dbz",
    1039324: "dbz",
    38594: "dbz",
    1038594: "dbz",
    120475: "dbz",
    1120475: "dbz",
    55127: "dbz",
    1055127: "dbz",
    39321: "dbz",
    1039321: "dbz",
    39322: "dbz",
    1039322: "dbz",
    39325: "dbz",
    1039325: "dbz",
    39326: "dbz",
    1039326: "dbz",
    105973: "dbz",
    1105973: "dbz",
    444390: "dbz",
    1444390: "dbz",
    // GT
    12697: "dbgt",
    1012697: "dbgt",
    1039149: "dbgt",
    18095: "dbgt",
    1018095: "dbgt",
    // Super
    62715: "dbs",
    1062715: "dbs",
    503314: "dbs",
    1503314: "dbs",
    610150: "dbs",
    1610150: "dbs",
    // Daima
    236994: "dbdaima",
    1236994: "dbdaima",
}

export const KNOWN_MOVIE_TMDB_IDS = new Set<number>([
    // DB
    116776, 39145, 39144, 39148, 33499, 33513, 1033499, 1033500, 1033513, 1039144, 1039145, 1116776, 1039148,
    // DBZ Movies
    28609, 39100, 39101, 39102, 24752, 39103, 39104, 34433, 39105, 44251, 39106, 39107, 39108, 126963, 303857, 177572, 15448, 15452, 15454,
    1028609, 1039100, 1039101, 1039102, 1024752, 1039103, 1039104, 1034433, 1039105, 1044251, 1039106, 1039107, 1039108, 1126963, 1303857, 1177572,
    // DBZ Specials / OVAs
    39323, 39324, 39325, 39326, 105973, 444390, 38594, 120475, 55127, 39321, 39322, 1259215, 109963,
    1039323, 1039324, 1039325, 1039326, 1105973, 1444390, 1038594, 1120475, 1055127, 1039321, 1039322,
    // GT Special
    18095, 39149, 1018095, 1039149,
    // Super Movies
    503314, 610150, 1503314, 1610150,
])
