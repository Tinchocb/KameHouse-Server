export const DRAGON_BALL_SERIES = {
    ORIGINAL: 862,
    Z: 12971,
    GT: 888,
    KAI: 61709,
    SUPER: 62715,
    DAIMA: 240411,
    HEROES: 80629,
}

export type SagaDefinition = {
    id: string
    title: string
    description: string
    startEp: number
    endEp: number
    image: string
}

export const DRAGON_BALL_SAGAS: Record<number, SagaDefinition[]> = {
    [DRAGON_BALL_SERIES.Z]: [
        {
            id: "saiyajin",
            title: "Saga Saiyajin",
            description: "La llegada de Raditz revela el verdadero origen extraterrestre de Goku. Los guerreros Z deben prepararse para la invasión de dos Saiyajins increíblemente poderosos: Nappa y Vegeta.",
            startEp: 1,
            endEp: 35,
            image: "https://image.tmdb.org/t/p/w1280/ydf1CeiBLfdxiyNTpskM0802TKl.jpg"
        },
        {
            id: "freezer",
            title: "Saga Freezer",
            description: "Gohan, Krilin y Bulma viajan al planeta Namek para reunir las Esferas del Dragón originales y revivir a sus amigos, pero se topan con el tirano galáctico Freezer.",
            startEp: 36,
            endEp: 107,
            image: "https://image.tmdb.org/t/p/w1280/v7J7q0yMAPbocBgiv39hpAMEcRf.jpg"
        },
        {
            id: "garlic-jr",
            title: "Saga Garlic Jr.",
            description: "Aprovechando la ausencia de Goku, Garlic Jr. escapa de la Zona Muerta con intención de esclavizar a la humanidad.",
            startEp: 108,
            endEp: 117,
            image: "https://image.tmdb.org/t/p/w1280/aTdLJW3qIE3brKshSOkYykdoDmd.jpg"
        },
        {
            id: "cell",
            title: "Saga Androides y Cell",
            description: "Un misterioso joven del futuro advierte sobre la llegada de unos androides asesinos creados por la Patrulla Roja y la aparición accidental de la bio-arma perfecta: Cell.",
            startEp: 118,
            endEp: 194,
            image: "https://image.tmdb.org/t/p/w1280/zOz6DeXeOhKRVGUuiK3WufLXQIB.jpg"
        },
        {
            id: "torneo-otro-mundo",
            title: "Saga Torneo del Otro Mundo",
            description: "Goku participa en un torneo celestial con los guerreros más fuertes del universo bajo la tutela del Gran Kaio.",
            startEp: 195,
            endEp: 199,
            image: "https://image.tmdb.org/t/p/w1280/4pBjYo4lJXOSEneevIlbTJSdqyt.jpg"
        },
        {
            id: "majin-buu",
            title: "Saga Majin Buu",
            description: "Siete años después del juego de Cell, el malvado mago Babidi busca despertar al monstruo más temible que jamás haya existido en el universo: Majin Buu.",
            startEp: 200,
            endEp: 291,
            image: "https://image.tmdb.org/t/p/w1280/aGEPZs4UYGULNdCmaMU05LNCO6W.jpg"
        }
    ],
    [DRAGON_BALL_SERIES.SUPER]: [
        {
            id: "dioses",
            title: "La Batalla de los Dioses",
            description: "El Dios de la Destrucción Bills despierta tras décadas de sueño buscando al Super Saiyajin Dios de una antigua profecía.",
            startEp: 1,
            endEp: 14,
            image: "https://image.tmdb.org/t/p/w1280/lIf71qU1T8rQ2Xn4M7Y5xM8A5R4.jpg"
        },
        {
            id: "resurreccion",
            title: "La Resurrección de 'F'",
            description: "Restos del ejército de Freezer logran reunir las Esferas del Dragón y revivir a su amo, quien entrenará para vengarse de Goku.",
            startEp: 15,
            endEp: 27,
            image: "https://image.tmdb.org/t/p/w1280/lG7p7R2E3T3a0Ym3F4r2nQ1nZ0X.jpg"
        },
        {
            id: "champa",
            title: "Torneo del Universo 6",
            description: "Un torneo de artes marciales amistoso entre el Universo 6 de Champa y el Universo 7 de Bills por el control de las Súper Esferas del Dragón.",
            startEp: 28,
            endEp: 46,
            image: "https://image.tmdb.org/t/p/w1280/m9D4W1O8A2S7rU2vB3T4Q1P2R5V.jpg"
        },
        {
            id: "goku-black",
            title: "Saga de Goku Black",
            description: "Trunks del futuro regresa al presente pidiendo ayuda tras la devastación de su línea temporal a manos de un misterioso enemigo con el rostro de Goku.",
            startEp: 47,
            endEp: 76,
            image: "https://image.tmdb.org/t/p/w1280/xG0L5Y2w9P8uX2A6Z1rT4N1D0X1.jpg"
        },
        {
            id: "supervivencia",
            title: "Saga Supervivencia Universal",
            description: "Zeno-Sama organiza el Torneo del Poder donde 8 universos batallarán. El universo perdedor será aniquilado inmediatamente.",
            startEp: 77,
            endEp: 131,
            image: "https://image.tmdb.org/t/p/w1280/o9A5w6L3V7H8Q4U2B5N6Q1P3O9I.jpg"
        }
    ],
    [DRAGON_BALL_SERIES.ORIGINAL]: [
        {
            id: "pilaf",
            title: "Saga del Emperador Pilaf",
            description: "El joven Goku conoce a Bulma durante su búsqueda de las Esferas del Dragón. Juntos se enfrentan al ridículo pero ambicioso Emperador Pilaf, quien desea dominar el mundo con el poder del Dragón Shenlong.",
            startEp: 1,
            endEp: 13,
            image: "https://image.tmdb.org/t/p/w1280/ydf1CeiBLfdxiyNTpskM0802TKl.jpg"
        },
        {
            id: "torneo-21",
            title: "Saga 21° Torneo de las Artes Marciales",
            description: "Bajo la tutela del legendario Maestro Roshi, Goku y Krilin se preparan para el campeonato mundial de artes marciales. El torneo revela que existen guerreros mucho más poderosos en el mundo.",
            startEp: 14,
            endEp: 28,
            image: "https://image.tmdb.org/t/p/w1280/5UMSGqZ1EvHb2UBHQeM4mGRf3k5.jpg"
        },
        {
            id: "red-ribbon",
            title: "Saga de la Patrulla Roja",
            description: "Goku inicia la búsqueda de la esfera de 4 estrellas de su abuelo Gohan. En su camino se topa con el ejército de la Patrulla Roja, una organización criminal con tecnología avanzada que también busca las esferas para dominar el mundo.",
            startEp: 29,
            endEp: 68,
            image: "https://image.tmdb.org/t/p/w1280/kFDi8xAQAMXsBPdpAEUUCLNnSln.jpg"
        },
        {
            id: "uranai-baba",
            title: "Saga de Uranai Baba",
            description: "Goku acude a la vidente Uranai Baba para localizar la última esfera del dragón. A cambio, debe enfrentarse a cinco poderosos guerreros en retos únicos. El torneo trae una sorpresa emotiva: el reencuentro con el abuelo Gohan.",
            startEp: 69,
            endEp: 82,
            image: "https://image.tmdb.org/t/p/w1280/1jRGn6yjlCSuv7Cay77bLkwL4ck.jpg"
        },
        {
            id: "torneo-22",
            title: "Saga 22° Torneo de las Artes Marciales",
            description: "Han pasado 3 años desde el último torneo. Goku regresa transformado en un joven fuerte y habilidoso. Los peligrosos discípulos de la Escuela Grulla, Tenshinhan y Chaotzu, vienen a destruir la Escuela Tortuga.",
            startEp: 83,
            endEp: 101,
            image: "https://image.tmdb.org/t/p/w1280/aL8VlVnbCIR5M3khWtNFbP7BGDG.jpg"
        },
        {
            id: "piccolo",
            title: "Saga del Rey Demonio Piccolo",
            description: "El demonio Piccolo Daimaku, sellado durante siglos, es liberado accidentalmente. Con un poder inimaginable y una sed infinita de destrucción, el Rey Demonio busca recuperar su juventud y esclavizar a la humanidad.",
            startEp: 102,
            endEp: 122,
            image: "https://image.tmdb.org/t/p/w1280/8fwkd12QBGL9tqNfJolEFmCKHzp.jpg"
        },
        {
            id: "piccolo-jr",
            title: "Saga de Piccolo Jr.",
            description: "Han pasado 3 años desde la derrota del Rey Demonio. En el 23° Torneo Mundial de Artes Marciales, Goku se enfrenta a Piccolo Jr., el hijo del demonio, quien ha heredado todo el odio y el poder de su padre para vengarse.",
            startEp: 123,
            endEp: 153,
            image: "https://image.tmdb.org/t/p/w1280/7PJHUoSoHGBQdFf5wy2lJzlCzuC.jpg"
        }
    ],
    [DRAGON_BALL_SERIES.GT]: [
        {
            id: "black-star",
            title: "Saga de las Esferas Definitivas",
            description: "Un deseo accidental convierte a Goku en niño y esparce las Esferas del Dragón Negras por toda la galaxia amenazando con destruir la Tierra.",
            startEp: 1,
            endEp: 16,
            image: "https://image.tmdb.org/t/p/w1280/q8G4D7Q1K5T2A3nB1R9P9Z2X6E.jpg"
        },
        {
            id: "baby",
            title: "Saga de Baby",
            description: "Un parásito mutante artificial creado por la raza Tsufuru busca infectar y esclavizar a todo el universo clamando venganza contra los Saiyajins.",
            startEp: 17,
            endEp: 40,
            image: "https://image.tmdb.org/t/p/w1280/lG7p7R2E3T3a0Ym3F4r2nQ1nZ0X.jpg"
        },
        {
            id: "super-17",
            title: "Saga de Super 17",
            description: "Dos genios malvados abren un portal del infierno para fusionar a dos Androides 17 y crear a una máquina casi invencible.",
            startEp: 41,
            endEp: 47,
            image: "https://image.tmdb.org/t/p/w1280/aGEPZs4UYGULNdCmaMU05LNCO6W.jpg"
        },
        {
            id: "shadow-dragons",
            title: "Saga de los Dragones Malignos",
            description: "El abuso en el uso de las Esferas del Dragón provoca su corrupción, naciendo 7 temibles dragones con el poder de obliterar el universo.",
            startEp: 48,
            endEp: 64,
            image: "https://image.tmdb.org/t/p/w1280/v7J7q0yMAPbocBgiv39hpAMEcRf.jpg"
        }
    ],
    [DRAGON_BALL_SERIES.KAI]: [
        {
            id: "kai-saiyajin",
            title: "Saga Saiyajin (Kai)",
            description: "La versión remasterizada de la saga Saiyajin. Raditz llega a la Tierra revelando el origen de Goku, desencadenando una cadena de eventos que llevará a los guerreros Z a enfrentarse a Vegeta y Nappa.",
            startEp: 1,
            endEp: 35,
            image: "https://image.tmdb.org/t/p/w1280/ydf1CeiBLfdxiyNTpskM0802TKl.jpg"
        },
        {
            id: "kai-freezer",
            title: "Saga Freezer (Kai)",
            description: "La batalla en el planeta Namek remasterizada. Los guerreros Z se enfrentan al tirano Freezer en una lucha épica que despertará el poder del legendario Super Saiyajin.",
            startEp: 36,
            endEp: 54,
            image: "https://image.tmdb.org/t/p/w1280/v7J7q0yMAPbocBgiv39hpAMEcRf.jpg"
        },
        {
            id: "kai-cell",
            title: "Saga Androides y Cell (Kai)",
            description: "Los androides de la Patrulla Roja y la amenaza de Cell en versión remasterizada sin relleno. Gohan alcanzará un poder que superará a su padre.",
            startEp: 55,
            endEp: 98,
            image: "https://image.tmdb.org/t/p/w1280/zOz6DeXeOhKRVGUuiK3WufLXQIB.jpg"
        },
        {
            id: "kai-buu",
            title: "Saga Majin Buu (Kai)",
            description: "La saga final de Kai: el mago Babidi despierta al temible Majin Buu. Los guerreros Z deberán unir fuerzas con antiguos enemigos para salvar el universo.",
            startEp: 99,
            endEp: 167,
            image: "https://image.tmdb.org/t/p/w1280/aGEPZs4UYGULNdCmaMU05LNCO6W.jpg"
        }
    ],
    [DRAGON_BALL_SERIES.DAIMA]: [
        {
            id: "daima-misterio",
            title: "El Misterio del Mundo Demonio",
            description: "Goku y sus amigos son convertidos en niños por una conspiración del Mundo Demonio. Deben viajar a una dimensión desconocida para revertir el hechizo y descubrir la verdad detrás de las Esferas del Dragón.",
            startEp: 1,
            endEp: 10,
            image: "https://image.tmdb.org/t/p/w1280/lG7p7R2E3T3a0Ym3F4r2nQ1nZ0X.jpg"
        },
        {
            id: "daima-travesia",
            title: "La Travesía en el Mundo Demonio",
            description: "La aventura continúa en las profundidades del Mundo Demonio. Goku y compañía enfrentan nuevos enemigos mientras buscan las Esferas del Dragón demoniacas para restaurar sus cuerpos.",
            startEp: 11,
            endEp: 20,
            image: "https://image.tmdb.org/t/p/w1280/aTdLJW3qIE3brKshSOkYykdoDmd.jpg"
        }
    ]
}

