import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DRAGON_BALL_SAGAS } from './dragonball.config.ts';

// Recreate directory path since we are in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TagCategory {
    tagName: string;
    keywords: string[];
}

interface MovieDefinition {
    id: string;
    title: string;
    tmdbId: number;
    description: string;
}

const DICTIONARY: TagCategory[] = [
    {
        tagName: "Batalla Épica",
        keywords: [
            "combate", "duelo", "pelea", "venganza", "batalla", "derrotar", "lucha", "enfrentamiento", "golpiza",
            "battle", "fight", "combat", "clash", "confrontation", "defeat", "struggle", "duel", "showdown", "brawl"
        ]
    },
    {
        tagName: "Técnicas de Ki",
        keywords: [
            "kamehameha", "ki", "energía", "energia", "genkidama", "power", "masenko", "kiensan", "final flash", "galick gun",
            "energy blast", "spirit bomb", "special beam cannon", "solar flare", "dodonpa", "solar"
        ]
    },
    {
        tagName: "Técnicas Especiales",
        keywords: [
            "teletransportación", "teletransportacion", "kaioken", "mafuba", "danza", "ilusión", "ilusion", "barrera",
            "instant transmission", "evil containment", "dance", "technique", "ability"
        ]
    },
    {
        tagName: "Técnicas Letales",
        keywords: [
            "rayo mortal", "kikouhou", "corte", "perforar",
            "destructo disc", "death beam", "tri-beam", "fatal"
        ]
    },
    {
        tagName: "Técnicas de Sacrificio",
        keywords: [
            "autodestrucción", "autodestruccion", "explosión final", "explosion final", "sacrificio final",
            "self destruct", "final explosion", "sacrifice himself", "sacrifices"
        ]
    },
    {
        tagName: "Súper Saiyajin",
        keywords: [
            "súper saiyajin", "super saiyajin", "super saiyan", "ssj", "golden", "instinto", "despertar", "transformación", "transformacion",
            "super saiyan 2", "super saiyan 3", "super saiyan 4", "super saiyan god", "ssj2", "ssj3", "ssj4",
            "ssgss", "ultra instinct", "omen", "mastered", "blue", "godlike saiyan", "transforms"
        ]
    },
    {
        tagName: "Transformación de Villano",
        keywords: [
            "forma final", "perfect cell", "super buu", "kid buu", "golden frieza",
            "final form", "perfect form", "true form", "100% power", "full power", "maximum power"
        ]
    },
    {
        tagName: "Poderes Ocultos",
        keywords: [
            "potencial", "desatado", "ultra instinto", "ultra ego",
            "hidden power", "unleashed", "potential", "mystic gohan", "ultimate gohan"
        ]
    },
    {
        tagName: "Poderes Psíquicos",
        keywords: [
            "telequinesis", "guldo", "chaoz", "control mental",
            "telekinesis", "psychic", "mind control"
        ]
    },
    {
        tagName: "Espadachines y Armas",
        keywords: [
            "espada", "trunks del futuro",
            "sword", "future trunks", "weapon", "blade"
        ]
    },
    {
        tagName: "Fusión de Guerreros",
        keywords: [
            "fusión", "fusion", "danza de la fusión", "danza de la fusion", "vegetto", "gogeta", "gotenks",
            "fusion", "potara", "vegito", "mergence", "fused"
        ]
    },
    {
        tagName: "Búsqueda de las Esferas",
        keywords: [
            "esferas del dragón", "esferas del dragon", "esferas", "radar del dragón", "radar del dragon", "deseo", "shenlong", "porunga", "esfera",
            "dragon ball", "dragon balls", "wish", "shenron", "dragon radar"
        ]
    },
    {
        tagName: "Artes Marciales Clásicas",
        keywords: [
            "torneo de las artes marciales", "torneo de las artes", "torneo", "budokai", "ring", "eliminatoria", "campeonato",
            "martial arts tournament", "world tournament", "tenkaichi", "fighting tournament", "the tournament"
        ]
    },
    {
        tagName: "El Torneo de Uranai Baba",
        keywords: [
            "uranai baba", "momia", "abuelo gohan",
            "fortuneteller baba", "grandpa gohan", "invisible man"
        ]
    },
    {
        tagName: "Los Juegos de Cell",
        keywords: [
            "juegos de cell", "cell games", "cell's games"
        ]
    },
    {
        tagName: "Torneo del Más Allá",
        keywords: [
            "torneo del otro mundo", "paikuhan", "gran kaio",
            "otherworld tournament", "other world", "king kai"
        ]
    },
    {
        tagName: "Supervivencia Universal",
        keywords: [
            "sobrevivir", "destrucción", "destruccion", "fin del mundo", "salvar", "peligro", "torneo del poder",
            "tournament of power", "universe erased", "survive", "erasure", "omni-king"
        ]
    },
    {
        tagName: "Cruce de Universos",
        keywords: [
            "universo 6", "champa", "hit", "jiren", "multiverso",
            "universe 6", "universe 7", "universe 11", "multiverse", "cross-universal"
        ]
    },
    {
        tagName: "Viajes por el Espacio",
        keywords: [
            "nave", "espacio", "planeta", "namekusei", "galaxia",
            "space", "planet", "spaceship", "galaxy", "namek", "outer space"
        ]
    },
    {
        tagName: "Viajes en el Tiempo",
        keywords: [
            "futuro", "máquina del tiempo", "maquina del tiempo", "línea temporal", "linea temporal",
            "time machine", "future", "timeline", "time travel", "altered time"
        ]
    },
    {
        tagName: "Invasión a la Tierra",
        keywords: [
            "invadir", "ejército", "ejercito", "llegada", "conquista", "invasor",
            "invade", "invasion", "army", "attack on earth", "conquer"
        ]
    },
    {
        tagName: "Entrenamiento Extremo",
        keywords: [
            "entrenar", "maestro roshi", "habitación del tiempo", "habitacion del tiempo", "superación", "superacion", "práctica", "practica", "kaiosama",
            "training", "master roshi", "hyperbolic time chamber", "gravity room", "train", "karin tower"
        ]
    },
    {
        tagName: "Entrenamiento Divino",
        keywords: [
            "entrenamiento de whis", "ki divino",
            "whis training", "angel training", "divine ki", "god training"
        ]
    },
    {
        tagName: "Magia y Hechizos",
        keywords: [
            "magia", "babidi", "maldición", "maldicion", "hechizo", "sello", "bibidi",
            "magic", "wizard", "spell", "sorcerer", "majin", "seal", "curse"
        ]
    },
    {
        tagName: "Mundo de los Demonios",
        keywords: [
            "demonio", "rey demonio", "majin", "gomah", "degesu", "dabra", "dabura", "makai", "janemba", "towa",
            "demon", "demon realm", "demon king", "darkness", "demon world"
        ]
    },
    {
        tagName: "Maldición Mini",
        keywords: [
            "encogidos", "mini", "daima", "pequeños", "pequeño", "pequeno", "pequenos",
            "miniaturized", "shrunken", "young", "child form", "daima"
        ]
    },
    {
        tagName: "Sacrificio Heroico",
        keywords: [
            "sacrificio", "morir", "lágrimas", "lagrimas", "despedida", "tragedia", "muerte",
            "sacrifice", "death", "dies", "farewell", "tragedy", "goodbye", "tearful"
        ]
    },
    {
        tagName: "Tensión Absoluta",
        keywords: [
            "miedo", "desesperación", "desesperacion", "terror", "imposible", "angustia", "sin salida",
            "desperate", "hopeless", "terror", "impossible", "despair", "helpless"
        ]
    },
    {
        tagName: "Vida Cotidiana",
        keywords: [
            "familia", "escuela", "trabajo", "cotidiano", "vida diaria", "casa", "satán city", "satan city",
            "family", "school", "daily life", "work", "city", "peaceful", "normal life"
        ]
    },
    {
        tagName: "Humor y Relleno",
        keywords: [
            "banquete", "gracioso", "fiesta", "vacaciones", "broma", "comedia", "relleno", "bingo",
            "funny", "comedy", "party", "vacation", "humorous", "filler", "picnic"
        ]
    },
    {
        tagName: "Romance",
        keywords: [
            "boda", "amor", "casamiento", "pareja", "cita",
            "wedding", "love", "marriage", "couple", "romance"
        ]
    },
    {
        tagName: "Superhéroes",
        keywords: [
            "gran saiyaman", "justicia", "saiyawoman",
            "great saiyaman", "superhero", "justice", "hero costume"
        ]
    },
    {
        tagName: "Los Guerreros Z",
        keywords: [
            "goku", "vegeta", "gohan", "piccolo", "krillin", "krilin", "yamcha", "tenshinhan", "yajirobe",
            "z fighters", "z warrior"
        ]
    },
    {
        tagName: "Los Namekuseijin",
        keywords: [
            "namek", "dende", "nail", "porunga", "elder", "grand elder",
            "namekian", "elder namek"
        ]
    },
    {
        tagName: "Los Saiyajins",
        keywords: [
            "saiyajin", "raditz", "nappa", "bardock", "kakarotto", "planet vegeta",
            "saiyan", "saiyans", "race of warriors"
        ]
    },
    {
        tagName: "Saiyajins Legendarios",
        keywords: [
            "broly", "super saiyajin legendario", "kale", "berserker",
            "legendary super saiyan", "legendary saiyan"
        ]
    },
    {
        tagName: "El Imperio de Freezer",
        keywords: [
            "freezer", "ginyu", "zarbon", "dodoria", "cooler", "rey cold",
            "frieza", "frieza force", "frieza's army", "ginyu force", "king cold"
        ]
    },
    {
        tagName: "La Patrulla Roja",
        keywords: [
            "patrulla roja", "androide", "cell", "doctor gero", "dr. gero",
            "red ribbon", "android", "androids", "dr. gero", "cell max", "gamma"
        ]
    },
    {
        tagName: "Dioses de la Destrucción",
        keywords: [
            "bills", "whis", "beerus", "zeno", "dios de la destrucción", "dios de la destruccion",
            "god of destruction", "angel", "destroyer", "hakai"
        ]
    },
    {
        tagName: "Entidades Supremas",
        keywords: [
            "zeno sama", "rey de todo", "daishinkan",
            "king of all", "omni-king", "grand priest"
        ]
    },
    {
        tagName: "La Patrulla Galáctica",
        keywords: [
            "jaco", "merus", "moro", "patrulla galáctica", "patrulla galactica",
            "galactic patrol", "galactic patrolman"
        ]
    },
    {
        tagName: "Guerreras Poderosas",
        keywords: [
            "caulifla", "kale", "kefla", "videl", "android 18",
            "female warrior", "powerful woman"
        ]
    },
    {
        tagName: "Nuevas Generaciones",
        keywords: [
            "pan", "uub", "goten", "trunks niño", "trunks nino",
            "kid trunks", "next generation", "young fighters"
        ]
    },
    {
        tagName: "Dragones Malignos",
        keywords: [
            "dragón maligno", "dragon maligno", "omega shenron",
            "shadow dragon", "evil dragon", "negative energy"
        ]
    },
    {
        tagName: "Los Tsufurujin",
        keywords: [
            "baby", "tsufuru",
            "baby vegeta", "tuffle"
        ]
    },
    {
        tagName: "Villanos de Películas",
        keywords: [
            "garlic jr", "turles", "lord slug", "cooler", "broly", "bojack", "janemba",
            "garlic junior", "movie villain"
        ]
    },
    {
        tagName: "Objetos Místicos",
        keywords: [
            "senzu", "nube voladora",
            "senzu bean", "flying nimbus", "sacred water"
        ]
    },
    {
        tagName: "Tecnología Cápsula",
        keywords: [
            "cápsula", "capsula", "corporación cápsula", "corporacion capsula",
            "capsule corp", "gravity chamber", "spaceship"
        ]
    }
];

