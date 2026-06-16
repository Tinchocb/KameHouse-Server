export interface MovieLoreDefinition {
    id: string
    title: string
    era: string
    canonStatus: string
    startEpContext?: number
    endEpContext?: number
    seriesContext?: string
    chronologyNotes?: string
    antagonists?: string[]
    keyEvents?: string[]
    newCharacters?: string[]
    specialTrivia?: string
}

export const DRAGON_BALL_MOVIES_LORE: Record<string, MovieLoreDefinition> = {
    m1: {
        id: "m1",
        title: "La Leyenda de Shenlong",
        era: "Dragon Ball",
        canonStatus: "No canónico (Historia alternativa)",
        startEpContext: 1,
        endEpContext: 13,
        seriesContext: "original",
        chronologyNotes: "Representa una historia alternativa que resume los primeros 13 episodios de la serie de televisión (el encuentro con Bulma, Oolong y Yamcha).",
        antagonists: ["Rey Gurumes", "Bongo", "Raven"],
        keyEvents: [
            "Primer encuentro de Goku y Bulma (versión alternativa)",
            "Lucha contra el ejército del Rey Gurumes",
            "Shenlong concede el deseo de eliminar las esferas rubíes del estómago del Rey Gurumes"
        ],
        newCharacters: ["Rey Gurumes", "Panny", "Bongo", "Raven"],
        specialTrivia: "Es la primera película de la historia de Dragon Ball, lanzada en diciembre de 1986. Redefine el primer deseo a Shenlong, que en esta versión no es pedido por Oolong."
    },
    m2: {
        id: "m2",
        title: "La Princesa Durmiente en el Castillo del Mal",
        era: "Dragon Ball",
        canonStatus: "No canónico",
        startEpContext: 14,
        endEpContext: 28,
        seriesContext: "original",
        chronologyNotes: "Tiene lugar durante el período de entrenamiento de Goku y Krilin bajo las órdenes del Maestro Roshi, antes del 21° Torneo de Artes Marciales.",
        antagonists: ["Lucifer", "Ghastel", "Demonios del Castillo"],
        keyEvents: [
            "Prueba impuesta por Roshi para rescatar a la Princesa Durmiente",
            "Infiltración en el Castillo del Mal",
            "Goku destruye el cañón solar de Lucifer usando el Kamehameha"
        ],
        newCharacters: ["Lucifer", "Ghastel"],
        specialTrivia: "En esta película se introduce a Lunch en una circunstancia diferente a la del anime, ya que es salvada por Goku y Krilin mientras era prisionera de los demonios."
    },
    m3: {
        id: "m3",
        title: "Aventura Mística",
        era: "Dragon Ball",
        canonStatus: "No canónico",
        startEpContext: 29,
        endEpContext: 82,
        seriesContext: "original",
        chronologyNotes: "Transcurre durante la época de búsqueda de esferas y torneos, reuniendo personajes de la Saga del Torneo 22 y la Saga de la Patrulla Roja en una línea temporal alternativa.",
        antagonists: ["General Tao Pai Pai", "Ministro Tsuru", "Ejército de Mifan"],
        keyEvents: [
            "Goku y Krilin participan en el Torneo del Imperio Mifan",
            "Goku escala la Torre Karin para derrotar a Tao Pai Pai con ayuda de Arale Norimaki",
            "Tenshinhan traiciona a su maestro Tsuru para proteger a Chaoz"
        ],
        newCharacters: ["Emperador Chaoz (versión Mifan)", "Ran Ran"],
        specialTrivia: "Esta película incluye un cruce (crossover) espectacular con Arale y los personajes de Dr. Slump en la Aldea Pingüino, un clásico regalo para los fans de Akira Toriyama."
    },
    m4: {
        id: "m4",
        title: "El Camino hacia el Poder",
        era: "Dragon Ball",
        canonStatus: "No canónico",
        startEpContext: 1,
        endEpContext: 68,
        seriesContext: "original",
        chronologyNotes: "Producida con motivo del 10° aniversario. Sintetiza y reimagina la Saga de Pilaf y la Saga de la Patrulla Roja en una sola película de alta fidelidad.",
        antagonists: ["General Black", "Comandante Red", "General Blue"],
        keyEvents: [
            "Reencuentro modernizado del inicio del viaje con Bulma",
            "Goku se infiltra en los cuarteles de la Patrulla Roja",
            "Muerte del Androide 8 (Octavio), desatando un Kamehameha furioso que erradica al robot de combate de Black"
        ],
        newCharacters: ["Octavio (Androide 8)", "General Black (Rediseño)"],
        specialTrivia: "Fue animada con las técnicas visuales modernas de los años 90 empleadas en Dragon Ball GT, lo que le otorga un estilo artístico único, paletas de colores vibrantes y una banda sonora orquestal épica."
    },
    m5: {
        id: "m5",
        title: "Devuélvanme a mi Gohan",
        era: "Dragon Ball Z",
        canonStatus: "No canónico (Precuela de la saga Garlic Jr.)",
        startEpContext: 1,
        endEpContext: 1,
        seriesContext: "z",
        chronologyNotes: "Transcurre unos meses antes de la llegada de Raditz a la Tierra, sirviendo de precuela al primer episodio de Dragon Ball Z.",
        antagonists: ["Garlic Jr.", "Ginger", "Nikki", "Sansho"],
        keyEvents: [
            "Secuestro del pequeño Gohan debido a la esfera en su gorro",
            "Alianza temporal inédita entre Goku y Piccolo",
            "Garlic Jr. consigue la inmortalidad pero Gohan despierta su poder oculto y lo encierra en la Zona Muerta"
        ],
        newCharacters: ["Garlic Jr.", "Ginger", "Nikki", "Sansho"],
        specialTrivia: "Es la única película de la etapa clásica de DBZ que tiene una continuación directa dentro del relleno de la serie de televisión (la Saga de Garlic Jr., episodios 108-117)."
    },
    m6: {
        id: "m6",
        title: "El Hombre más Fuerte de este Mundo",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 21,
        endEpContext: 35,
        seriesContext: "z",
        chronologyNotes: "Se sitúa hipotéticamente tras el entrenamiento en el Otro Mundo con Kaio-sama, pero asumiendo una realidad alternativa donde los guerreros Z no murieron contra Nappa.",
        antagonists: ["Dr. Wheelo (Dr. Ulo)", "Dr. Kochin", "Bio-guerreros"],
        keyEvents: [
            "Secuestro de Piccolo y el Maestro Roshi",
            "Goku lucha contra los clones y el robot gigante del Dr. Wheelo",
            "Uso del Kaio-ken x3 y lanzamiento de la Genkidama en la atmósfera"
        ],
        newCharacters: ["Dr. Wheelo", "Dr. Kochin", "Ebifurya", "Kishime", "Misokatsun"],
        specialTrivia: "El Dr. Wheelo es uno de los pocos villanos de Dragon Ball que no posee un cuerpo orgánico tradicional, siendo un cerebro gigante alojado en una armadura robótica."
    },
    m7: {
        id: "m7",
        title: "La Super Batalla",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 36,
        endEpContext: 54,
        seriesContext: "z",
        chronologyNotes: "Tiene lugar en una línea temporal alternativa alrededor de la Saga de Namek, con Goku en la Tierra y todos los guerreros sanos.",
        antagonists: ["Turles", "Cacao", "Amond", "Daiz", "Rasin", "Lakasei"],
        keyEvents: [
            "Plantación del destructivo Árbol Sagrado en la Tierra",
            "Turles consume el Fruto del Árbol Sagrado y supera a Goku en combate",
            "Goku recolecta la energía del mismo Árbol para lanzar una Genkidama letal"
        ],
        newCharacters: ["Turles", "Gran Dragón (Icarus)"],
        specialTrivia: "Turles representa la antítesis de Goku: un saiyajin de bajo rango que conservó su crueldad nativa al no sufrir el golpe de cabeza que Goku tuvo de niño."
    },
    m8: {
        id: "m8",
        title: "El Super Guerrero Son Goku",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 55,
        endEpContext: 74,
        seriesContext: "z",
        chronologyNotes: "Ubicada de forma ficticia antes de la llegada de Goku a Namek, mostrando un combate en la Tierra contra la invasión de Lord Slug.",
        antagonists: ["Lord Slug", "Angila", "Wings", "Medamatcha"],
        keyEvents: [
            "Lord Slug rejuvenece con las Esferas del Dragón terrestres",
            "Goku despierta por primera vez el Super Saiyajin Falso (Gijichō Super Saiyajin)",
            "Piccolo se arranca las orejas para que Gohan silbe, debilitando al namekuseijin gigante"
        ],
        newCharacters: ["Lord Slug", "Angila", "Wings"],
        specialTrivia: "El estado de 'Super Saiyajin Falso' se debió a que, en el momento de la producción de la película, Toei Animation aún no conocía el diseño definitivo con cabello dorado que Akira Toriyama presentaría en el manga."
    },
    m9: {
        id: "m9",
        title: "Los Rivales más Poderosos",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 118,
        endEpContext: 122,
        seriesContext: "z",
        chronologyNotes: "Se inserta conceptualmente dentro de los tres años de entrenamiento previo a la llegada de los Androides, justo tras el regreso de Goku como Super Saiyajin.",
        antagonists: ["Cooler", "Salza", "Neiz", "Dore"],
        keyEvents: [
            "Cooler y sus Fuerzas Especiales atacan a los guerreros Z",
            "Goku es herido y Gohan viaja a buscar Semillas del Ermitaño",
            "Goku alcanza la ira del Super Saiyajin y manda a Cooler al Sol con un Kamehameha"
        ],
        newCharacters: ["Cooler (Hermano de Freezer)", "Salza", "Neiz", "Dore"],
        specialTrivia: "Esta película introduce la icónica quinta forma física de Cooler, que a diferencia de Freezer, es una transformación de aumento de masa muscular y coraza metálica."
    },
    m10: {
        id: "m10",
        title: "Los Guerreros de Plata",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 122,
        endEpContext: 123,
        seriesContext: "z",
        chronologyNotes: "Transcurre poco antes de los ataques androides, con los namekuseijins reubicados en el Nuevo Planeta Namek.",
        antagonists: ["Metal Cooler", "Clones Metálicos", "Estrella Gete"],
        keyEvents: [
            "Invasión y esclavización del Nuevo Namek por la Estrella Gete",
            "Goku y Vegeta pelean juntos en Super Saiyajin contra hordas de clones de metal",
            "Destrucción del núcleo orgánico de Cooler dentro de la Estrella Gete"
        ],
        newCharacters: ["Metal Cooler", "Estrella Gete (Big Gete Star)"],
        specialTrivia: "Es la primera vez que vemos a Vegeta pelear junto a Goku en una película en su estado de Super Saiyajin, dando lugar al debate sobre el suministro infinito de energía de la Estrella Gete."
    },
    m11: {
        id: "m11",
        title: "La Batalla de los Tres Super Saiyajins",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 139,
        endEpContext: 140,
        seriesContext: "z",
        chronologyNotes: "Tiene lugar en el transcurso de la Saga de los Androides, tras el despertar de 17 y 18 pero antes del desarrollo definitivo de Cell.",
        antagonists: ["Androide 13", "Androide 14", "Androide 15", "Super Androide 13"],
        keyEvents: [
            "Activación de las computadoras del Dr. Gero bajo tierra",
            "Batalla en los glaciares árticos con Goku, Vegeta y Trunks",
            "Goku absorbe el poder de la Genkidama en estado Super Saiyajin para deshacer al Super Androide 13 de un solo golpe"
        ],
        newCharacters: ["Androide 13", "Androide 14", "Androide 15", "Super Androide 13"],
        specialTrivia: "Presenta el debut del icónico ataque 'Genkidama Super Saiyajin', donde Goku, incapaz de lanzar la esfera por la malicia de su estado, decide absorber el ki puro en su cuerpo."
    },
    m12: {
        id: "m12",
        title: "El Poder Invencible",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 168,
        endEpContext: 169,
        seriesContext: "z",
        chronologyNotes: "Ocurre durante los 10 días de espera previos a los Juegos de Cell, con Gohan y Goku dominando el estado Super Saiyajin Máximo Poder.",
        antagonists: ["Broly (Super Saiyajin Legendario)", "Paragus"],
        keyEvents: [
            "Engaño de Paragus a Vegeta para fundar un nuevo reino saiyajin",
            "Broly pierde el control ante la sola presencia de Goku",
            "Goku unifica la energía de Gohan, Trunks, Piccolo y un reticente Vegeta para penetrar la defense de Broly"
        ],
        newCharacters: ["Broly (Legendario)", "Paragus", "Shamosianos"],
        specialTrivia: "Fue el nacimiento del personaje más popular de las películas, Broly. Su llanto infantil junto a Goku de bebé creó un trauma y rivalidad cósmica que los fanáticos recuerdan hasta hoy."
    },
    m13: {
        id: "m13",
        title: "La Galaxia Corre Peligro",
        era: "Dragon Ball Z",
        canonStatus: "No canónico (Encaja tras la saga de Cell)",
        startEpContext: 194,
        endEpContext: 195,
        seriesContext: "z",
        chronologyNotes: "Perfectamente compatible con el timeline tras la muerte de Goku en los Juegos de Cell y antes del inicio de la preparatoria de Gohan.",
        antagonists: ["Bojack", "Zangya", "Bujin", "Bido", "Kogu"],
        keyEvents: [
            "Torneo Mundial de Artes Marciales de Gyusan Money",
            "Invasión de los piratas espaciales liberados del sello de los Kaio",
            "Gohan alcanza el Super Saiyajin 2 y erradica a la banda de Bojack"
        ],
        newCharacters: ["Bojack", "Zangya", "Bujin", "Bido", "Kogu"],
        specialTrivia: "Es de las pocas películas clásicas donde Goku no asume el papel protagónico activo por estar muerto. Gohan es el héroe absoluto vistiendo las ropas de su padre."
    },
    m14: {
        id: "m14",
        title: "El Regreso del Guerrero Legendario",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 209,
        endEpContext: 210,
        seriesContext: "z",
        chronologyNotes: "Se sitúa poco antes del 25° Torneo de Artes Marciales, con Goten, Trunks y Videl buscando las Esferas del Dragón.",
        antagonists: ["Broly"],
        keyEvents: [
            "Broly despierta del glaciar en la Tierra atraído por el llanto de Goten",
            "Batalla de Gohan contra el retornado demonio legendario",
            "Triple Kamehameha Familiar de Goku, Gohan y Goten para arrojar a Broly al Sol"
        ],
        newCharacters: ["Broly (Segunda batalla)"],
        specialTrivia: "El Kamehameha Familiar cuenta con la aparición espiritual del mismísimo Goku, en una de las escenas más memorables y reproducidas en los videojuegos de la franquicia."
    },
    m15: {
        id: "m15",
        title: "El Combate Final",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 224,
        endEpContext: 225,
        seriesContext: "z",
        chronologyNotes: "Tiene lugar tras la finalización del Torneo Infantil de Artes Marciales, con la Androide 18 cobrando la deuda de Mr. Satán.",
        antagonists: ["Bio-Broly", "Barón Jager Butterbaugh", "Científicos"],
        keyEvents: [
            "Creación de clones genéticos en el laboratorio de Jager",
            "Fuga del lodo del clon mutante de Broly",
            "Trunks, Goten y la Androide 18 erradican la biomasa con agua de mar"
        ],
        newCharacters: ["Bio-Broly"],
        specialTrivia: "Esta película fue muy criticada por los fanáticos debido al diseño derretido y monstruoso de Bio-Broly, el cual dista mucho del guerrero orgulloso de las entregas anteriores."
    },
    m16: {
        id: "m16",
        title: "La Fusión de Goku y Vegeta",
        era: "Dragon Ball Z",
        canonStatus: "No canónico",
        startEpContext: 253,
        endEpContext: 258,
        seriesContext: "z",
        chronologyNotes: "Ubicada en una realidad alternativa paralela a la batalla de Majin Buu, donde Goku y Vegeta están muertos al mismo tiempo en el Otro Mundo.",
        antagonists: ["Janemba", "Super Janemba", "Muertos Vivientes (Dictador)"],
        keyEvents: [
            "Sobrecarga de almas purificadas por la distracción de un ogro",
            "Goku alcanza el SSJ3 contra Janemba pero es superado por su forma final",
            "Vegeta y Goku realizan la danza de fusión dando origen a Gogeta"
        ],
        newCharacters: ["Janemba", "Super Janemba", "Gogeta (SSJ)", "Veku (Fusión fallida)"],
        specialTrivia: "Esta película introduce por primera vez a Gogeta en el anime. El diseño de Janemba y las dimensiones flotantes de cristales de colores la hacen visualmente de las más hermosas."
    },
    m17: {
        id: "m17",
        title: "El Ataque del Dragón",
        era: "Dragon Ball Z",
        canonStatus: "No canónico (Encaja tras la derrota de Buu)",
        startEpContext: 288,
        endEpContext: 289,
        seriesContext: "z",
        chronologyNotes: "Se sitúa cronológicamente en el periodo de paz posterior a la derrota definitiva de Kid Buu y antes del Torneo Mundial 28.",
        antagonists: ["Hildegarn", "Hechicero Hoy"],
        keyEvents: [
            "Liberación del legendario héroe Tapion de la caja de música",
            "Aparición del coloso Hildegarn y su destrucción en la metrópolis",
            "Goku utiliza el Golpe del Dragón (Ryūken) en SSJ3 para erradicar al monstruo"
        ],
        newCharacters: ["Tapion", "Minotia", "Hildegarn", "Hechicero Hoy"],
        specialTrivia: "Brinda una explicación emotiva al origen de la icónica Espada de Trunks del Futuro, la cual le es heredada por Tapion al final de la película."
    },
    m18: {
        id: "m18",
        title: "La Batalla de los Dioses",
        era: "Dragon Ball Z",
        canonStatus: "Canon (Adaptada luego en DB Super)",
        startEpContext: 1,
        endEpContext: 14,
        seriesContext: "super",
        chronologyNotes: "Representa el inicio oficial de la era divina, situado 4 años tras la muerte de Majin Buu. Adaptada posteriormente en los episodios 1 al 14 de Dragon Ball Super.",
        antagonists: ["Beerus (Bills)"],
        keyEvents: [
            "Despertar del Dios de la Destrucción Beerus en busca del Super Saiyajin Dios",
            "Ritual de los seis Saiyajins de corazón puro en la Tierra",
            "Goku alcanza el ki divino (Super Saiyajin Dios de cabello rojo)"
        ],
        newCharacters: ["Beerus (Bills)", "Whis", "Pez Oráculo"],
        specialTrivia: "Fue la primera película teatral de Dragon Ball producida en 17 años (lanzada en 2013). La creación del ki divino rejuveneció por completo el interés en la franquicia."
    },
    m19: {
        id: "m19",
        title: "La Resurrección de 'F'",
        era: "Dragon Ball Z",
        canonStatus: "Canon (Adaptada luego en DB Super)",
        startEpContext: 15,
        endEpContext: 27,
        seriesContext: "super",
        chronologyNotes: "Tiene lugar tras el entrenamiento con Whis, adaptada posteriormente en la Saga de la Resurrección de Freezer de Dragon Ball Super (episodios 15-27).",
        antagonists: ["Freezer", "Sorbet", "Tagoma", "Shisami"],
        keyEvents: [
            "Resurrección del tirano Freezer mediante las Esferas de la Tierra",
            "Invasión del ejército de Freezer en la capital",
            "Goku y Vegeta revelan el Super Saiyajin Blue frente a la forma Golden de Freezer"
        ],
        newCharacters: ["Jaco el Patrullero Galáctico", "Golden Freezer", "Sorbet"],
        specialTrivia: "Esta película marca la introducción oficial del estado 'Super Saiyajin Dios Super Saiyajin' (SSGSS), comúnmente llamado Super Saiyajin Blue."
    },
    m20: {
        id: "m20",
        title: "Dragon Ball Super: Broly",
        era: "Dragon Ball Super",
        canonStatus: "Totalmente Canon",
        startEpContext: 131,
        endEpContext: 131,
        seriesContext: "super",
        chronologyNotes: "Transcurre inmediatamente después de la culminación del Torneo del Poder (episodio 131) y reescribe de forma oficial el origen de Broly y Gogeta.",
        antagonists: ["Broly", "Freezer", "Paragus"],
        keyEvents: [
            "Revelación de la historia original del Planeta Vegeta y la madre de Goku, Gine",
            "Encuentro en el ártico y asimilación de la fuerza adaptativa de Broly",
            "Fusión canónica de Gogeta en Super Saiyajin Blue"
        ],
        newCharacters: ["Gine (Madre de Goku)", "Cheelai", "Lemo", "Beets", "Kikono"],
        specialTrivia: "Escrita y supervisada en detalle por Akira Toriyama. Es la película más taquillera en la historia de toda la franquicia, recaudando más de 120 millones de dólares a nivel mundial."
    },
    m21: {
        id: "m21",
        title: "Dragon Ball Super: Super Hero",
        era: "Dragon Ball Super",
        canonStatus: "Totalmente Canon",
        startEpContext: 131,
        endEpContext: 131,
        seriesContext: "super",
        chronologyNotes: "Se sitúa temporalmente un par de años tras la película de Broly, con Gohan y Piccolo asumiendo la vanguardia defensiva en la Tierra.",
        antagonists: ["Cell Max", "Dr. Hedo", "Magenta", "Carmine", "Gamma 1", "Gamma 2"],
        keyEvents: [
            "Resurgimiento de la Patrulla Roja y secuestro estratégico de Pan",
            "Piccolo obtiene la transformación Orange Piccolo otorgada por Shenlong",
            "Gohan despierta el poder definitivo Gohan Bestia (Beast) tras ver el aparente sacrificio de Piccolo"
        ],
        newCharacters: ["Gamma 1", "Gamma 2", "Dr. Hedo", "Cell Max", "Orange Piccolo", "Gohan Bestia"],
        specialTrivia: "Es la primera película de Dragon Ball realizada casi en su totalidad usando animación CGI 3D. El diseño de Gohan Bestia cuenta con el cabello blanco y ojos rojos."
    },
    sp1: {
        id: "sp1",
        title: "La Batalla de Freezer Contra el Padre de Goku",
        era: "Especiales y OVAs",
        canonStatus: "Canon (Eventos generales y Bardock)",
        startEpContext: 1,
        endEpContext: 1,
        seriesContext: "original",
        chronologyNotes: "Sirve de precuela absoluta a toda la historia de Dragon Ball, ocurriendo el día en que el Planeta Vegeta fue destruido por Freezer.",
        antagonists: ["Freezer", "Dodoria", "Zarbon", "Soldados de Freezer"],
        keyEvents: [
            "Conquista del planeta Kanassa y maldición de premonición para Bardock",
            "Asesinato del escuadrón de Bardock por orden de Freezer",
            "Intento desesperado de Bardock de atacar la nave de Freezer antes de la supernova"
        ],
        newCharacters: ["Bardock", "Toma", "Selypar", "Poteit", "Shugesh"],
        specialTrivia: "Bardock fue creado originalmente por el equipo de guionistas de Toei Animation para este especial. Su diseño gustó tanto a Akira Toriyama que decidió dibujarlo en el manga oficial de Dragon Ball."
    },
    sp2: {
        id: "sp2",
        title: "Un Futuro Diferente: Gohan y Trunks",
        era: "Especiales y OVAs",
        canonStatus: "Canon (Línea temporal alternativa de Trunks)",
        startEpContext: 118,
        endEpContext: 118,
        seriesContext: "z",
        chronologyNotes: "Muestra los eventos de la línea de tiempo alternativa de Trunks del Futuro, ocurriendo antes de su viaje en la máquina del tiempo.",
        antagonists: ["Androide 17 (Futuro)", "Androide 18 (Futuro)"],
        keyEvents: [
            "Entrenamiento de Trunks bajo la guía de Gohan con un solo brazo",
            "Muerte heroica de Gohan del Futuro en combate solitario contra los Androides",
            "Despertar del Super Saiyajin en Trunks por el trauma y dolor de ver el cadáver de su maestro"
        ],
        newCharacters: ["Gohan del Futuro", "Bulma del Futuro"],
        specialTrivia: "Este especial de TV es ampliamente recordado por su atmósfera oscura, trágica e impregnada de desesperanza, destacando el tema musical instrumental del violín en el clímax."
    },
    sp3: {
        id: "sp3",
        title: "100 Años Después",
        era: "Especiales y OVAs",
        canonStatus: "No canónico (Epílogo de Dragon Ball GT)",
        startEpContext: 64,
        endEpContext: 64,
        seriesContext: "gt",
        chronologyNotes: "Transcurre un siglo después del final de Dragon Ball GT (episodio 64), sirviendo de epílogo formal para esta etapa.",
        antagonists: ["Lord Yao", "Demonios locales"],
        keyEvents: [
            "Enfermedad de la anciana Pan y búsqueda de Goku Jr. de la Esfera de cuatro estrellas",
            "Goku Jr. supera sus miedos y se transforma en Super Saiyajin ante el ataque del oso-demonio",
            "Aparición del espíritu del tatarabuelo Goku para entregarle el báculo sagrado"
        ],
        newCharacters: ["Goku Jr.", "Puck", "Lord Yao"],
        specialTrivia: "El báculo sagrado y la esfera de cuatro estrellas en la cabaña del Monte Paozu representan las reliquias más queridas de la infancia de Goku."
    }
}

export const TMDB_TO_LORE_MOVIE_MAP: Record<number, string> = {
    // Clásicas
    39144: "m1",
    33499: "m2",
    39145: "m3",
    116776: "m4",

    // Z
    28609: "m5",
    15448: "m6",
    39100: "m7",
    39101: "m8",
    39102: "m9",
    24752: "m10",
    15452: "m11",
    39103: "m12",
    39104: "m13",
    15454: "m14",
    34433: "m15",
    39105: "m16",
    44251: "m17",
    177572: "m18",
    303857: "m19",

    // Super
    503314: "m20",
    610150: "m21",

    // Especiales
    39323: "sp1",
    39324: "sp2",
    38594: "sp3",
}