// ─── Resolución de Sagas ─────────────────────────────────────────────────────

interface MediaForSagaResolution {
    tmdbId?: number | null
    titleRomaji?: string | null
    titleEnglish?: string | null
    titleOriginal?: string | null
    format?: string | null
}

/**
 * Resolves which Dragon Ball saga definitions apply to a given media entry.
 * Priority: TMDB ID → title substring matching → fallback to Original DB.
 * Returns empty array for movies and non-Dragon Ball series.
 */
export function resolveSeriesSagas(media: MediaForSagaResolution | null | undefined): SagaDefinition[] {
    if (!media) return []

    const tmdbId = media.tmdbId || 0

    // 1. Try exact match by TMDB ID
    if (tmdbId && DRAGON_BALL_SAGAS[tmdbId]) {
        return DRAGON_BALL_SAGAS[tmdbId]
    }

    // 2. Fallback: match by title substring
    const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || ""
    const searchTitle = title.toLowerCase().replace(/\s+/g, "")

    let resolved: SagaDefinition[] = []

    if (searchTitle.includes("dragonballz") || searchTitle === "dbz") {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.Z]
    } else if (searchTitle.includes("dragonballgt")) {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.GT]
    } else if (searchTitle.includes("dragonballsuper")) {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.SUPER]
    } else if (searchTitle.includes("dragonballkai")) {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.KAI]
    } else if (searchTitle.includes("dragonballdaima")) {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.DAIMA]
    } else if (searchTitle === "dragonball") {
        resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.ORIGINAL]
    }

    // 3. Final safety net: if it contains "dragonball" but no specific suffix,
    //    and it isn't a movie, default to Original DB.
    if ((!resolved || resolved.length === 0) && searchTitle.includes("dragonball")) {
        const isMovie = media.format === "MOVIE"
            || searchTitle.includes("movie")
            || searchTitle.includes("pelicula")
            || searchTitle.includes("aventura")
        if (!isMovie) {
            resolved = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.ORIGINAL]
        }
    }

    return resolved || []
}
