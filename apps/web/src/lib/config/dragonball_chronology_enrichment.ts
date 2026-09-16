import { DRAGON_BALL_MOVIES_LORE, TMDB_TO_LORE_MOVIE_MAP, type MovieLoreDefinition } from "./dragonball_movies_lore"
import type { StorySpan } from "./dragonball_story_spans"

export interface EnrichedMovieLore extends MovieLoreDefinition {
    tmdbId?: number
}

export interface GokuAgeInfo {
    physical: string
    chronological?: string
    notes?: string
}

export interface UniverseLoreDetails {
    debuts: string[]
    transformations: string[]
    deaths: string[]
    wishes: string[]
}

// Inverted map to obtain the TMDB ID from the movie ID ("m1" -> 39144, etc.)
export const LORE_MOVIE_TO_TMDB_MAP: Record<string, number> = Object.entries(TMDB_TO_LORE_MOVIE_MAP).reduce(
    (acc, [tmdb, id]) => {
        acc[id] = Number(tmdb)
        return acc
    },
    {} as Record<string, number>
)

// Explicit mapping of movie IDs to story span IDs where they fit best chronologically
export const SPAN_TO_MOVIES_MAP: Record<string, string[]> = {
    "db-pilaf": ["m1", "m4"],
    "db-torneo-21": ["m2"],
    "db-red-ribbon": ["m3"],
    "db-uranai-baba": ["m3"],
    "dbz-saiyajin-raditz": ["sp1", "m5"],
    "dbz-saiyajin-vegeta": ["m6"],
    "dbz-namek-viaje": ["m7"],
    "dbz-freezer-super-saiyajin": ["m8"],
    "dbz-garlic-jr": ["m5"],
    "dbz-androides-trunks": ["m9", "sp2"],
    "dbz-cell-imperfecto-perfeccion": ["m10", "m11"],
    "dbz-juegos-de-cell": ["m12"],
    "dbz-torneo-otro-mundo": ["m13"],
    "dbz-saiyaman": ["m14"],
    "dbz-torneo-25": ["m15"],
    "dbz-buu-gotenks-gohan": ["m16"],
    "dbz-buu-kid-buu": ["m17"],
    "dbs-dioses": ["m18"],
    "dbs-freezer": ["m19"],
    "dbs-supervivencia-universal": ["m20", "m21"],
    "dbgt-shadow-dragons": ["sp3"],
}

export function getMoviesForSpan(span: StorySpan): EnrichedMovieLore[] {
    const movieIds = SPAN_TO_MOVIES_MAP[span.id] || []
    const results: EnrichedMovieLore[] = []

    for (const mId of movieIds) {
        const lore = DRAGON_BALL_MOVIES_LORE[mId]
        if (lore) {
            results.push({
                ...lore,
                tmdbId: LORE_MOVIE_TO_TMDB_MAP[mId],
            })
        }
    }

    return results
}

