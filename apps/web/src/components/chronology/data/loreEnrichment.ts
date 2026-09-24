export interface VolumeLoreEnrichment {
  volumeId: string;
  fillerEpisodes: number[];
  previouslyOn: string;
  quickCatchUpKeys: string[];
  recommendedStartEpisode?: number;
}

export const LORE_ENRICHMENT_BY_VOLUME: Record<string, VolumeLoreEnrichment> = {
  'vol-clasico-origen': {
    volumeId: 'vol-clasico-origen',
    fillerEpisodes: [],
    previouslyOn:
      'Goku es un niño huérfano con cola de mono que vive en soledad en la remota Montaña Paoz tras la muerte de su abuelo adoptivo, Son Gohan. Goku atesora como único recuerdo la misteriosa esfera de cristal de 4 estrellas dejada por su abuelo, desconociendo por completo que forma parte de un conjunto mágico legendario.',
    quickCatchUpKeys: [
      'Goku conoce a Bulma e inician el mito fundacional de la búsqueda de las 7 Esferas del Dragón.',
      'El Maestro Roshi regala la Nube Voladora y enseña por primera vez el legendario Kamehameha.',
      'Se revela la maldición de la sangre Saiyajin: la transformación en Oozaru gigante ante la luna llena.',
      'Nace la amistad fraternal e inquebrantable entre Goku y Krilin durante el entrenamiento con caparazones.',
      "Jackie Chun (el Maestro Roshi disfrazado) le enseña a Goku que 'siempre hay alguien superior en el mundo'.",
    ],
    recommendedStartEpisode: 1,
  },
  'vol-clasico-redribbon': {
    volumeId: 'vol-clasico-redribbon',
    fillerEpisodes: [29, 30, 31, 32, 44, 45, 79, 80, 81, 82],
    previouslyOn:
      'Tras el 21° Torneo de las Artes Marciales, Goku se despide de Roshi y Krilin para viajar por el mundo en busca de la esfera de 4 estrellas de su abuelo, prometiendo reunirse dentro de tres años para el próximo gran campeonato.',
    quickCatchUpKeys: [
      'Goku destruye en solitario la armada paramilitar más temida del planeta: el Ejército Red Ribbon.',
      'Aparición del Maestro Karin, la Torre sagrada y el agua ultra divina que despierta la agilidad.',
      'Presentación del Androide Número 8 (Octavio) y el peligro letal del asesino Tao Pai Pai.',
      'El emotivo combate contra el guerrero enmascarado en el palacio de Uranai Baba resulta ser su difunto Abuelo Gohan.',
    ],
    recommendedStartEpisode: 33,
  },
  'vol-clasico-piccolo': {
    volumeId: 'vol-clasico-piccolo',
    fillerEpisodes: [127, 128, 129, 130, 131, 132, 149, 150, 151, 152, 153],
    previouslyOn:
      'Tras resucitar al padre de Upa, Goku entrena por los confines del mundo hasta reencontrarse con sus amigos en el 22° Torneo de Artes Marciales, donde conoce la rivalidad letal y despiadada de la Escuela Grulla comandada por Tenshinhan.',
    quickCatchUpKeys: [
      'Tenshinhan y Chaos abandonan el camino del mal para unirse a los valores de la Escuela Tortuga.',
      'Piccolo Daimaku rompe la inocencia del universo asesinando a Krilin, Shenlong y al Maestro Roshi.',
      'Goku bebe el Agua de los Dioses y atraviesa el pecho del Rey Demonio con el Puño del Dragón.',
      'Goku entrena 3 años en el Templo Sagrado de Kami-sama, madura físicamente y vence a Piccolo Jr. coronándose campeón mundial.',
    ],
    recommendedStartEpisode: 83,
  },
  'vol-saiyan-choque': {
    volumeId: 'vol-saiyan-choque',
    fillerEpisodes: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    previouslyOn:
      'Cinco años de paz reinaron en la Tierra tras la boda de Goku y Milk. El nacimiento de su hijo Son Gohan marca una era de tranquilidad familiar en el Monte Paoz, hasta que una extraña cápsula espacial aterriza con un guerrero despiadado portando cola saiyajin.',
    quickCatchUpKeys: [
      'Se revela el origen alienígena de Goku: su verdadero nombre es Kakarotto y pertenece a la raza guerrera Saiyajin.',
      'Sacrificio conjunto de Goku y Piccolo para derrotar a Raditz mediante el Makankosappo.',
      'Piccolo adopta a Gohan como su pupilo en el desierto, forjando el vínculo más conmovedor de la saga.',
      'Goku recorre el Camino de la Serpiente y domina el Kaio-ken y la Genkidama con Kaio-sama.',
      'Choque legendario de Kamehameha x4 contra el Galick Ho de Vegeta en el desierto rocoso.',
    ],
    recommendedStartEpisode: 1,
  },
  'vol-freezer-ssj': {
    volumeId: 'vol-freezer-ssj',
    fillerEpisodes: [39, 40, 41, 42, 43, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117],
    previouslyOn:
      'La batalla contra los Saiyajin dejó a la Tierra sin esferas del dragón debido a la muerte de Piccolo y Kami-sama. Bulma, Krilin y Gohan despegan en la nave espacial rumbo al lejano Planeta Namek con la esperanza de utilizar las esferas originales y revivir a sus camaradas.',
    quickCatchUpKeys: [
      'Aparición de Freezer como el emperador cósmico despiadado y responsable del genocidio del Planeta Vegeta.',
      'Vegeta actúa como antihéroe solitario asesinando a los lugartenientes de Freezer en las sombras.',
      'Llegada de las Fuerzas Especiales Ginyu y la crisis del intercambio de cuerpos.',
      'El asesinato de Krilin desata la profecía milenaria: Goku se transforma en Super Saiyajin.',
      'El colapso de Namek y el duelo de los 5 minutos más legendarios de la historia de la animación.',
    ],
    recommendedStartEpisode: 44,
  },
  'vol-cell-trunks': {
    volumeId: 'vol-cell-trunks',
    fillerEpisodes: [125],
    previouslyOn:
      'Un año después de la explosión de Namek, Freezer sobrevive cibernéticamente y llega a la Tierra junto a su padre King Cold buscando venganza. Un misterioso joven llegado del futuro empuñando una espada los extermina en segundos y advierte a Goku de una amenaza bio-tecnológica inminente.',
    quickCatchUpKeys: [
      'Trunks del Futuro advierte sobre la enfermedad cardíaca de Goku y la aniquilación de los Guerreros Z por los androides.',
      'El Dr. Gero activa a los Androides 17 y 18 y el bio-androide Cell emerge de una línea temporal alterna.',
      'Piccolo se fusiona permanentemente con Kami-sama renaciendo como el Super Namekiano definitivo.',
      'Entrenamiento en la Habitación del Tiempo: Vegeta y Trunks rompen los límites del Super Saiyajin ordinario.',
    ],
    recommendedStartEpisode: 118,
  },
  'vol-cell-games': {
    volumeId: 'vol-cell-games',
    fillerEpisodes: [170, 171, 174, 195, 196, 197, 198, 199],
    previouslyOn:
      'Cell ha absorbido exitosamente a Número 18 alcanzando su forma perfecta. Para demostrar su superioridad absoluta, anuncia ante los medios del mundo entero la apertura de los Cell Games: un torneo marcial donde si ningún guerrero logra vencerlo, la Tierra entera será obliterada.',
    quickCatchUpKeys: [
      'Goku y Gohan dominan el Super Saiyajin Full Power como estado natural y relajado.',
      'Goku se rinde ante Cell y cede su lugar a su hijo Gohan, apostando todo a su poder latente.',
      'La destrucción del Androide 16 detona la legendaria ira de Gohan y el despertar del Super Saiyajin 2.',
      'Goku se sacrifica teletransportando a Cell; Gohan destruye al monstruo con el Kamehameha Padre-Hijo.',
    ],
    recommendedStartEpisode: 166,
  },
  'vol-buu-caos': {
    volumeId: 'vol-buu-caos',
    fillerEpisodes: [202, 203, 204, 287, 288],
    previouslyOn:
      'Han transcurrido siete años desde el sacrificio de Goku. La Tierra vive en paz, Gohan asiste a la preparatoria como el Gran Saiyaman y Goku recibe un permiso especial de 24 horas del Más Allá para participar en el 25° Torneo de las Artes Marciales junto a su nuevo hijo Goten.',
    quickCatchUpKeys: [
      'Vegeta se deja poseer por Babidi para recuperar su orgullo saiyajin y retar a Goku a su duelo predestinado.',
      'El épico sacrificio de Majin Vegeta desatando la Gran Explosión para proteger a Trunks y Bulma.',
      'Goku revela el estruendoso Super Saiyajin 3 y enseña la Danza de la Fusión a Goten y Trunks.',
      'Nace la fusión definitiva de los Pendientes Pothala: Vegetto humilla por completo a Super Buu.',
      'La Genkidama Universal creada con la energía de toda la Tierra con la ayuda de Mr. Satán destruye a Kid Buu.',
    ],
    recommendedStartEpisode: 200,
  },
  'vol-daima-reino': {
    volumeId: 'vol-daima-reino',
    fillerEpisodes: [],
    previouslyOn:
      'Tras la aniquilación de Majin Buu y la restauración de la paz en la Tierra, el Reino de los Demonios sufre un violento vacío de poder tras la muerte del Rey Dabura. Desde el Reino Oscuro, el nuevo Rey Gomah y la hechicera Arinsu traman una conspiración usando las esferas del dragón demoníacas.',
    quickCatchUpKeys: [
      'El Rey Gomah utiliza las Esferas del Dragón del Reino de las Tinieblas para transformar a los Guerreros Z en niños pequeños.',
      'Goku, el Supremo Kaioshin y los misteriosos viajeros Glorio y Panzy se adentran en los Tres Mundos Demoníacos.',
      'Goku recupera el uso acrobático de su báculo sagrado (Nyoibo) para compensar su tamaño infantil en combates de alta agilidad.',
      'Se desvelan secretos ancestrales sobre la raza de los Glind y el origen primigenio del linaje de los Kaioshin.',
    ],
    recommendedStartEpisode: 1,
  },
  'vol-super-dioses': {
    volumeId: 'vol-super-dioses',
    fillerEpisodes: [],
    previouslyOn:
      'Varios años tras la derrota de Majin Buu, el temible Dios de la Destrucción Bills despierta de un sueño de décadas tras profetizar la aparición de un rival legendario: el Super Saiyajin Dios.',
    quickCatchUpKeys: [
      'El ritual de los seis saiyajin de corazón virtuoso despierta el ki divino dando origen al Super Saiyajin Dios.',
      'Goku y Vegeta viajan a entrenar bajo la tutela del Ángel Whis en el planeta de Bills.',
      'Freezer es resucitado por Sorbet mediante las esferas terrestres y entrena por primera vez alcanzando la forma Golden.',
      'Goku y Vegeta estrenan el Super Saiyajin Blue (SSGSS) para erradicar definitivamente al tirano espacial.',
    ],
    recommendedStartEpisode: 1,
  },
  'vol-super-black': {
    volumeId: 'vol-super-black',
    fillerEpisodes: [42, 43, 44, 45, 46, 68, 69, 70, 71, 72, 73, 74, 75, 76],
    previouslyOn:
      'Tras el torneo entre los Universos 6 y 7 organizado por Bills y Champa, una maltrecha máquina del tiempo aterriza en el jardín de Capsule Corp: Trunks del Futuro regresa huyendo de un destructor implacable que viste los ropajes de Son Goku.',
    quickCatchUpKeys: [
      'Goku combina el Super Saiyajin Blue con el Kaio-ken x10 frente al Salto Temporal del sicario Hit.',
      'Se presenta a Zeno-sama, gobernante absoluto de la totalidad del multiverso.',
      'El aprendiz de Kaioshin Zamasu se corrompe por su odio a los mortales y roba el cuerpo de Goku usando las Super Esferas.',
      'Regreso legendario de Vegetto Blue con el Final Kamehameha contra la divinidad corrupta de Zamasu.',
    ],
    recommendedStartEpisode: 47,
  },
  'vol-super-torneo': {
    volumeId: 'vol-super-torneo',
    fillerEpisodes: [],
    previouslyOn:
      'Zeno-sama convoca el Gran Torneo de la Fuerza entre los 8 universos de menor desarrollo mortal. La regla suprema no deja margen de error: cualquier universo cuyos 10 participantes caigan de la plataforma será borrado de la realidad instantáneamente.',
    quickCatchUpKeys: [
      'El Universo 7 recluta un equipo insólito que incluye a los Androides 17 y 18, al Maestro Roshi y a Freezer liberado del infierno.',
      'Jiren del Universo 11 demuestra una fuerza inabarcable que supera con creces el poder de los Dioses de la Destrucción.',
      'Goku rompe su propio cascarón mental y despierta la técnica divina por excelencia: la Doctrina Egoísta (Ultra Instinto).',
      'Goku y Freezer protagonizan una de las cargas combinadas más épicas del anime para derribar a Jiren.',
      'El Androide 17 se alza vencedor y utiliza las Super Esferas del Dragón para restaurar la totalidad de universos borrados.',
    ],
    recommendedStartEpisode: 77,
  },
  'dbs-copy-vegeta': {
    volumeId: 'dbs-copy-vegeta',
    fillerEpisodes: [42, 43, 44, 45, 46],
    previouslyOn:
      'Tras el torneo contra el Universo 6 y la celebración con Monaka, Goten y Trunks terminan accidentalmente en el Planeta Pot-au-feu.',
    quickCatchUpKeys: [
      'El Agua Sobrenatural absorbe el poder y la identidad de Vegeta.',
      'Goku combate contra Vegeta Copia en Super Saiyajin Blue.',
      'Monaka destruye accidentalmente el núcleo del monstruo salvando a Vegeta.',
    ],
    recommendedStartEpisode: 44,
  },
  'dbs-exhibicion-zen': {
    volumeId: 'dbs-exhibicion-zen',
    fillerEpisodes: [],
    previouslyOn:
      'Goku visita a Zeno-sama recordando el torneo prometido, sin anticipar que el Gran Sacerdote anunciaría la aniquilación de los universos perdedores.',
    quickCatchUpKeys: [
      'El Torneo de Exhibición Todo enfrenta al Universo 7 contra el Universo 9.',
      'Se confirma que los universos eliminados serán destruidos sin excepción.',
      'Toppo del Universo 11 revela la existencia y supremacía de Jiren.',
    ],
    recommendedStartEpisode: 77,
  },
  'vol-gt-viaje': {
    volumeId: 'vol-gt-viaje',
    fillerEpisodes: [],
    previouslyOn:
      'Diez años después del 28° Torneo donde Goku partió a entrenar a la reencarnación de Buu (Oob), el anciano Emperador Pilaf logra infiltrarse en lo alto del Palacio Celestial descubriendo las peligrosas Esferas del Dragón de Estrella Negra.',
    quickCatchUpKeys: [
      'Un deseo erróneo de Pilaf transforma a Goku en un niño, obligando a recolectar las esferas por la galaxia antes de 1 año.',
      'Goku, Trunks y Pan viajan en la nave Tako conociendo a Gill y enfrentando las maquinaciones del Dr. Myu.',
      'Baby, último superviviente de la civilización Tsufuru, posee el cuerpo de Vegeta e infecta a toda la humanidad.',
      'Goku alcanza el primitivo y salvaje Super Saiyajin 4 tras recordar a su familia bajo la forma de Oozaru Dorado.',
      'La sobreutilización de las esferas desata a los 7 Dragones Malignos; Gogeta SSJ4 derrota a Omega Shenlong.',
      'Goku se fusiona con Shenlong y se despide de sus amigos para vigilar la Tierra como el guardián eterno.',
    ],
    recommendedStartEpisode: 1,
  },
};

export function getVolumeLoreEnrichment(volumeId: string): VolumeLoreEnrichment | undefined {
  return LORE_ENRICHMENT_BY_VOLUME[volumeId];
}