const DRAGON_BALL_MOVIES: MovieDefinition[] = [
    {
        id: "movie-39144",
        title: "La Leyenda de Shenlong",
        tmdbId: 39144,
        description: "Bulma y Goku buscan las Esferas del Dragón. Se enfrentan al malvado Rey Gurumes, quien destruye su propio reino buscando comida deliciosa."
    },
    {
        id: "movie-39145",
        title: "La Princesa Durmiente en el Castillo del Mal",
        tmdbId: 39145,
        description: "Goku y Krilin entrenan con el Maestro Roshi. Para ser aceptados, deben rescatar a la Princesa Durmiente en un siniestro castillo habitado por Lucifer."
    },
    {
        id: "movie-116776",
        title: "Una Aventura Mística",
        tmdbId: 116776,
        description: "Goku y Krilin viajan al imperio de Mifan para participar en un torneo de artes marciales. Allí descubren una conspiración liderada por el malvado General Tao Pai Pai y el Maestro Shen."
    },
    {
        id: "movie-39148",
        title: "El Camino Hacia el Poder",
        tmdbId: 39148,
        description: "Una hermosa reinterpretación del inicio de la serie clásica. Goku inicia su viaje, conoce a Bulma y destruye a la temible Patrulla Roja con su Kamehameha."
    },
    {
        id: "movie-28609",
        title: "¡Devuélveme a mi Gohan! (Garlic Jr.)",
        tmdbId: 28609,
        description: "El malvado Garlic Jr. secuestra a Gohan para apoderarse de la esfera de 4 estrellas. Goku y Piccolo unen fuerzas en un combate a muerte en la Zona Muerta."
    },
    {
        id: "movie-39100",
        title: "El Hombre Más Fuerte de este Mundo",
        tmdbId: 39100,
        description: "El cerebro incorpóreo del Dr. Willow busca el cuerpo del guerrero más fuerte del mundo. Goku lucha contra temibles bioguerreros para salvar la Tierra."
    },
    {
        id: "movie-39101",
        title: "La Súper Batalla (Turles)",
        tmdbId: 39101,
        description: "El saiyajin desertor Turles llega a la Tierra para plantar el Árbol Sagrado, el cual absorbe la energía del planeta. Goku y los guerreros Z libran un combate brutal contra los invasores."
    },
    {
        id: "movie-39102",
        title: "El Súper Guerrero Goku (Lord Slug)",
        tmdbId: 39102,
        description: "Lord Slug, un anciano y despiadado Namekuseijin supermago, llega a la Tierra para rejuvenecer con las esferas y conquistarla. Goku despierta una transformación de ki legendaria."
    },
    {
        id: "movie-24752",
        title: "Los Rivales Más Poderosos (Cooler)",
        tmdbId: 24752,
        description: "Cooler llega a la Tierra con su ejército para vengar la derrota de su hermano Freezer a manos del Super Saiyajin Goku."
    },
    {
        id: "movie-39103",
        title: "El Regreso de Cooler",
        tmdbId: 39103,
        description: "Los guerreros Z viajan al Nuevo Namek para defenderlo de la Estrella Gete, un planeta viviente cibernético liderado por Metal Cooler."
    },
    {
        id: "movie-39104",
        title: "La Pelea de los Tres Saiyajin (Androide 13)",
        tmdbId: 39104,
        description: "Tras la muerte del Dr. Gero, los androides 13, 14 y 15 despiertan para cumplir la misión original de destruir a Goku. La batalla final se traslada a los glaciares."
    },
    {
        id: "movie-34433",
        title: "El Poderoso Super Saiyajin (Broly)",
        tmdbId: 34433,
        description: "Paragus invita a Vegeta a gobernar el Nuevo Planeta Vegeta, pero es una trampa para acabar con los Saiyajin usando al incontrolable Super Saiyajin Legendario: Broly."
    },
    {
        id: "movie-39105",
        title: "La Galaxia Corre Peligro (Bojack)",
        tmdbId: 39105,
        description: "Tras los juegos de Cell, se celebra un torneo de artes marciales galáctico que es interrumpido por Bojack y sus secuaces interestelares. Gohan debe despertar todo su potencial desatado."
    },
    {
        id: "movie-44251",
        title: "El Regreso de Broly",
        tmdbId: 44251,
        description: "Broly revive tras su derrota y llega a la Tierra, atacando a Goten, Trunks y Videl. Gohan lucha desesperadamente y se produce una triple Genkidama/Kamehameha familiar."
    },
    {
        id: "movie-39106",
        title: "El Combate Definitivo (Bio-Broly)",
        tmdbId: 39106,
        description: "Científicos locos crean un clon de Broly usando ingeniería genética. El clon muta en una masa viscosa y destructiva que ataca un laboratorio. Goten, Trunks y Androide 18 defienden la isla."
    },
    {
        id: "movie-39107",
        title: "¡El Renacer de la Fusión! Goku y Vegeta (Janemba)",
        tmdbId: 39107,
        description: "Una explosión de energía espiritual en el infierno da vida al demonio gigante Janemba. Goku y Vegeta deben realizar la danza de la fusión para convertirse en Gogeta."
    },
    {
        id: "movie-39108",
        title: "El Ataque del Dragón (Tapion)",
        tmdbId: 39108,
        description: "El legendario héroe Tapion llega a la Tierra cargando al monstruo gigante Hildegarn sellado dentro de su cuerpo. Goku usa el Puño del Dragón para derrotar al demonio."
    },
    {
        id: "movie-126963",
        title: "La Batalla de los Dioses",
        tmdbId: 126963,
        description: "El Dios de la Destrucción Bills despierta tras décadas de sueño buscando al Super Saiyajin Dios de una antigua profecía. Goku entrena con Whis y alcanza el ki divino."
    },
    {
        id: "movie-303857",
        title: "La Resurrección de 'F'",
        tmdbId: 303857,
        description: "El ejército de Freezer reúne las esferas para revivir a su amo. Freezer entrena duro y regresa en su forma Golden para tomar venganza contra los Saiyajin."
    },
    {
        id: "movie-503314",
        title: "Dragon Ball Super: Broly",
        tmdbId: 503314,
        description: "Freezer llega a la Tierra acompañado de Broly, un Saiyajin exiliado con un poder de ki berserker inmenso. Goku y Vegeta se fusionan en Gogeta Blue para hacerle frente."
    },
    {
        id: "movie-610150",
        title: "Dragon Ball Super: Super Hero",
        tmdbId: 610150,
        description: "La Patrulla Roja revive creando a los Androides Gamma 1 y Gamma 2, y al colosal Cell Max. Gohan y Piccolo despiertan nuevas transformaciones divinas para derrotarlos."
    },
    {
        id: "movie-39323",
        title: "La Batalla del Padre de Goku (Bardock)",
        tmdbId: 39323,
        description: "El guerrero saiyajin Bardock recibe visiones del futuro que le revelan el plan de Freezer de destruir el Planeta Vegeta. Intenta rebelarse en solitario en una batalla heroica."
    },
    {
        id: "movie-39324",
        title: "Un Futuro Diferente (Trunks)",
        tmdbId: 39324,
        description: "En un futuro postapocalíptico, los androides 17 y 18 han exterminado a los Guerreros Z. Gohan y Trunks son la última línea de defensa contra los cyborgs asesinos."
    },
    {
        id: "movie-18095",
        title: "100 Años Después (GT Especial)",
        tmdbId: 18095,
        description: "Un siglo después de los eventos de GT, el tataranieto de Goku, Goku Jr., emprende un viaje al Monte Paozu para buscar una Esfera del Dragón y curar a su abuela Pan."
    },
    {
        id: "movie-38594",
        title: "¡Hola! ¡Goku y sus amigos regresan!",
        tmdbId: 38594,
        description: "Una divertida aventura de reencuentro dos años después de Majin Buu. El hermano menor de Vegeta, Tarble, llega pidiendo auxilio para enfrentar a remanentes de Freezer."
    },
    {
        id: "movie-39322",
        title: "Seguridad Vial de Goku",
        tmdbId: 39322,
        description: "Goku enseña lecciones cómicas sobre seguridad vial en la ciudad mientras viaja con su familia."
    }
];

