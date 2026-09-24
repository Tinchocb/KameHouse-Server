export type InterludeGapScale = 'continuo' | 'dias' | 'meses' | 'anios';

export type InterludeKind =
  | 'time-jump'
  | 'training'
  | 'cosmic-event'
  | 'paradox'
  | 'context'
  | 'transition';

export interface ChronologyInterlude {
  id: string;
  fromVolumeId: string;
  /** null = epílogo tras el último lapso */
  toVolumeId: string | null;
  gap: { label: string; scale: InterludeGapScale };
  kind: InterludeKind;
  title: string;
  /** 1–2 frases, siempre visible */
  summary: string;
  /** "Mientras tanto…": hechos fuera de pantalla */
  offscreen?: string[];
  /** claves de DRAGON_BALL_MOVIES_LORE que caen en este hueco */
  movieIds?: string[];
}

/**
 * Un interludio por cada par consecutivo en orden in-universe (34) más un
 * epílogo final. El orden in-universe lo define `compareInUniverse`:
 * Clásico → Z (hasta Kid Buu, 774) → Daima (774–775) → Super (778–780) → GT (789+).
 *
 * El texto reutiliza `TIMELINE_MILESTONES` (volumes.ts), los `previouslyOn`
 * de los spans y las `chronologyNotes` de las películas.
 */
