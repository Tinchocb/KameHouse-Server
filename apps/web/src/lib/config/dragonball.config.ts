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
            image: "https://image.tmdb.org/t/p/w1280/t5GfQ7i2y00a8nOr3uQ1jHoklW0.jpg" // Random DBZ backdrop placeholder
        },
        {
            id: "freezer",
            title: "Saga Freezer",
            description: "Gohan, Krilin y Bulma viajan al planeta Namek para reunir las Esferas del Dragón originales y revivir a sus amigos, pero se topan con el tirano galáctico Freezer.",
            startEp: 36,
            endEp: 107,
            image: "https://image.tmdb.org/t/p/w1280/z0JExPq9eN5EaGZ2Z2p7fD3jQ49.jpg"
        },
        {
            id: "garlic-jr",
            title: "Saga Garlic Jr.",
            description: "Aprovechando la ausencia de Goku, Garlic Jr. escapa de la Zona Muerta con intención de esclavizar a la humanidad.",
            startEp: 108,
            endEp: 117,
            image: "https://image.tmdb.org/t/p/w1280/i7eGEZ4nCqA8tD1tXN8YpA8rWlV.jpg"
        },
        {
            id: "cell",
            title: "Saga Androides y Cell",
            description: "Un misterioso joven del futuro advierte sobre la llegada de unos androides asesinos creados por la Patrulla Roja y la aparición accidental de la bio-arma perfecta: Cell.",
            startEp: 118,
            endEp: 194,
            image: "https://image.tmdb.org/t/p/w1280/u6O2qJcOqS7Z9EaCgB4D4fC9R9.jpg"
        },
        {
            id: "torneo-otro-mundo",
            title: "Saga Torneo del Otro Mundo",
            description: "Goku participa en un torneo celestial con los guerreros más fuertes del universo bajo la tutela del Gran Kaio.",
            startEp: 195,
            endEp: 199,
            image: "https://image.tmdb.org/t/p/w1280/yvMwvUExmD8k4H2BqN6Q4oX0C8V.jpg"
        },
        {
            id: "majin-buu",
            title: "Saga Majin Buu",
            description: "Siete años después del juego de Cell, el malvado mago Babidi busca despertar al monstruo más temible que jamás haya existido en el universo: Majin Buu.",
            startEp: 200,
            endEp: 291,
            image: "https://image.tmdb.org/t/p/w1280/qJ6d4d1WvF8R1KqD9pQzZ7n8R2F.jpg"
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
            description: "Goku y Bulma se conocen y emprenden un viaje para buscar las legendarias Esferas del Dragón.",
            startEp: 1,
            endEp: 13,
            image: "https://image.tmdb.org/t/p/w1280/q8G4D7Q1K5T2A3nB1R9P9Z2X6E.jpg"
        },
        {
            id: "torneo-21",
            title: "Saga 21° Torneo de las Artes Marciales",
            description: "Bajo la tutela del Maestro Roshi, Goku y Krilin entrenan para probar su fuerza en el campeonato mundial.",
            startEp: 14,
            endEp: 28,
            image: "https://image.tmdb.org/t/p/w1280/t5GfQ7i2y00a8nOr3uQ1jHoklW0.jpg" // Use meaningful placeholders if desired
        },
        {
            id: "red-ribbon",
            title: "Saga de la Patrulla Roja",
            description: "Goku busca la esfera de cuatro estrellas de su difunto abuelo, colisionando con el temible ejército de la Patrulla Roja.",
            startEp: 29,
            endEp: 68,
            image: "https://image.tmdb.org/t/p/w1280/lG7p7R2E3T3a0Ym3F4r2nQ1nZ0X.jpg"
        },
        {
            id: "uranai-baba",
            title: "Saga de Uranai Baba",
            description: "Para localizar la última esfera invisible en los radares, Goku debe competir en los desafíos de la vidente Uranai Baba.",
            startEp: 69,
            endEp: 82,
            image: "https://image.tmdb.org/t/p/w1280/qJ6d4d1WvF8R1KqD9pQzZ7n8R2F.jpg"
        },
        {
            id: "torneo-22",
            title: "Saga 22° Torneo de las Artes Marciales",
            description: "Una rivalidad se enciende cuando los discípulos de la Escuela Grulla irrumpen en el campeonato para derrotar a la Escuela Tortuga.",
            startEp: 83,
            endEp: 101,
            image: "https://image.tmdb.org/t/p/w1280/z0JExPq9eN5EaGZ2Z2p7fD3jQ49.jpg"
        },
        {
            id: "piccolo",
            title: "Saga del Rey Demonio Piccolo",
            description: "El demonio Piccolo Daimaku ha sido liberado tras siglos de encierro y busca sembrar el terror absoluto en la Tierra.",
            startEp: 102,
            endEp: 122,
            image: "https://image.tmdb.org/t/p/w1280/i7eGEZ4nCqA8tD1tXN8YpA8rWlV.jpg"
        },
        {
            id: "piccolo-jr",
            title: "Saga de Piccolo Jr.",
            description: "Años después, Goku regresa adulto al torneo mundial para enfrentarse al vástago vengativo del Rey Demonio Piccolo.",
            startEp: 123,
            endEp: 153,
            image: "https://image.tmdb.org/t/p/w1280/u6O2qJcOqS7Z9EaCgB4D4fC9R9.jpg"
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
            image: "https://image.tmdb.org/t/p/w1280/qJ6d4d1WvF8R1KqD9pQzZ7n8R2F.jpg"
        },
        {
            id: "shadow-dragons",
            title: "Saga de los Dragones Malignos",
            description: "El abuso en el uso de las Esferas del Dragón provoca su corrupción, naciendo 7 temibles dragones con el poder de obliterar el universo.",
            startEp: 48,
            endEp: 64,
            image: "https://image.tmdb.org/t/p/w1280/z0JExPq9eN5EaGZ2Z2p7fD3jQ49.jpg"
        }
    ]
}