function extractTags(title: string, synopsis: string, isMovie: boolean): string[] {
    const combined = `${title} ${synopsis}`.toLowerCase();
    const detected = new Set<string>();
    const tags: string[] = [];

    if (isMovie) {
        tags.push("Película");
        detected.add("Película");
    }

    // Analyze using standard dictionary keywords
    for (const category of DICTIONARY) {
        for (const keyword of category.keywords) {
            if (combined.includes(keyword.toLowerCase())) {
                if (!detected.has(category.tagName)) {
                    detected.add(category.tagName);
                    tags.push(category.tagName);
                }
                break; // Move to the next category once matched
            }
        }
    }

    // Fallbacks to guarantee minimum of 5 tags
    const fallbacks = ["Shonen Clásico", "Artes Marciales", "Acción", "Aventura", "Fantasía", "Desafío Constante", "Los Guerreros Z"];
    let fallbackIdx = 0;
    while (tags.length < 5 && fallbackIdx < fallbacks.length) {
        const fallback = fallbacks[fallbackIdx];
        if (!detected.has(fallback)) {
            detected.add(fallback);
            tags.push(fallback);
        }
        fallbackIdx++;
    }

    // Cap at maximum of 6 tags
    return tags.slice(0, 6);
}

function determineVibe(tags: string[]): string {
    const hasTag = (tag: string) => tags.includes(tag);

    if (hasTag("Supervivencia Universal") || hasTag("Tensión Absoluta")) {
        return "Tensión Absoluta";
    }
    if (hasTag("Sacrificio Heroico")) {
        return "Emoción Pura";
    }
    if (hasTag("Humor y Relleno") || hasTag("Vida Cotidiana")) {
        return "Relajado";
    }
    if (hasTag("Búsqueda de las Esferas") || hasTag("Viajes por el Espacio") || hasTag("Mundo de los Demonios")) {
        return "Aventura";
    }
    if (hasTag("Batalla Épica") || hasTag("Artes Marciales Clásicas")) {
        return "Épico";
    }
    return "Emocionante";
}