export const CHRONOLOGY_INTERLUDES: ChronologyInterlude[] = [
  {
    id: 'il-pilaf-torneo-21',
    fromVolumeId: 'db-pilaf',
    toVolumeId: 'db-torneo-21',
    gap: { label: '+8 meses', scale: 'meses' },
    kind: 'training',
    title: 'Leche, caparazón y Kame House',
    summary:
      'Las esferas se vuelven piedra durante un año y Goku se queda a entrenar con Roshi junto a Krilin: repartir leche al amanecer, arar con el caparazón a la espalda y dominar el Kamehameha.',
    offscreen: [
      'Bulma vuelve a la ciudad con Yamcha, Oolong y Puar mientras el radar queda mudo un año.',
      'Roshi impone su método: madrugones, reparto de leche y trabajo de campo antes de enseñar artes marciales.',
    ],
    movieIds: ['m2'],
  },
  {
    id: 'il-torneo-21-red-ribbon',
    fromVolumeId: 'db-torneo-21',
    toVolumeId: 'db-red-ribbon',
    gap: { label: 'Mismo día', scale: 'continuo' },
    kind: 'transition',
    title: 'La esfera del abuelo',
    summary:
      'Nada más terminar el torneo, Goku parte solo en la Nube Voladora a buscar la esfera de cuatro estrellas de su abuelo Son Gohan.',
    offscreen: [
      'Krilin y Roshi se quedan en Kame House; el radar de Bulma vuelve a detectar señales al cumplirse el año.',
    ],
  },
  {
    id: 'il-red-ribbon-uranai-baba',
    fromVolumeId: 'db-red-ribbon',
    toVolumeId: 'db-uranai-baba',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'transition',
    title: 'La última esfera no aparece',
    summary:
      'El Cuartel General cae, pero Goku solo reúne seis esferas: la última no sale en el radar porque Pilaf la esconde en una cápsula aislante, así que acuden a la adivina Uranai Baba.',
    offscreen: [
      'Upa espera enterrar a Bora; sin la séptima esfera no hay deseo que lo reviva.',
      'Pilaf y su banda sobreviven al derrumbe y guardan la esfera robada en secreto.',
    ],
    movieIds: ['m3', 'm4'],
  },
  {
    id: 'il-uranai-baba-torneo-22',
    fromVolumeId: 'db-uranai-baba',
    toVolumeId: 'db-torneo-22',
    gap: { label: '+3 años', scale: 'anios' },
    kind: 'training',
    title: 'Tres años a pie por el mundo',
    summary:
      'Tras la primera dispersión de las esferas, Goku recorre el mundo a pie para perfeccionar su cuerpo, mientras Tenshinhan y Chaoz se forman con la escuela Grulla del maestro Tsuru.',
    offscreen: [
      'Krilin y Yamcha entrenan en Kame House para el próximo campeonato.',
      'La escuela Grulla impone su ideología: ganar a cualquier precio frente al estilo Tortuga.',
    ],
  },
  {
    id: 'il-torneo-22-piccolo-daimaku',
    fromVolumeId: 'db-torneo-22',
    toVolumeId: 'db-piccolo-daimaku',
    gap: { label: 'Mismo día', scale: 'continuo' },
    kind: 'transition',
    title: 'Asesinan a Krilin',
    summary:
      'Minutos después de la premiación, Krilin aparece muerto en los vestuarios y la esfera robada señala al Rey Demonio: Piccolo Daimaoh ha sido liberado.',
    offscreen: [
      'Tambourine ejecuta la purga de artistas marciales por orden de Piccolo.',
      'Roshi reconoce el sello «Ma» y comprende que el mal antiguo ha vuelto.',
    ],
  },
  {
    id: 'il-piccolo-daimaku-piccolo-jr',
    fromVolumeId: 'db-piccolo-daimaku',
    toVolumeId: 'db-piccolo-jr',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'training',
    title: 'El último huevo y el Templo de Kamisama',
    summary:
      'Piccolo Daimaoh expulsa su último huevo antes de morir: nace Piccolo Jr. Goku sube al Templo de Kamisama y entrena tres años con Mr. Popo para el 23° Torneo.',
    offscreen: [
      'Shenlong fue asesinado por Piccolo; sin dragón no hay resurrecciones hasta que Kamisama restaura las esferas.',
      'Karin revela el camino al Templo y el Agua Ultra Sagrada deja a Goku al borde de la muerte.',
    ],
  },
  {
    id: 'il-piccolo-jr-saiyajin-raditz',
    fromVolumeId: 'db-piccolo-jr',
    toVolumeId: 'dbz-saiyajin-raditz',
    gap: { label: '+5 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Boda, Gohan y el origen saiyajin',
    summary:
      'Goku vence a Piccolo Jr., se casa con Milk y nace Son Gohan. La Tierra vive cinco años de paz ignorando que Kakarotto es un saiyajin y que el Planeta Vegeta fue destruido por Freezer.',
    offscreen: [
      'Piccolo se aísla a entrenar en páramos desiertos, rumiando su derrota.',
      'En el espacio, Vegeta y Nappa siguen saqueando planetas a las órdenes de Freezer.',
    ],
    movieIds: ['sp1', 'm5'],
  },
  {
    id: 'il-raditz-vegeta',
    fromVolumeId: 'dbz-saiyajin-raditz',
    toVolumeId: 'dbz-saiyajin-vegeta',
    gap: { label: '+1 año', scale: 'anios' },
    kind: 'training',
    title: 'El Camino de la Serpiente y el niño solo',
    summary:
      'Muerto tras el sacrificio contra Raditz, Goku corre el millón de kilómetros del Camino de la Serpiente hasta Kaio-sama y aprende el Kaioken y la Genkidama, mientras Piccolo deja a Gohan solo en el desierto para que sobreviva.',
    offscreen: [
      'Krilin, Yamcha, Tenshinhan, Chaoz y Yajirobe entrenan con Kamisama en el Templo.',
      'Nappa y Vegeta viajan hacia la Tierra con un año de ventaja.',
    ],
    movieIds: ['m6'],
  },
  {
    id: 'il-vegeta-namek-viaje',
    fromVolumeId: 'dbz-saiyajin-vegeta',
    toVolumeId: 'dbz-namek-viaje',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'training',
    title: 'Hospitalizado y rumbo a Namek',
    summary:
      'Goku queda hospitalizado tras el Kaioken x4 y, al recordar que Piccolo venía de Namek, Bulma, Krilin y Gohan parten al planeta en la nave de Kamisama mientras Goku entrena a gravedad x100 en su propia nave.',
    offscreen: [
      'Durante seis días de vuelo, Goku encadena Zenkais con Semillas del Ermitaño bajo gravedad extrema.',
      'En Namek, Freezer ya caza las esferas con Zarbon, Dodoria y las Fuerzas Ginyu en camino.',
    ],
    movieIds: ['m7', 'm8'],
  },
  {
    id: 'il-namek-viaje-ginyu-freezer',
    fromVolumeId: 'dbz-namek-viaje',
    toVolumeId: 'dbz-namek-ginyu-freezer',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'Llegan las Fuerzas Ginyu',
    summary:
      'Justo cuando Vegeta roba esferas por su cuenta, aterrizan las Fuerzas Especiales Ginyu y la carrera por Polunga se vuelve una guerra de tres bandos.',
    offscreen: [
      'Frieza encarga a Ginyu las esferas mientras Dende guía a Krilin y Gohan con el Gran Anciano.',
    ],
  },
  {
    id: 'il-ginyu-freezer-freezer-ssj',
    fromVolumeId: 'dbz-namek-ginyu-freezer',
    toVolumeId: 'dbz-freezer-super-saiyajin',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'Goku sale de la cápsula y Dende se une',
    summary:
      'Goku sale curado de la cámara médica y pisa el campo final mientras Dende se une al grupo para curar a los guerreros frente a la forma final de Freezer.',
    offscreen: [
      'Vegeta, humillado y moribundo, llora su orgullo saiyajin y pide a Goku que lo vengue.',
      'Piccolo revive gracias a Polunga y llega fusionado con Nail.',
    ],
  },
  {
    id: 'il-freezer-ssj-garlic-jr',
    fromVolumeId: 'dbz-freezer-super-saiyajin',
    toVolumeId: 'dbz-garlic-jr',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'context',
    title: 'Namek explota: Yardrat y la resurrección',
    summary:
      'Namek explota y Goku desaparece en el espacio hasta llegar a Yardrat, donde aprende la Teletransportación, mientras los namekianos son revividos en la Tierra con las esferas.',
    offscreen: [
      'Krilin y Yamcha vuelven a la vida; los namekianos emigran al Nuevo Namek.',
      'Goku rechaza volver de inmediato y se queda a entrenar con los yardratianos.',
    ],
  },
  {
    id: 'il-garlic-jr-androides-trunks',
    fromVolumeId: 'dbz-garlic-jr',
    toVolumeId: 'dbz-androides-trunks',
    gap: { label: '+3 años', scale: 'anios' },
    kind: 'paradox',
    title: 'La advertencia del 12 de mayo',
    summary:
      'Trunks decapita a Mecha Freezer, entrega a Goku la medicina del corazón y avisa: en tres años, el 12 de mayo a las 9:00, aparecerán los androides. Contexto: viene de un futuro donde Goku muere y 17 y 18 lo arrasan todo.',
    offscreen: [
      'Los Guerreros Z entrenan tres años sin pausa para la fecha señalada.',
      'Bulma halla una segunda máquina del tiempo cubierta de musgo con un cascarón biomecánico: Cell ya viajó al pasado.',
    ],
    movieIds: ['m9', 'm10', 'sp2'],
  },
  {
    id: 'il-androides-cell-imperfecto',
    fromVolumeId: 'dbz-androides-trunks',
    toVolumeId: 'dbz-cell-imperfecto-perfeccion',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'Goku enfermo y Cell escapa',
    summary:
      'El virus del corazón tumba a Goku en plena batalla y, entre la confusión, Cell emerge de su cáscara y huye a absorber a 17 y 18.',
    offscreen: [
      'Piccolo se fusiona con Kamisama y las esferas se apagan temporalmente.',
      'Vegeta y Trunks entran a la Sala del Espíritu y el Tiempo por turnos.',
    ],
    movieIds: ['m11'],
  },
  {
    id: 'il-cell-imperfecto-juegos-cell',
    fromVolumeId: 'dbz-cell-imperfecto-perfeccion',
    toVolumeId: 'dbz-juegos-de-cell',
    gap: { label: '10 días', scale: 'dias' },
    kind: 'training',
    title: 'Diez días: la Sala del Tiempo',
    summary:
      'Cell da diez días de plazo y anuncia su torneo por televisión. Goku y Gohan salen de la Sala del Espíritu y el Tiempo con el Super Saiyajin Full Power como estado natural.',
    offscreen: [
      'Dende llega del Nuevo Namek como nuevo Kamisama y reactiva las esferas con dos deseos.',
      'El ejército mundial fracasa contra Cell y Mr. Satán se proclama campeón antes de empezar.',
    ],
    movieIds: ['m12'],
  },
  {
    id: 'il-juegos-cell-otro-mundo',
    fromVolumeId: 'dbz-juegos-de-cell',
    toVolumeId: 'dbz-torneo-otro-mundo',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'transition',
    title: 'Goku se queda en el Otro Mundo',
    summary:
      'Tras sacrificarse con la Teletransportación, Goku decide no revivir para no atraer más amenazas y se queda a entrenar en el Más Allá junto a Kaio-sama.',
    offscreen: [
      'La Tierra celebra a Mr. Satán como salvador mientras los guerreros guardan luto en silencio.',
      'Kaio-sama, muerto en la explosión, sigue entrenando a Goku en su pequeño planeta.',
    ],
    movieIds: ['m13'],
  },
  {
    id: 'il-otro-mundo-buu-majin-vegeta',
    fromVolumeId: 'dbz-torneo-otro-mundo',
    toVolumeId: 'dbz-buu-majin-vegeta',
    gap: { label: '+7 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Goten y el Gran Saiyaman',
    summary:
      'Goku no resucita para proteger la Tierra. Nace Goten y Gohan entra a la preparatoria Orange Star como el Gran Saiyaman hasta que Goku obtiene 24 horas de permiso para el 25° Torneo.',
    offscreen: [
      'Videl descubre la identidad de Gohan y aprende a volar con Ki.',
      'El mago Babidi y Dabura viajan a la Tierra a drenar energía para despertar a Majin Buu.',
    ],
    movieIds: ['m14', 'm15'],
  },
  {
    id: 'il-buu-majin-vegeta-buu-ssj3-fusion',
    fromVolumeId: 'dbz-buu-majin-vegeta',
    toVolumeId: 'dbz-buu-ssj3-fusion',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'context',
    title: 'Babidi, Dabura y el sacrificio del príncipe',
    summary:
      'La autodestrucción de Vegeta fracasa: Majin Buu se regenera intacto, Vegeta cae al infierno y Goku despierta solo en el Templo a enseñar la fusión a Goten y Trunks.',
    offscreen: [
      'Babidi pierde a Dabura, convertido en galleta, y se queda sin guardián.',
      'Piccolo y Krilin caen petrificados y convertidos en piedra ante Dabura.',
    ],
  },
  {
    id: 'il-buu-ssj3-fusion-buu-gotenks-gohan',
    fromVolumeId: 'dbz-buu-ssj3-fusion',
    toVolumeId: 'dbz-buu-gotenks-gohan-mistico',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'context',
    title: 'Buu en casa de Satán',
    summary:
      'El Buu gordo se muda a casa de Mr. Satán y se ablanda con su perro Bee, mientras Goten y Trunks perfeccionan a Gotenks en la Sala del Tiempo.',
    offscreen: [
      'Super Buu nace de la expulsión del mal y asesina a casi toda la humanidad de un golpe.',
      'Los supervivientes se refugian en el Templo Sagrado esperando al guerrero prometido.',
    ],
  },
  {
    id: 'il-buu-gotenks-buu-vegetto-kidbuu',
    fromVolumeId: 'dbz-buu-gotenks-gohan-mistico',
    toVolumeId: 'dbz-buu-vegetto-kidbuu-final',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'cosmic-event',
    title: 'Gohan místico y los Pothala',
    summary:
      'Super Buu absorbe a Gotenks y al Gohan místico liberado por el Kaioshin anciano, así que Goku y Vegeta se ponen los Pothala y nace Vegetto.',
    offscreen: [
      'El Anciano Kaioshin entrega su vida para revivir a Goku y Enma-sama devuelve a Vegeta con cuerpo.',
      'Dentro de Buu, Goku y Vegeta rescatan a todos los absorbidos antes de romperlo desde dentro.',
    ],
  },
  {
    id: 'il-kidbuu-daima-conspiracion',
    fromVolumeId: 'dbz-buu-vegetto-kidbuu-final',
    toVolumeId: 'db-daima-conspiracion',
    gap: { label: 'Poco después', scale: 'continuo' },
    kind: 'context',
    title: 'Daima, dentro del salto de diez años',
    summary:
      'Daima ocurre pocos meses después de Kid Buu, dentro del salto de diez años que cierra Z: la Tierra celebra el cumpleaños de Trunks en Capsule Corp cuando Gomah usa las esferas del Reino Demoníaco.',
    offscreen: [
      'La humanidad olvida a Buu gracias al deseo a Shenlong; Mr. Satán carga con la fama.',
      'En el Reino Demoníaco, Gomah, Degesu y Arinsu conspiran al ver el poder de los mortales.',
    ],
    movieIds: ['m16', 'm17'],
  },
  {
    id: 'il-daima-conspiracion-daima-climax',
    fromVolumeId: 'db-daima-conspiracion',
    toVolumeId: 'db-daima-climax',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'Travesía por el Reino Demoníaco',
    summary:
      'La travesía continúa sin pausa por el Segundo y el Primer Mundo Demoníaco, reuniendo esferas demoníacas y desmantelando las trampas de Degesu y Arinsu.',
    offscreen: [
      'Glorio y Panzy guían a Goku Mini entre Tamagamis y tributos del Tercer Mundo.',
      'Neva activa los Tamagami mientras Arinsu crea a Majin Kuu con una semilla Súper.',
    ],
  },
  {
    id: 'il-daima-climax-batalla-dioses',
    fromVolumeId: 'db-daima-climax',
    toVolumeId: 'dbs-batalla-dioses',
    gap: { label: '+3 años', scale: 'anios' },
    kind: 'cosmic-event',
    title: 'Beerus despierta tras 39 años',
    summary:
      'Pasan unos tres años de paz: el Pez Oráculo despierta a Beerus con la profecía del Super Saiyajin Dios mientras Goku trabaja la tierra como granjero y entrena a escondidas.',
    offscreen: [
      'Mr. Satán recibe el Premio de la Paz Mundial por «derrotar» a Buu.',
      'Whis acompaña a Beerus a buscar al dios de la profecía por el Universo 7.',
    ],
    movieIds: ['m18'],
  },
  {
    id: 'il-batalla-dioses-resurreccion-f',
    fromVolumeId: 'dbs-batalla-dioses',
    toVolumeId: 'dbs-resurreccion-f',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'training',
    title: 'Whis, Sorbet y las esferas',
    summary:
      'Goku y Vegeta entrenan con Whis a contener el ki dentro del cuerpo mientras Sorbet reúne las esferas de la Tierra para resucitar a Freezer.',
    offscreen: [
      'Jaco patrulla el sector y avisa tarde de la invasión del ejército de Freezer.',
      'Bulma organiza la fiesta que reunirá a todos cuando caiga la nave enemiga.',
    ],
    movieIds: ['m19'],
  },
  {
    id: 'il-resurreccion-f-torneo-u6',
    fromVolumeId: 'dbs-resurreccion-f',
    toVolumeId: 'dbs-torneo-u6',
    gap: { label: 'Semanas después', scale: 'dias' },
    kind: 'context',
    title: 'Champa desafía a Beerus',
    summary:
      'Semanas después de Golden Freezer, Champa aparece en el planeta de Beerus con Vados y reta a su hermano a un torneo de cinco contra cinco por las Súper Esferas del tamaño de planetas.',
    offscreen: [
      'Monaka es presentado como el héroe que motivará a Goku y Vegeta.',
      'Bulma y Jaco localizan la última Súper Esfera con el radar modificado.',
    ],
  },
  {
    id: 'il-torneo-u6-copy-vegeta',
    fromVolumeId: 'dbs-torneo-u6',
    toVolumeId: 'dbs-copy-vegeta',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'transition',
    title: 'Monaka «victorioso» y Potaufeu',
    summary:
      'Tras brindar por Monaka, Goten y Trunks acaban accidentalmente en Potaufeu, donde el agua Súperhumana y el líquido Commeson clonan a Vegeta.',
    offscreen: [
      'Monaka guarda en secreto que nunca fue el más fuerte del Universo 7.',
      'El sello de Potaufeu se rompe y el clon morado empieza a copiar poder sin límite.',
    ],
  },
  {
    id: 'il-copy-vegeta-goku-black',
    fromVolumeId: 'dbs-copy-vegeta',
    toVolumeId: 'dbs-goku-black',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'paradox',
    title: 'Trunks llega herido del futuro',
    summary:
      'Trunks escapa del futuro en la máquina del tiempo y cae herido en el presente: un Goku idéntico, Black, masacra a la humanidad junto a Zamasu. Contexto: es el Trunks que entrenó con el Gohan manco de su línea.',
    offscreen: [
      'En el futuro, Mai lidera la resistencia con los pocos supervivientes.',
      'Bulma del futuro muere para darle a Trunks el combustible del último viaje.',
    ],
  },
  {
    id: 'il-goku-black-exhibicion-zen',
    fromVolumeId: 'dbs-goku-black',
    toVolumeId: 'dbs-exhibicion-zen',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'cosmic-event',
    title: 'El Zen-Oh del futuro y el torneo',
    summary:
      'Tras borrar el futuro con Zen-Oh, Goku trae al Zen-Oh del futuro al presente y, al visitarlo, recuerda el torneo prometido entre todos los universos.',
    offscreen: [
      'Los dos Zen-Oh se hacen amigos inseparables y juegan juntos en el palacio.',
      'El Gran Sacerdote empieza a preparar el torneo multiversal.',
    ],
  },
  {
    id: 'il-exhibicion-reclutamiento-u7',
    fromVolumeId: 'dbs-exhibicion-zen',
    toVolumeId: 'dbs-reclutamiento-u7',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'cosmic-event',
    title: 'El universo que pierda será borrado',
    summary:
      'Al terminar la exhibición, el Gran Sacerdote anuncia la regla real: el universo perdedor del Torneo del Poder será borrado por Zen-Oh, y da pocas horas para reunir a diez guerreros.',
    offscreen: [
      'Gohan vuelve a entrenar con Piccolo para recuperar su forma mística.',
      'Buu cae dormido y deja al Universo 7 con un hueco en el equipo.',
    ],
  },
  {
    id: 'il-reclutamiento-torneo-poder',
    fromVolumeId: 'dbs-reclutamiento-u7',
    toVolumeId: 'dbs-torneo-del-poder',
    gap: { label: '48 h', scale: 'dias' },
    kind: 'transition',
    title: 'Cuenta regresiva: el décimo guerrero',
    summary:
      'Quedan 48 horas para el torneo: con Buu dormido y 17 dudando en su isla, Goku convence al guardabosques androide como décimo guerrero del Universo 7.',
    offscreen: [
      '17 protege sapos gigantes y caza furtivos mientras medita la oferta.',
      'Freezer es reclutado del infierno como reemplazo de última hora.',
    ],
  },
  {
    id: 'il-torneo-poder-black-star',
    fromVolumeId: 'dbs-torneo-del-poder',
    toVolumeId: 'dbgt-black-star',
    gap: { label: '+9 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Broly, Super Hero y el epílogo de Z',
    summary:
      'Tras el torneo caen Broly justo después y Super Hero unos dos años más tarde; en medio, el epílogo de Z en 784 (28° Torneo y la partida de Goku con Uub, ya visto en el lapso 21) deja la Tierra en paz hasta 789.',
    offscreen: [
      'Goku entrena a Uub en el Templo durante cinco años antes del deseo de Pilaf.',
      'Piccolo deja el Templo y Gohan publica su tesis mientras Pan crece.',
    ],
    movieIds: ['m20', 'm21'],
  },
  {
    id: 'il-black-star-baby',
    fromVolumeId: 'dbgt-black-star',
    toVolumeId: 'dbgt-baby-ssj4',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'transition',
    title: 'Regreso a la Tierra',
    summary:
      'La nave vuelve a la Tierra con las esferas reunidas, pero en el planeta M2 el Dr. Myuu ya trabaja para una entidad parasitaria con ADN del rey tsufuru.',
    offscreen: [
      'Baby despierta dentro de su cápsula y empieza a poseer cuerpos para llegar a Vegeta.',
      'Dende detecta una energía extraña creciendo en el laboratorio de Myuu.',
    ],
  },
  {
    id: 'il-baby-super-17',
    fromVolumeId: 'dbgt-baby-ssj4',
    toVolumeId: 'dbgt-super-17',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'context',
    title: 'El plan tsufuru de Baby',
    summary:
      'Baby usa las esferas para recrear el Planeta Tsufuru y posee a toda la Tierra, hasta que Goku SSJ4 lo expulsa al sol; la Tierra se restaura con las esferas de Namek y vive una corta tregua.',
    offscreen: [
      'Piccolo se sacrifica para destruir las esferas de estrella negra junto a la Tierra moribunda.',
      'La población, liberada del control, reconstruye las ciudades arrasadas.',
    ],
  },
  {
    id: 'il-super-17-dragones',
    fromVolumeId: 'dbgt-super-17',
    toVolumeId: 'dbgt-dragones-malignos',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'context',
    title: 'Myuu y Gero abren el infierno',
    summary:
      'El Dr. Myuu y el Dr. Gero abren una brecha desde el infierno y fusionan a los dos 17 en el Súper 17; Krilin cae y los muertos invaden la Tierra hasta que Goku lo destruye.',
    offscreen: [
      'Freezer y Cell intentan retener a Goku en el infierno con hielo y tretas.',
      '18 venga a Krilin clavando su venganza en el pecho del Súper 17.',
    ],
  },
  {
    id: 'il-epilogo-dragones',
    fromVolumeId: 'dbgt-dragones-malignos',
    toVolumeId: null,
    gap: { label: '+100 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Cien años después: Goku Jr.',
    summary:
      'Un siglo después del adiós de Goku con Shenlong, su tataranieto Goku Jr. busca la esfera de cuatro estrellas para curar a la anciana Pan y se transforma por primera vez en el 64° Torneo.',
    offscreen: [
      'El báculo sagrado y la esfera de cuatro estrellas descansan en el Monte Paoz como reliquias.',
      'El espíritu del Goku original aparece para entregar el báculo a su descendiente.',
    ],
    movieIds: ['sp3'],
  },
];