// Age of Son Goku according to in-universe official chronology (Birth: Year 737 / Age 737)
export const GOKU_AGE_MAP: Record<string, GokuAgeInfo> = {
    "db-pilaf": { physical: "12 años", notes: "Inicia el viaje con Bulma en la Montaña Paoz" },
    "db-torneo-21": { physical: "12 – 13 años", notes: "Entrenamiento en Kame House y 21° Torneo" },
    "db-red-ribbon": { physical: "13 años", notes: "Batallas contra el ejército de la Patrulla Roja" },
    "db-uranai-baba": { physical: "13 años", notes: "Reencuentro con el Abuelo Son Gohan" },
    "db-torneo-22": { physical: "15 – 16 años", notes: "Combate contra Tenshinhan en la final" },
    "db-piccolo-daimaku": { physical: "16 años", notes: "Bebe el Agua Ultra Divina y derrota al Rey Demonio" },
    "db-piccolo-jr": { physical: "18 – 19 años", notes: "Aparición adulta; boda con Milk y campeón del 23° Torneo" },
    "dbz-saiyajin-raditz": { physical: "24 años", notes: "Muerte sacrificando su vida contra su hermano Raditz" },
    "dbz-saiyajin-vegeta": { physical: "25 años", notes: "Regresa del Más Allá con Kaio-ken y Genkidama" },
    "dbz-namek-viaje": { physical: "25 años", notes: "Entrena a 100G de gravedad rumbo a Namek" },
    "dbz-namek-ginyu-freezer": { physical: "25 años", notes: "Supera a las Fuerzas Especiales Ginyu" },
    "dbz-freezer-super-saiyajin": { physical: "25 años", notes: "Despertar del Legendario Super Saiyajin" },
    "dbz-garlic-jr": { physical: "26 años", notes: "Entrenando en el Planeta Yardrat (Ausente)" },
    "dbz-androides-trunks": { physical: "27 – 29 años", notes: "Regreso a la Tierra con la Teletransportación" },
    "dbz-cell-imperfecto-perfeccion": { physical: "29 años", notes: "Recuperación de la enfermedad cardíaca" },
    "dbz-juegos-de-cell": { physical: "30 años", chronological: "29 años", notes: "+1 año en la Habitación del Tiempo; sacrificio final" },
    "dbz-torneo-otro-mundo": { physical: "30 años", chronological: "30 años", notes: "Espíritu en el Más Allá (conserva cuerpo por mérito)" },
    "dbz-saiyaman": { physical: "30 años (cuerpo)", chronological: "37 años", notes: "7 años fallecido entrenando con los Kaio del universo" },
    "dbz-torneo-25": { physical: "30 años (cuerpo)", chronological: "37 años", notes: "Permiso especial de 24 horas de Uranai Baba" },
    "dbz-buu-majin-vegeta": { physical: "30 años (cuerpo)", chronological: "37 años", notes: "Muestra por primera vez el Super Saiyajin 3" },
    "dbz-buu-gotenks-gohan": { physical: "37 años", chronological: "37 años", notes: "Revivido gracias al sacrificio del Anciano Kaioshin" },
    "dbz-buu-kid-buu": { physical: "37 años", chronological: "37 años", notes: "Genkidama definitiva en el Planeta Sagrado" },
    "dbdaima-misterio": { physical: "9 – 12 años (niño)", chronological: "37 – 38 años", notes: "Rejuvenecido por la conspiración del Rey Gomah" },
    "dbdaima-travesia": { physical: "9 – 12 años (niño)", chronological: "37 – 38 años", notes: "Viaje al Reino Demoníaco recuperando su Báculo Sagrado" },
    "dbs-dioses": { physical: "41 años", notes: "Alcanza el estado divino de Super Saiyajin Dios" },
    "dbs-freezer": { physical: "42 años", notes: "Control del ki divino: Super Saiyajin Blue" },
    "dbs-universo-6": { physical: "42 años", notes: "Combinación de SSJ Blue con Kaio-ken x10" },
    "dbs-trunks-futuro": { physical: "42 – 43 años", notes: "Viaje temporal y fusión en Vegetto Blue" },
    "dbs-supervivencia-universal": { physical: "43 años", notes: "Doctrina del Juicio: Ultra Instinto Dominado" },
    "dbgt-black-star": { physical: "12 años (niño)", chronological: "52 años", notes: "Deseo accidental de Pilaf con las Esferas de Estrella Negra" },
    "dbgt-baby": { physical: "12 años / Adulto en SSJ4", chronological: "52 años", notes: "Despertar del Gran Mono Dorado y Super Saiyajin 4" },
    "dbgt-super-17": { physical: "12 años / Adulto en SSJ4", chronological: "53 años", notes: "Uso del Puño del Dragón contra el androide definitivo" },
    "dbgt-shadow-dragons": { physical: "12 años / Adulto en SSJ4", chronological: "53 / 153 años", notes: "Fusión en Shenlong; guardián legendario de las esferas" },
}

export function getGokuAgeForSpan(spanId: string): GokuAgeInfo {
    return GOKU_AGE_MAP[spanId] || { physical: "Edad Saiyajin", notes: "Cronología de combate" }
}