function suggestSwimlane(tags: string[], isMovie: boolean): string {
    const hasTag = (tag: string) => tags.includes(tag);

    // If it's a movie, prioritize movie themes
    if (isMovie) {
        if (hasTag("Broly") || hasTag("Saiyajins Legendarios")) {
            return "Saiyajins Legendarios: El Poder Berserker";
        }
        if (hasTag("Fusión de Guerreros")) {
            return "¡Fusión HA!: Las Uniones Más Poderosas";
        }
        if (hasTag("El Imperio de Freezer")) {
            return "El Imperio de Freezer: El Tirano del Universo";
        }
        if (hasTag("Dioses de la Destrucción")) {
            return "Dioses y Entidades Supremas del Universo";
        }
        return "Esencia de Cinema: Películas Legendarias";
    }

    // Batallas y Poder
    if (hasTag("Batalla Épica") && (hasTag("Súper Saiyajin") || hasTag("Poderes Ocultos"))) {
        return "Capítulos Imperdibles: Las Batallas Más Épicas";
    }
    if (hasTag("Batalla Épica") && (hasTag("Técnicas de Ki") || hasTag("Supervivencia Universal"))) {
        return "¡Eleva tu Ki!: Batallas que rompieron los límites";
    }
    if (hasTag("Súper Saiyajin") || hasTag("Poderes Ocultos")) {
        return "Más Allá del Límite: Transformaciones Saiyajin";
    }
    if (hasTag("Transformación de Villano")) {
        return "Cuando el Villano Alcanza su Forma Final";
    }
    if (hasTag("Técnicas de Sacrificio")) {
        return "El Último Recurso: Técnicas de Sacrificio";
    }
    if (hasTag("Técnicas Letales")) {
        return "Técnicas Letales: Sin Vuelta Atrás";
    }
    if (hasTag("Fusión de Guerreros")) {
        return "¡Fusión HA!: Las Uniones Más Poderosas";
    }
    if (hasTag("Espadachines y Armas")) {
        return "Espadachines y Guerreros con Armas";
    }

    // Torneos y Eventos
    if (hasTag("Artes Marciales Clásicas")) {
        return "¡Fuera del Ring!: Los Grandes Torneos";
    }
    if (hasTag("El Torneo de Uranai Baba")) {
        return "El Misterioso Torneo de Uranai Baba";
    }
    if (hasTag("Los Juegos de Cell")) {
        return "Los Juegos de Cell: El Torneo del Terror";
    }
    if (hasTag("Torneo del Más Allá")) {
        return "Torneo del Más Allá: Combates en el Otro Mundo";
    }
    if (hasTag("Supervivencia Universal") && hasTag("Cruce de Universos")) {
        return "Torneo del Poder: Supervivencia Universal";
    }

    // Sagas y Facciones
    if (hasTag("El Imperio de Freezer")) {
        return "El Imperio de Freezer: El Tirano del Universo";
    }
    if (hasTag("La Patrulla Roja")) {
        return "La Patrulla Roja: Androides y Cell";
    }
    if (hasTag("Saiyajins Legendarios")) {
        return "Saiyajins Legendarios: El Poder Berserker";
    }
    if (hasTag("Los Saiyajins")) {
        return "Los Saiyajins: La Raza Guerrera Más Poderosa";
    }
    if (hasTag("Los Tsufurujin")) {
        return "Los Tsufurujin: La Venganza de Baby";
    }
    if (hasTag("Dragones Malignos")) {
        return "Los Dragones Malignos: La Amenaza Final de GT";
    }
    if (hasTag("Dioses de la Destrucción") || hasTag("Entidades Supremas")) {
        return "Dioses y Entidades Supremas del Universo";
    }
    if (hasTag("La Patrulla Galáctica")) {
        return "La Patrulla Galáctica: Policías del Cosmos";
    }
    if (hasTag("Guerreras Poderosas")) {
        return "Guerreras Indomables del Universo";
    }
    if (hasTag("Nuevas Generaciones")) {
        return "El Futuro: Las Nuevas Generaciones de Guerreros";
    }
    if (hasTag("Los Namekuseijin")) {
        return "Los Namekuseijin: Guardianes de las Esferas";
    }

    // Sci-Fi y Aventura
    if (hasTag("Viajes en el Tiempo")) {
        return "Guardianes del Tiempo: Crónicas del Futuro";
    }
    if (hasTag("Supervivencia Universal")) {
        return "Crónicas de Supervivencia: El Futuro en Llamas";
    }
    if (hasTag("Cruce de Universos")) {
        return "Multiverso: El Cruce de Universos";
    }
    if (hasTag("Invasión a la Tierra")) {
        return "¡La Tierra Bajo Ataque! Invasiones Alienígenas";
    }
    if (hasTag("Viajes por el Espacio")) {
        return "Más Allá de las Estrellas: Aventura Espacial";
    }
    if (hasTag("Búsqueda de las Esferas")) {
        return "Deseos Prohibidos y Dragones Sagrados";
    }

    // Magia y Sobrenatural
    if (hasTag("Mundo de los Demonios") || hasTag("Magia y Hechizos")) {
        return "Artes Oscuras: Magia y Demonios";
    }
    if (hasTag("Maldición Mini")) {
        return "¡Encogidos! La Maldición Mini de Daima";
    }

    // Emociones y Drama
    if (hasTag("Sacrificio Heroico")) {
        return "Cuando los Héroes lo Dan Todo: Sacrificios";
    }
    if (hasTag("Tensión Absoluta")) {
        return "Tensión Absoluta: Al Borde del Abismo";
    }
    if (hasTag("Romance")) {
        return "Amor en el Universo Dragon Ball";
    }
    if (hasTag("Superhéroes")) {
        return "Gran Saiyaman: El Héroe Enmascarado";
    }
    if (hasTag("Humor y Relleno") || hasTag("Vida Cotidiana")) {
        return "Momentos para Reír: El Lado Cómico del Universo";
    }

    // Entrenamiento
    if (hasTag("Entrenamiento Divino")) {
        return "Entrenamiento Divino: El Camino de los Dioses";
    }
    if (hasTag("Entrenamiento Extremo")) {
        return "El Camino del Guerrero: Entrenamientos";
    }

    return "Aventuras en el Universo Dragon Ball";
}