// Rich Universe Lore facts: Debuts, Transformations, Deaths, Wishes
export const UNIVERSE_LORE_MAP: Record<string, UniverseLoreDetails> = {
    "db-pilaf": {
        debuts: ["Son Goku", "Bulma", "Oolong", "Yamcha", "Puar", "Maestro Roshi", "Emperador Pilaf", "Shu", "Mai", "Shenlong", "Ox-Satán", "Milk (Chi-Chi)"],
        transformations: ["Gran Mono (Oozaru)", "Primer Kamehameha en pantalla"],
        deaths: ["Ninguna"],
        wishes: ["Oolong pide unas bragas a Shenlong para arruinar el deseo de conquista de Pilaf"],
    },
    "db-torneo-21": {
        debuts: ["Krilin", "Jackie Chun (Roshi)", "Bacterian", "Nam", "Ranfan", "Giran", "Presentador del Torneo"],
        transformations: ["Oozaru de Goku en la final", "Kamehameha Máximo de Jackie Chun (destruye la Luna)"],
        deaths: ["Ninguna"],
        wishes: ["Esferas convertidas en piedra durante 1 año"],
    },
    "db-red-ribbon": {
        debuts: ["Comandante Red", "General Black", "General Blue", "Coronel Silver", "General White", "Androide 8 (Octavio)", "Ninja Murasaki", "Bora", "Upa", "Maestro Karin", "Mercenario Tao Pai Pai", "Arale Norimaki"],
        transformations: ["Dominio del Agua Sagrada (entrenamiento físico de Karin)"],
        deaths: ["Bora (a manos de Tao Pai Pai)", "Oficiales de la Red Ribbon", "Tao Pai Pai (aparente)"],
        wishes: ["Invocación de Shenlong para resucitar al guerrero Bora"],
    },
    "db-uranai-baba": {
        debuts: ["Uranai Baba", "Hombre Invisible", "Momia Asesina", "Akkuman (Demonio)", "Abuelo Son Gohan (del Más Allá)"],
        transformations: ["Rayos del Resplandor Diabólico de Akkuman"],
        deaths: ["Ninguna"],
        wishes: ["Revivir a Bora con las 7 esferas"],
    },
    "db-torneo-22": {
        debuts: ["Tenshinhan", "Chaoz", "Maestro Tsuru (Grulla)"],
        transformations: ["Kikoho (Cañón Espiritual)", "Vuelo (Bukūjutsu) introducido formalmente"],
        deaths: ["Ninguna en combate del torneo"],
        wishes: ["Esferas en período de descanso"],
    },
    "db-piccolo-daimaku": {
        debuts: ["Piccolo Daimaō", "Tambourine", "Cymbal", "Drum", "Piano", "Yajirobe"],
        transformations: ["Goku bebe el veneno del Agua Ultra Divina", "Golpe del Ozaru (técnica final)"],
        deaths: ["Krilin (asesinado por Tambourine)", "Maestro Roshi (fallo del Mafuba)", "Chaoz", "Dragón Shenlong (destruido por Daimaō)", "Piccolo Daimaō"],
        wishes: ["Piccolo Daimaō recupera su juventud eterna y luego asesina a Shenlong"],
    },
    "db-piccolo-jr": {
        debuts: ["Piccolo Jr. (Ma Junior)", "Kami-sama", "Mr. Popo", "Milk adulta"],
        transformations: ["Piccolo Gigante", "Super Kamehameha guiado", "Kamehameha con los pies"],
        deaths: ["Ninguna (Goku perdona la vida a Piccolo para preservar a Kami-sama)"],
        wishes: ["Kami-sama revive a Shenlong para resucitar a Roshi, Krilin y Chaoz"],
    },
    "dbz-saiyajin-raditz": {
        debuts: ["Raditz", "Son Gohan (niño)", "Kaio-sama del Norte", "Bubbles", "Gregory", "Enma Daio-sama"],
        transformations: ["Estallido de ki oculto de Gohan (ki: 1307)", "Makankosappo de Piccolo"],
        deaths: ["Son Goku (atravesado por Makankosappo)", "Raditz"],
        wishes: ["Reunión de esferas para pedir la resurrección de Goku en 1 año"],
    },
    "dbz-saiyajin-vegeta": {
        debuts: ["Vegeta", "Nappa", "Saibaimen"],
        transformations: ["Kaio-ken (x1, x2, x3, x4)", "Genkidama inicial", "Oozaru de Vegeta", "Oozaru de Gohan"],
        deaths: ["Yamcha (Saibaman suicida)", "Chaoz (autodestrucción)", "Tenshinhan (agotamiento)", "Piccolo (escudo para salvar a Gohan)", "Nappa (rematado por Vegeta)"],
        wishes: ["Kami-sama muere, desapareciendo las esferas de la Tierra temporalmente"],
    },
    "dbz-namek-viaje": {
        debuts: ["Freezer", "Zarbon", "Dodoria", "Dende", "Gran Patriarca (Saichōrō)", "Nail", "Cui"],
        transformations: ["Liberación de potencial de Gohan y Krilin por el Gran Patriarca", "Transformación monstruosa de Zarbon"],
        deaths: ["Cui", "Dodoria", "Zarbon", "Aldeanos Namekianos"],
        wishes: ["Búsqueda activa de las Esferas Namekianas"],
    },
    "dbz-namek-ginyu-freezer": {
        debuts: ["Capitán Ginyu", "Recoome", "Burter", "Jeice", "Guldo", "Polunga (Dragón Namekiano)"],
        transformations: ["Cambio de Cuerpo (Body Change) de Ginyu", "Fusión Namekiana: Piccolo + Nail"],
        deaths: ["Guldo (decapitado por Vegeta)", "Recoome", "Burter", "Jeice"],
        wishes: ["Porunga es invocado: 1. Revivir a Piccolo en Namek, 2. Teletransportarlo a Namek"],
    },
    "dbz-freezer-super-saiyajin": {
        debuts: ["Freezer 2ª, 3ª, 4ª Forma y 100% de Poder"],
        transformations: ["Legendario Super Saiyajin (SSJ1 de Goku)", "Kaio-ken x20", "Super Genkidama de Namek"],
        deaths: ["Dende (por Freezer)", "Vegeta (asesinado por Freezer)", "Krilin (hecho explotar por Freezer)", "Gran Patriarca"],
        wishes: ["Shenlong terrestre revive a todas las víctimas de Freezer; Porunga transporta a todos a la Tierra excepto a Goku y Freezer"],
    },
    "dbz-garlic-jr": {
        debuts: ["Garlic Jr. (escapado de la Zona Muerta)", "Spice Boys (Gasshu, Vinegar, Tard, Zoldo)", "Maron"],
        transformations: ["Garlic Jr. Gigante (influencia del Planeta Makyo)"],
        deaths: ["Spice Boys", "Garlic Jr. encerrado de nuevo en la Zona Muerta"],
        wishes: ["Agua Ultra Divina esparcida por Kami-sama para curar a la humanidad"],
    },
    "dbz-androides-trunks": {
        debuts: ["Trunks del Futuro", "Mecha Freezer", "King Cold", "Dr. Gero (Androide 20)", "Androide 19", "Androide 18", "Androide 17", "Androide 16"],
        transformations: ["Trunks Super Saiyajin", "Vegeta Super Saiyajin", "Teletransportación (Shunkan Idō) de Goku"],
        deaths: ["Mecha Freezer y King Cold (descuartizados por Trunks)", "Androide 19 (destruido por Big Bang Attack)", "Dr. Gero (decapitado por Androide 17)"],
        wishes: ["Esferas inactivas"],
    },
    "dbz-cell-imperfecto-perfeccion": {
        debuts: ["Cell (Bio-androide del futuro en Forma Imperfecta, Semiperfecta y Perfecta)"],
        transformations: ["Super Namekiano (Piccolo fusionado con Kami-sama)", "Super Vegeta (Grade 2)", "Super Trunks (Grade 3)", "Cell Perfección Absoluta"],
        deaths: ["Población de Ginger Town y ciudades vecinas (absorbidos por Cell)"],
        wishes: ["Kami-sama se fusiona con Piccolo; Dende es traído para ser el nuevo Kami-sama de la Tierra"],
    },
    "dbz-juegos-de-cell": {
        debuts: ["Cell Juniors", "Mr. Satán", "Pizza", "Piroshki", "Caroni"],
        transformations: ["Full Power Super Saiyajin (Goku y Gohan)", "Super Saiyajin 2 (Gohan despierta la furia pura)", "Super Perfect Cell (Ki Divino y Rayos)"],
        deaths: ["Androide 16 (destruido por Cell)", "Son Goku (sacrificio en el planeta de Kaio-sama)", "Kaio-sama, Bubbles y Gregory", "Trunks (asesinado por Cell)", "Cell (desintegrado por el Kamehameha Padre e Hijo)"],
        wishes: ["Shenlong modificado por Dende (2 deseos): 1. Revivir a los asesinados por Cell (incluido Trunks), 2. Retirar las bombas del cuerpo de los Androides 17 y 18"],
    },
    "dbz-torneo-otro-mundo": {
        debuts: ["Paikuhan", "Olibu", "Gran Kaio-sama", "Kaio del Sur, Este y Oeste"],
        transformations: ["Super Kaio-ken (Goku combina SSJ1 con Kaio-ken)"],
        deaths: ["Ninguna (ambientado en el Reino de los Muertos)"],
        wishes: ["Ninguno"],
    },
    "dbz-saiyaman": {
        debuts: ["Gran Saiyaman (Gohan)", "Videl", "Goten", "Trunks (niño)", "Sharpner", "Erasa"],
        transformations: ["Goten y Trunks se transforman en Super Saiyajin sin esfuerzo a temprana edad"],
        deaths: ["Ninguna"],
        wishes: ["Ninguno"],
    },
    "dbz-torneo-25": {
        debuts: ["Shin (Supremo Kaioshin)", "Kibito", "Spopovich", "Yamu", "Dabra (Rey de los Demonios)", "Babidi"],
        transformations: ["Majin Vegeta (Vegeta sucumbe voluntariamente al sello M)"],
        deaths: ["Spopovich y Yamu (eliminados por Babidi)", "Kibito (temporalmente por Dabra)"],
        wishes: ["Ninguno"],
    },
    "dbz-buu-majin-vegeta": {
        debuts: ["Majin Buu (Gordo / Inocente)"],
        transformations: ["Super Saiyajin 3 de Goku", "Explosión Final (Final Explosion de Majin Vegeta)"],
        deaths: ["Dabra (convertido en galleta y devorado por Buu)", "Vegeta (sacrificio suicida)", "Babidi (decapitado por Buu)"],
        wishes: ["Shenlong revive a las víctimas del Torneo asesinadas por Majin Vegeta"],
    },
    "dbz-buu-gotenks-gohan": {
        debuts: ["Gotenks (Fusión de Goten y Trunks)", "Evil Buu (Buu Pura Maldad)", "Super Buu", "Anciano Kaioshin (Rou Dai Kaioshin)"],
        transformations: ["Gotenks Super Saiyajin 3", "Gohan Definitivo (Mystic Gohan)", "Super Buu con Gotenks y Piccolo absorbidos"],
        deaths: ["Casi la totalidad de la humanidad terrestre asesinada por el ataque de Human Extinction de Super Buu"],
        wishes: ["Dende conserva las esferas del dragón a salvo"],
    },
    "dbz-buu-kid-buu": {
        debuts: ["Vegetto (Fusión Pothala de Goku y Vegeta)", "Kid Buu (Forma Original Pura)", "Uub (encarnación futura)"],
        transformations: ["Super Vegetto", "Genkidama Universal con la energía de toda la Tierra"],
        deaths: ["Destrucción total del planeta Tierra por Kid Buu", "Kid Buu (aniquilado por la Genkidama)"],
        wishes: ["Porunga Namekiano: 1. Reconstruir el planeta Tierra, 2. Revivir a todas las personas buenas, 3. Restaurar la energía completa de Goku para empujar la Genkidama"],
    },
    "dbdaima-misterio": {
        debuts: ["Rey Gomah", "Degesu", "Dra. Arinsu", "Neva (Namekiano del Reino Demoníaco)"],
        transformations: ["Goku Niño recupera su Báculo Sagrado (Nyoibo) y estilo clásico de artes marciales"],
        deaths: ["Ninguna"],
        wishes: ["Gomah usa las esferas oscuras de la Tierra para transformar a Goku y todos sus amigos en niños"],
    },
    "dbdaima-travesia": {
        debuts: ["Glorio", "Panzy", "Demonios del Tercer Mundo Demoníaco"],
        transformations: ["Combate aéreo y técnicas con Báculo Sagrado en estado infantil"],
        deaths: ["Monstruos y esbirros del Reino Demoníaco"],
        wishes: ["Búsqueda de las esferas oscuras para revertir la maldición infantil"],
    },
    "dbs-dioses": {
        debuts: ["Bills (Dios de la Destrucción del Universo 7)", "Whis (Ángel Guía)"],
        transformations: ["Super Saiyajin Dios (Ritual de los 6 Saiyajin, aura carmesí y ki divino)"],
        deaths: ["Ninguna"],
        wishes: ["Shenlong explica a Goku la leyenda y ritual del Super Saiyajin Dios"],
    },
    "dbs-freezer": {
        debuts: ["Golden Freezer", "Sorbet", "Tagoma", "Shisami", "Jaco the Galactic Patrolman"],
        transformations: ["Super Saiyajin Blue (SSJ God SSJ)", "Golden Freezer (Forma Dorada)", "Retroceso Temporal de 3 segundos de Whis"],
        deaths: ["Freezer (vaporizado por el Kamehameha de Goku tras el retroceso temporal de Whis)", "Tagoma / Shisami"],
        wishes: ["Sorbet revive a Freezer en trozos con las esferas de la Tierra"],
    },
    "dbs-universo-6": {
        debuts: ["Champa (Dios Universo 6)", "Vados (Ángel U6)", "Hit (Asesino del Tiempo)", "Cabba", "Frost", "Magetta", "Botamo", "Monaka", "Super Shenlong"],
        transformations: ["Super Saiyajin Blue + Kaio-ken x10", "Salto Temporal (Toki Tobashi) de Hit"],
        deaths: ["Ninguna"],
        wishes: ["Super Shenlong restaura el Planeta Tierra del Universo 6 con toda su cultura y habitantes"],
    },
    "dbs-trunks-futuro": {
        debuts: ["Goku Black", "Zamasu", "Zamasu Fusionado", "Zeno-sama del Futuro"],
        transformations: ["Super Saiyajin Rosé", "Vegetto Blue", "Trunks Super Saiyajin Rage", "Espada de la Esperanza (Genki Sword)"],
        deaths: ["Bulma del Futuro", "Zamasu Fusionado cortado por Trunks", "Erradicación total de la línea temporal corrupta por Zeno-sama"],
        wishes: ["Zamasu en el pasado pidió a Super Shenlong intercambiar cuerpos con Goku y la inmortalidad"],
    },
    "dbs-supervivencia-universal": {
        debuts: ["Jiren", "Toppo (Candidato a Hakaishin)", "Dyspo", "Kafla (Fusión Caulifla + Kale)", "Belmod", "Gran Sacerdote (Daishinkan)"],
        transformations: ["Ultra Instinto Señal (Migatte no Gokui 'Kizashi')", "Ultra Instinto Dominado (Doctrina del Juicio)", "Vegeta SSJ Blue Evolution (Ego Divino Inicial)", "Toppo Dios de la Destrucción"],
        deaths: ["Borrado temporal de los Universos 9, 2, 6, 4, 3, 11 y 10 por los Zeno-samás"],
        wishes: ["Androide 17 pide a Super Shenlong revivir y restaurar todos los universos borrados"],
    },
    "dbgt-black-star": {
        debuts: ["Pan (adolescente de 14 años)", "Giru (robot T2006)", "Don Kee", "Ledgic", "Lord Luud", "Mutchy"],
        transformations: ["Goku niño combate en Super Saiyajin 1"],
        deaths: ["Líderes de las sectas mecánicas espaciales"],
        wishes: ["Pilaf pide accidentalmente a las Esferas de Estrella Negra que Goku vuelva a ser un niño"],
    },
    "dbgt-baby": {
        debuts: ["Dr. Myuu", "Baby (Parásito Tsufuru)", "Baby Vegeta (Super Baby 1 y 2, Oozaru Dorado)"],
        transformations: ["Gran Mono Dorado (Golden Oozaru)", "Super Saiyajin 4 (Goku y su transformación biológica definitiva)"],
        deaths: ["Dr. Myuu", "Baby (lanzado al Sol con el Kamehameha x10)", "Piccolo (se queda en la Tierra al explotar para erradicar las esferas de estrella negra)"],
        wishes: ["Esferas de Estrella Negra destruidas para siempre con el sacrificio de Piccolo"],
    },
    "dbgt-super-17": {
        debuts: ["Hell 17 (creado en el Infierno)", "Super Androide 17"],
        transformations: ["Absorción total de energía de Super 17", "Puño del Dragón en estado base combinado con Kamehameha"],
        deaths: ["Krilin (asesinado por Androide 17 poseído)", "Dr. Gero y Dr. Myuu (traicionados por Super 17)", "Super Androide 17"],
        wishes: ["Intento de invocar a Shenlong para revivir a Krilin desata la corrupción de las esferas"],
    },
    "dbgt-shadow-dragons": {
        debuts: ["Shenlong Oscuro (Humo Negro)", "Ryan Shenron", "Uu Shenron", "Ryu Shenron", "Chuu Shenron", "Suu Shenron", "San Shenron", "Syn Shenron / Omega Shenron", "Goku Jr.", "Vegeta Jr."],
        transformations: ["Vegeta Super Saiyajin 4 (gracias a los Rayos Blantz de Bulma)", "Gogeta Super Saiyajin 4 (Cabello Rojo y Big Bang Kamehameha x100)", "Genkidama Universal Galáctica"],
        deaths: ["Los 7 Dragones Malignos destruidos", "Goku se une espiritualmente a Shenlong tras salvar el universo"],
        wishes: ["Shenlong purificado restaura la Tierra y concede que las esferas desaparezcan del mundo por 100 años"],
    },
}

export function getUniverseLoreForSpan(spanId: string): UniverseLoreDetails {
    return UNIVERSE_LORE_MAP[spanId] || {
        debuts: [],
        transformations: [],
        deaths: [],
        wishes: [],
    }
}