function runAnalysis() {
    console.log("Starting Dragon Ball Saga & Movie Synopses Analysis...");

    const output: Record<string, {
        id: string;
        title: string;
        seriesId?: number;
        tmdbId?: number;
        description: string;
        tags: string[];
        dominantVibe: string;
        suggestedSwimlane: string;
        isMovie?: boolean;
    }> = {};

    // 1. Process Sagas (TV Series)
    for (const [seriesIdStr, sagas] of Object.entries(DRAGON_BALL_SAGAS)) {
        const seriesId = parseInt(seriesIdStr, 10);
        for (const saga of sagas) {
            const tags = extractTags(saga.title, saga.description, false);
            const vibe = determineVibe(tags);
            const swimlane = suggestSwimlane(tags, false);

            output[saga.id] = {
                id: saga.id,
                title: saga.title,
                seriesId,
                description: saga.description,
                tags,
                dominantVibe: vibe,
                suggestedSwimlane: swimlane
            };
        }
    }

    // 2. Process Movies & Specials
    for (const movie of DRAGON_BALL_MOVIES) {
        const tags = extractTags(movie.title, movie.description, true);
        const vibe = determineVibe(tags);
        const swimlane = suggestSwimlane(tags, true);

        output[movie.id] = {
            id: movie.id,
            title: movie.title,
            tmdbId: movie.tmdbId,
            description: movie.description,
            tags,
            dominantVibe: vibe,
            suggestedSwimlane: swimlane,
            isMovie: true
        };
    }

    const outputPath = path.join(__dirname, 'saga_synopsis_tags.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Successfully generated tags for ${Object.keys(output).length} entries (28 sagas + ${DRAGON_BALL_MOVIES.length} movies)! Saved to: ${outputPath}`);
}

runAnalysis();
