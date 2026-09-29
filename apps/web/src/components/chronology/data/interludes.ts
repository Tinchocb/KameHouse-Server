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
 * Datos curados y enriquecidos contra la cronología oficial (Daizenshuu 7 / Chōzenshū 4).
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
      'Tras el primer deseo a Shenlong, las esferas se convierten en piedra durante un año. Goku y Krilin se someten a ocho meses de riguroso entrenamiento bajo el Maestro Roshi para participar en el 21° Torneo de las Artes Marciales.',
    offscreen: [
      'Bulma regresa a la Capital del Oeste con Yamcha, Oolong y Puar, asistiendo a la preparatoria mientras el radar queda inactivo.',
      'El método Roshi: levantarse a las 4:30 AM para repartir leche saltando precipicios, arar campos con las manos y nadar huyendo de tiburones con caparazones de 20 kg (luego 40 kg).',
      'Krilin y Goku aprenden lectura, matemáticas y cultura general con Roshi, fundamentando la filosofía del Estilo Tortuga: cuerpo sano y mente despierta.',
      'Launch se instala como ama de llaves en Kame House, alternando su personalidad dulce y su versión armada con ametralladora tras cada estornudo.',
    ],
    movieIds: ['m1', 'm2'],
  },
  {
    id: 'il-torneo-21-red-ribbon',
    fromVolumeId: 'db-torneo-21',
    toVolumeId: 'db-red-ribbon',
    gap: { label: 'Mismo día', scale: 'continuo' },
    kind: 'transition',
    title: 'La búsqueda de la esfera de cuatro estrellas',
    summary:
      'Tras caer por milímetros ante Jackie Chun en la final del torneo, Goku rechaza la comodidad y parte solo en la Nube Voladora para recuperar la esfera de cuatro estrellas, la única reliquia de su abuelo Son Gohan.',
    offscreen: [
      'Jackie Chun (el Maestro Roshi disfrazado) celebra en secreto haber evitado que sus alumnos caigan en la arrogancia prematura.',
      'Nam utiliza el dinero del premio del torneo para comprar agua y provisiones para su aldea en sequía gracias a las cápsulas Hoi-Poi de Roshi.',
      'En las sombras, el ejército del Comandante Red moviliza regimientos en todo el globo para capturar las esferas y cumplir el deseo secreto de su líder.',
    ],
  },
  {
    id: 'il-red-ribbon-uranai-baba',
    fromVolumeId: 'db-red-ribbon',
    toVolumeId: 'db-uranai-baba',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'transition',
    title: 'La esfera oculta y el palacio de Baba',
    summary:
      'Goku desmantela por completo el Cuartel General de la Patrulla Roja y reúne seis esferas, pero la séptima no emite señal en el radar porque Pilaf la ha blindado en un estuche aislante. El grupo debe recurrir a la adivina Uranai Baba.',
    offscreen: [
      'Upa aguarda con devoción junto a la tumba de su padre Bora al pie de la Torre Karin, esperando el milagro de Shenlong.',
      'Pilaf, Shu y Mai vigilan desde su fortaleza voladora, convencidos de que su estuche anti-ondas los mantendrá a salvo de Goku.',
      'Krilin, Yamcha y Puar se reúnen con Goku en Kame House y deciden acompañarlo al palacio de Uranai Baba para disputar el torneo de los cinco guerreros del Más Allá.',
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
      'Tras revivir a Bora, Roshi prohíbe a Goku usar la Nube Voladora y le ordena recorrer el planeta a pie durante tres años. Mientras tanto, la Escuela Grulla del maestro Tsuru adoctrina a Tenshinhan y Chaoz para la victoria letal.',
    offscreen: [
      'Goku nada a través de océanos, escala cordilleras nevadas y perfecciona su resistencia muscular y velocidad sin depender de artefactos mágicos.',
      'Krilin y Yamcha entrenan sin descanso en Kame House bajo la tutela directa de Roshi, aprendiendo a proyectar el Kamehameha.',
      'Tenshinhan y Chaoz perfeccionan técnicas mortíferas como el Dodonpa, el Shiyōken (cuatro brazos) y el Kikōhō en el dojo de la Grulla.',
      'Tao Pai Pai es reconstruido como ciborg clandestinamente tras la explosión de la granada en la Torre Karin.',
    ],
  },
  {
    id: 'il-torneo-22-piccolo-daimaku',
    fromVolumeId: 'db-torneo-22',
    toVolumeId: 'db-piccolo-daimaku',
    gap: { label: 'Mismo día', scale: 'continuo' },
    kind: 'transition',
    title: 'La sombra del Rey Demonio',
    summary:
      'Instantes después de la victoria por desempate de Tenshinhan, Krilin es asesinado en los vestuarios por el engendro Tambourine. El papel con el kanji «Demonio» anuncia el regreso del terror milenario: Piccolo Daimaoh.',
    offscreen: [
      'Goku pierde el control por la furia y persigue a Tambourine con el estómago vacío, lo que casi le cuesta la vida.',
      'El Maestro Roshi relata con horror el pasado: cómo su maestro Mutaito sacrificó su vida utilizando el Mafūba para sellar a Piccolo en una arrocera eléctrica.',
      'Emperor Pilaf pilota la nave donde Piccolo Daimaoh, anciano y debilitado, decreta la aniquilación de todos los artistas marciales del registro del torneo.',
    ],
  },
  {
    id: 'il-piccolo-daimaku-piccolo-jr',
    fromVolumeId: 'db-piccolo-daimaku',
    toVolumeId: 'db-piccolo-jr',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'training',
    title: 'El heredero del mal y el Templo de Kamisama',
    summary:
      'Con el último aliento antes de ser atravesado por el Puño del Dragón, Piccolo Daimaoh expulsa un huevo con su reencarnación y recuerdos. Goku sube con el Báculo Sagrado hasta el Templo Celeste para entrenar con Mr. Popo y Kamisama.',
    offscreen: [
      'Piccolo Jr. nace en un páramo solitario, creciendo rápidamente con el odio y los recuerdos intactos de su predecesor.',
      'Kamisama repara la maqueta de arcilla de Shenlong y le insufla vida, permitiendo revivir a Roshi, Krilin, Chaoz y todas las víctimas de Daimaoh.',
      'Goku aprende a sentir el ki, a vaciar su mente («tranquilo como el cielo, rápido como el rayo») y utiliza por primera vez ropa con cientos de kilos de lastre.',
      'Tenshinhan, Krilin, Yamcha y Chaoz viajan juntos a pie por el mundo para prepararse para el 23° Torneo.',
    ],
  },
  {
    id: 'il-piccolo-jr-saiyajin-raditz',
    fromVolumeId: 'db-piccolo-jr',
    toVolumeId: 'dbz-saiyajin-raditz',
    gap: { label: '+5 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Cinco años de paz, boda y la sombra saiyajin',
    summary:
      'Goku derrota a Piccolo Jr., rechaza asumir el trono de Dios y se casa con Milk en el Monte Frypan. Nace Son Gohan en el Año 757. La Tierra vive cinco años de absoluta calma ignorando que el cosmos alberga una verdad demoledora sobre la sangre de Kakarotto.',
    offscreen: [
      'Piccolo medita en cascadas y desiertos lejanos, perfeccionando en secreto el Makankōsappō para atravesar las defensas de Goku.',
      'Goku vive como leñador y campesino en el Monte Paoz, cuidando a su hijo Gohan y observando que el niño posee una fuerza anómala e inestable.',
      'En los confines de la galaxia, Vegeta, Nappa y Raditz conquistan planetas para la Organización de Comercio Planetario de Freezer, preguntándose por qué el cuarto superviviente de su raza no ha purgado la Tierra.',
      'El rey Enma-sama en el Otro Mundo mantiene su juicio diario sin anticipar que pronto recibirá al saiyajin más determinante del universo.',
    ],
    movieIds: ['sp1', 'm5'],
  },
  {
    id: 'il-raditz-vegeta',
    fromVolumeId: 'dbz-saiyajin-raditz',
    toVolumeId: 'dbz-saiyajin-vegeta',
    gap: { label: '+1 año', scale: 'anios' },
    kind: 'training',
    title: 'El millón de kilómetros y el niño en el desierto',
    summary:
      'Goku se sacrifica para sujetar a Raditz y muere ante el Makankōsappō. Con un año antes de que Vegeta y Nappa aterricen en la Tierra, Goku recorre el millón de kilómetros del Camino de la Serpiente hasta el Kaio del Norte, mientras Piccolo instruye a Gohan en la supervivencia más despiadada.',
    offscreen: [
      'Piccolo abandona a Gohan durante seis meses en una meseta salvaje; cuando el niño contempla la luna llena y se transforma en Ōzaru, Piccolo destruye la luna terrestre y le amputa la cola.',
      'Krilin, Yamcha, Tenshinhan, Chaoz y Yajirobe suben a la Torre Karin y entrenan con Kamisama y Mr. Popo, enfrentando a fantasmas de antiguos saiyajin.',
      'En el planeta de Kaio (gravedad x10), Goku atrapa al mono Bubbles, golpea al grillo Gregory y domina las dos técnicas prohibidas: el Kaioken y la Genkidama.',
      'Vegeta y Nappa duermen en animación suspendida dentro de sus naves espaciales mientras cruzan cuadrantes estelares.',
    ],
    movieIds: ['m6'],
  },
  {
    id: 'il-vegeta-namek-viaje',
    fromVolumeId: 'dbz-saiyajin-vegeta',
    toVolumeId: 'dbz-namek-viaje',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'training',
    title: 'Hospital, nave namekiana y gravedad x100',
    summary:
      'Vegeta escapa moribundo tras el golpe de Gohan Ōzaru. Con Piccolo y Kamisama muertos, las esferas terrestres se extinguen. Bulma, Krilin y Gohan despegan hacia el planeta Namek en la nave ancestral de Kami, mientras Goku aguarda en el hospital la cosecha de nuevas semillas del ermitaño.',
    offscreen: [
      'El Dr. Brief acondiciona la cápsula espacial de Goku con un regulador de gravedad artificial capaz de alcanzar 100 veces la terrestre.',
      'Goku entrena durante seis días en el espacio al borde de la muerte: cada vez que colapsa con el cuerpo destrozado consume una semilla y experimenta un Zenkai masivo.',
      'En el Planeta Freezer 79, los médicos sumergen a Vegeta en líquido regenerativo; al despertar se entera de que Freezer ya viaja a Namek tras interceptar las transmisiones de los rastreadores.',
      'Freezer aterriza en Namek con Zarbon y Dodoria, iniciando la masacre de aldeas namekianas pacíficas para arrebatarles sus esferas gigantes.',
    ],
    movieIds: ['m7', 'm8'],
  },
  {
    id: 'il-namek-viaje-ginyu-freezer',
    fromVolumeId: 'dbz-namek-viaje',
    toVolumeId: 'dbz-namek-ginyu-freezer',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'La llegada de las Fuerzas Ginyu',
    summary:
      'Vegeta asesina a Dodoria y Zarbon y esconde una esfera en un lago namekiano. Desesperado ante la pérdida de sus radares y esferas, Freezer convoca de urgencia a su escuadrón de élite interestelar: las Fuerzas Especiales Ginyu.',
    offscreen: [
      'El Gran Patriarca (Saichōrō) despierta el potencial latente oculto en Gohan y Krilin mediante su imposición de manos mística.',
      'Dende se convierte en el enlace vital de los guerreros de la Tierra, revelando que para invocar a Polunga es imprescindible hablar en el idioma namekiano.',
      'Vegeta se ve forzado por primera vez en su vida a forjar una alianza táctica con Krilin y Gohan para evitar que Ginyu se apodere de las siete esferas.',
      'La nave de Goku penetra la atmósfera de Namek a velocidad terminal con el saiyajin completamente listo para el combate.',
    ],
  },
  {
    id: 'il-ginyu-freezer-freezer-ssj',
    fromVolumeId: 'dbz-namek-ginyu-freezer',
    toVolumeId: 'dbz-freezer-super-saiyajin',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'La cápsula médica y el despertar de la leyenda',
    summary:
      'Goku queda con el cuerpo roto tras el intercambio de almas con el Capitán Ginyu y es introducido en la cámara de regeneración de la nave nodriza. Afuera, Piccolo es resucitado en Namek y se fusiona con el guerrero moribundo Nail.',
    offscreen: [
      'Freezer exhibe su segunda y tercera forma monstruosa, masacrando a Krilin y humillando a Piccolo fusionado antes de adoptar su fisonomía final y perfecta.',
      'Vegeta, con el orgullo destrozado y el corazón perforado por el rayo letal de Freezer, derrama lágrimas ante Goku rogándole que vengue a la raza saiyajin.',
      'Dende utiliza sus poderes curativos en secreto hasta que Freezer lo detecta y lo asesina de un disparo en la cabeza.',
      'Goku concluye su curación médica sintiendo cómo el destino cósmico lo empuja hacia el tirano que aniquiló su planeta natal.',
    ],
  },
  {
    id: 'il-freezer-ssj-garlic-jr',
    fromVolumeId: 'dbz-freezer-super-saiyajin',
    toVolumeId: 'dbz-garlic-jr',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'context',
    title: 'Namek estalla: Yardrat y el Nuevo Namek',
    summary:
      'El planeta Namek vuela en pedazos en el Año 762. Todo el mundo cree muerto a Goku, pero logra escapar milagrosamente en una nave de las Fuerzas Ginyu con rumbo automático a Yardrat, donde los sabios locales le enseñan el control espiritual y la Teletransportación.',
    offscreen: [
      'En la Tierra, Polunga es invocado gracias a los deseos restantes para resucitar a Krilin y Yamcha; más tarde se pide el traslado de los supervivientes al Nuevo Namek.',
      'Shenlong intenta traer a Goku a la Tierra, pero el dragón informa que Goku se niega porque desea aprender nuevas técnicas en el espacio exterior.',
      'Garlic Jr. escapa de la Zona Muerta aprovechando el paso del Planeta Makyo y asalta el Templo Celeste con el Agua de la Niebla Negra.',
      'Vegeta roba una nave de Capsule Corp y viaja furioso por el cosmos intentando averiguar cómo alcanzar el Super Saiyajin.',
    ],
  },
  {
    id: 'il-garlic-jr-androides-trunks',
    fromVolumeId: 'dbz-garlic-jr',
    toVolumeId: 'dbz-androides-trunks',
    gap: { label: '+3 años', scale: 'anios' },
    kind: 'paradox',
    title: 'El viajero del futuro y la advertencia del 12 de mayo',
    summary:
      'Mecha Freezer y el Rey Cold aterrizan en la Tierra en el Año 764, pero un misterioso joven con espada los descuartiza en segundos. Es Trunks, venido de un futuro devastado para advertir que el 12 de mayo del Año 767 aparecerán dos androides asesinos creados por el Dr. Gero.',
    offscreen: [
      'Trunks entrega a Goku el fármaco que salvará su corazón de la letal enfermedad vírica que lo mató en su línea temporal.',
      'Goku, Piccolo y Gohan entrenan juntos durante tres años en páramos rocosos, empujando su resistencia y perfeccionando el control del Super Saiyajin.',
      'Vegeta se somete a gravedad x300 en Capsule Corp; tras casi morir en un asteroide espacial, su rabia y desprecio por sus límites desatan el Super Saiyajin.',
      'En las profundidades del laboratorio del Dr. Gero, una supercomputadora incuba la larva de Cell y una segunda máquina del tiempo aterriza oculta entre la maleza.',
    ],
    movieIds: ['m9', 'm10', 'sp2'],
  },
  {
    id: 'il-androides-cell-imperfecto',
    fromVolumeId: 'dbz-androides-trunks',
    toVolumeId: 'dbz-cell-imperfecto-perfeccion',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'El virus del corazón y el despertar del bioandroide',
    summary:
      'El 12 de mayo en la isla Amenbo, el corazón de Goku colapsa ante el Androide 19. El Dr. Gero activa a 17 y 18, quienes lo decapitan y despiertan al Androide 16. Pero el verdadero horror acecha en Ginger Town: una criatura biomecánica absorbe miles de almas para devorar a los androides.',
    offscreen: [
      'Piccolo comprende su insuficiencia y sube al Templo para fusionarse definitivamente con Kamisama, renaciendo como el Namekiano Anónimo de poder colosal.',
      'Al asimilarse Kamisama, las esferas del dragón de la Tierra se convierten en piedra ordinaria, dejando al mundo sin red de salvación.',
      'Bulma y Trunks investigan el cascarón vacío encontrado en las afueras, descubriendo que Cell viajó desde otro futuro tras matar al Trunks de esa línea.',
      'Goku despierta de su letargo médico gracias al antídoto y propone entrar por turnos en la Sala del Espíritu y el Tiempo.',
    ],
    movieIds: ['m11'],
  },
  {
    id: 'il-cell-imperfecto-juegos-cell',
    fromVolumeId: 'dbz-cell-imperfecto-perfeccion',
    toVolumeId: 'dbz-juegos-de-cell',
    gap: { label: '10 días', scale: 'dias' },
    kind: 'training',
    title: 'Diez días de tregua: el descanso del guerrero',
    summary:
      'Cell absorbe a los androides 17 y 18 alcanzando su Forma Perfecta. Para demostrar su superioridad absoluta al cosmos, construye una plataforma con telequinesis y anuncia por televisión mundial los «Juegos de Cell», otorgando diez días de plazo antes de exterminar la Tierra.',
    offscreen: [
      'Goku y Gohan pasan casi un año completo en la Sala del Espíritu y el Tiempo, saliendo con el Super Saiyajin Máximo Poder (Full Power) dominado como un estado natural y relajado.',
      'Goku decide no desgastar su cuerpo los últimos tres días: pesca, pasea y duerme con Gohan y Milk en el campo mientras los demás guerreros entrenan desesperados.',
      'Goku viaja con la Teletransportación al Nuevo Namek y recluta al joven Dende como el nuevo Dios de la Tierra, quien reactiva las esferas otorgando dos deseos por invocación.',
      'Mr. Satán se corona campeón del torneo de artes marciales y la prensa mundial lo declara el mesías que destruirá a Cell.',
    ],
    movieIds: ['m12'],
  },
  {
    id: 'il-juegos-cell-otro-mundo',
    fromVolumeId: 'dbz-juegos-de-cell',
    toVolumeId: 'dbz-torneo-otro-mundo',
    gap: { label: 'Unos días', scale: 'dias' },
    kind: 'transition',
    title: 'El sacrificio de Goku y el torneo del Más Allá',
    summary:
      'Gohan desata el Super Saiyajin 2 y pulveriza a Cell con el Kamehameha Padre-Hijo. Tras sacrificarse teletransportando al Cell autodestructivo al planeta de Kaio, Goku comunica por telepatía que prefiere permanecer muerto para que su presencia no siga atrayendo amenazas al planeta.',
    offscreen: [
      'Trunks del Futuro regresa a su línea temporal con el poder suficiente para desintegrar a los androides 17 y 18 y al Cell imperfecto, liberando su mundo por fin.',
      'Mr. Satán se apropia públicamente de la victoria contra Cell con la complicidad silenciosa de los Guerreros Z, que prefieren vivir en el anonimato.',
      'El Gran Kaio organiza el Gran Torneo del Más Allá con los cuatro cuadrantes cósmicos, donde Goku conoce a Paikuhan y utiliza el Super Kaioken.',
      'Milk descubre que está embarazada de su segundo hijo: Son Goten nacerá sin conocer a su padre en vida.',
    ],
    movieIds: ['m13'],
  },
  {
    id: 'il-otro-mundo-buu-majin-vegeta',
    fromVolumeId: 'dbz-torneo-otro-mundo',
    toVolumeId: 'dbz-buu-majin-vegeta',
    gap: { label: '+7 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Siete años de paz, Goten y el Gran Saiyaman',
    summary:
      'La Tierra disfruta de siete años de paz absoluta (Año 767 al 774). Gohan asiste a la preparatoria Orange Star en Ciudad Satán y combate el crimen como el justiciero enmascarado «El Gran Saiyaman». El anuncio del 25° Torneo de las Artes Marciales convoca a toda la familia, pues Uranai Baba concederá a Goku 24 horas de permiso en la Tierra.',
    offscreen: [
      'Goku entrena intensamente en el Más Allá con un cuerpo espiritual libre de desgaste físico, lo que le permite romper la barrera del Super Saiyajin 3.',
      'Vegeta se recluye en la gravedad artificial de Capsule Corp criando al pequeño Trunks con una disciplina feroz, obsesionado con no quedarse atrás respecto a Goku.',
      'Videl descubre la verdadera identidad de Gohan y lo chantajea para que le enseñe a controlar el ki y a volar.',
      'El mago Babidi y Dabura, rey del mundo demoníaco, aterrizan en secreto en la Tierra midiendo niveles de poder para despertar el huevo de Majin Buu.',
    ],
    movieIds: ['m14', 'm15'],
  },
  {
    id: 'il-buu-majin-vegeta-buu-ssj3-fusion',
    fromVolumeId: 'dbz-buu-majin-vegeta',
    toVolumeId: 'dbz-buu-ssj3-fusion',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'context',
    title: 'El orgullo del príncipe y la danza metamorana',
    summary:
      'Vegeta se deja poseer por la magia de Babidi para forzar su revancha con Goku. Su energía desata el nacimiento de Majin Buu. Al comprender la catástrofe que provocó, Vegeta noquea a Goku y se hace estallar en mil pedazos en un intento suicida por borrar al monstruo.',
    offscreen: [
      'Majin Buu sobrevive recomponiendo sus fragmentos de humo rosa, asesina a Babidi y convierte al rey Dabura en galleta para devorarlo.',
      'Goku despierta malherido en el Templo Celeste; con las horas contadas antes de volver al Más Allá, asume la tarea de enseñar la danza de la Fusión a Goten y Trunks.',
      'Krilin y Piccolo son devueltos a la vida tras ser petrificados al romperse la maldición con la muerte de Dabura.',
      'Kaioshin y Kibito rescatan a Gohan al borde de la muerte y lo trasladan al sagrado e inaccesible Planeta de los Supremos Kaiohs.',
    ],
  },
  {
    id: 'il-buu-ssj3-fusion-buu-gotenks-gohan',
    fromVolumeId: 'dbz-buu-ssj3-fusion',
    toVolumeId: 'dbz-buu-gotenks-gohan-mistico',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'context',
    title: 'El despertar del mal puro y el ritual de los Kaioh',
    summary:
      'Goku exhibe el Super Saiyajin 3 consumiendo el resto de su energía terrenal y regresa al Más Allá. En la Tierra, Mr. Satán logra lo que ningún guerrero pudo: ganarse el corazón del Buu gordo con comida y un perrito llamado Bee, hasta que unos pistoleros desatan la furia que engendra a Super Buu.',
    offscreen: [
      'Gohan parte la legendaria Espada Z en el Planeta Kaioh liberando al Anciano Kaioshin de hace quince generaciones, quien inicia un ritual de 24 horas para desbloquear su poder latente.',
      'Super Buu extermina a casi toda la población humana del planeta en cuestión de minutos disparando rayos teledirigidos desde lo alto del Templo Sagrado.',
      'Goten y Trunks perfeccionan la fusión dentro de la Sala del Espíritu y el Tiempo, alcanzando a Gotenks Super Saiyajin 3 con técnicas extravagantes como los Fantasmas Kamikaze.',
      'Piccolo destruye la puerta de la Sala del Tiempo para atrapar a Buu, pero el monstruo desgarra el tejido dimensional gritando de rabia.',
    ],
  },
  {
    id: 'il-buu-gotenks-buu-vegetto-kidbuu',
    fromVolumeId: 'dbz-buu-gotenks-gohan-mistico',
    toVolumeId: 'dbz-buu-vegetto-kidbuu-final',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'cosmic-event',
    title: 'Los pendientes Pothala y la aniquilación de la Tierra',
    summary:
      'Super Buu absorbe a Gotenks, a Piccolo y al Gohan Místico recién llegado. Acorralado, el Anciano Kaioh entrega su propia vida para resucitar a Goku y le cede los pendientes Pothala. Enma-sama envía a Vegeta con cuerpo físico desde el infierno: nace Vegetto.',
    offscreen: [
      'Vegetto humilla a Buu en todas las facetas e ingresa deliberadamente en su estómago bajo una barrera de energía para rescatar a sus hijos y amigos.',
      'Dentro del cuerpo de Buu la fusión se disuelve por los gases mágicos; al arrancar al Buu gordo de la carne interna, la bestia colapsa e involuciona a su estado primitivo y despiadado: Kid Buu.',
      'Kid Buu destruye la Tierra instantáneamente con una esfera de ki planetaria; Goku y Vegeta son salvados por Kaioshin mediante teletransportación al Mundo Kaioh.',
      'Dende y el Anciano Kaioh viajan al Nuevo Namek para preparar los deseos de Polunga mientras Goku y Vegeta juegan a piedra, papel o tijera para decidir quién pelea primero.',
    ],
  },
  {
    id: 'il-kidbuu-daima-conspiracion',
    fromVolumeId: 'dbz-buu-vegetto-kidbuu-final',
    toVolumeId: 'db-daima-conspiracion',
    gap: { label: 'Poco después', scale: 'continuo' },
    kind: 'context',
    title: 'El deseo de Shenlong y el Reino Demoníaco',
    summary:
      'Goku fulmina a Kid Buu con la Súper Genkidama cósmica invocada por Mr. Satán en el Año 774. Seis meses después, Shenlong borra de la mente de los terrícolas el recuerdo de Buu para que el monstruo bondadoso viva en paz. Es en este respiro cuando el Reino Demoníaco pone sus ojos en la Tierra.',
    offscreen: [
      'En el Palacio Real del Reino de los Demonios, el Rey Gomah y Degesu revisan grabaciones del combate contra Buu y entran en pánico al ver el poderío de los mortales.',
      'Gomah recluta al anciano namekiano Neva para activar las Esferas del Dragón del Reino Demoníaco y desear que los Guerreros Z vuelvan a ser niños.',
      'Capsule Corp celebra por todo lo alto el cumpleaños número nueve de Trunks con una fiesta multitudinaria antes de la extraña niebla mágica.',
      'Shin (el Kaioshin) investiga anomalías en las dimensiones inferiores sospechando que los demonios planean una venganza por la caída de Dabura.',
    ],
    movieIds: ['m16', 'm17'],
  },
  {
    id: 'il-daima-conspiracion-daima-climax',
    fromVolumeId: 'db-daima-conspiracion',
    toVolumeId: 'db-daima-climax',
    gap: { label: 'Continuo', scale: 'continuo' },
    kind: 'transition',
    title: 'Travesía por los Tres Mundos Demoníacos',
    summary:
      'Convertidos en niños, Goku, el Supremo Kaioshin y sus aliados se internan en el Segundo y Primer Mundo Demoníaco. Con el Báculo Sagrado en mano, Goku redescubre el encanto de la aventura pura sorteando las trampas de Arinsu y sus esbirros mecánicos.',
    offscreen: [
      'Glorio y Panzy operan sus naves y artefactos entre los volcanes de gas y ciénagas del Reino Demoníaco.',
      'La científica Arinsu crea a Majin Kuu y cultiva semillas demoníacas para desafiar el mandato de Gomah.',
      'En la Tierra, Piccolo y Bulma analizan el origen de la maldición mientras cuidan a los demás guerreros rejuvenecidos.',
    ],
  },
  {
    id: 'il-daima-climax-batalla-dioses',
    fromVolumeId: 'db-daima-climax',
    toVolumeId: 'dbs-batalla-dioses',
    gap: { label: '+3 años', scale: 'anios' },
    kind: 'cosmic-event',
    title: 'La profecía del Dios de la Destrucción',
    summary:
      'Tras resolver la crisis del Reino Demoníaco y recuperar sus formas adultas, transcurren tres años de calma (Año 775 al 778). Goku trabaja a regañadientes como agricultor de rábanos y entrena a escondidas en el planeta de Kaio. En los confines del cosmos, Lord Beerus despierta tras una siesta de 39 años.',
    offscreen: [
      'El Pez Oráculo confirma a Lord Beerus que en este ciclo aparecerá su rival profetizado: el «Super Saiyajin Dios».',
      'Whis acompaña a Beerus por la galaxia, supervisando la destrucción de planetas con gastronomía mediocre antes de poner rumbo al cuadrante norte.',
      'Bulma organiza su fiesta de cumpleaños número 38 en un crucero de lujo de la Corporación Cápsula, reservando las siete esferas del dragón como premio mayor del bingo.',
      'Gohan y Videl contraen matrimonio; Videl queda embarazada de la pequeña Pan, quien será la sexta saiyajin requerida para el ritual divino.',
    ],
    movieIds: ['m18'],
  },
  {
    id: 'il-batalla-dioses-resurreccion-f',
    fromVolumeId: 'dbs-batalla-dioses',
    toVolumeId: 'dbs-resurreccion-f',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'training',
    title: 'El ki de los dioses y los restos del ejército de Freezer',
    summary:
      'Beerus perdona a la Tierra tras el combate con el Super Saiyajin Dios. Meses después (Año 779), Vegeta y Goku son aceptados por Whis en el planeta del Dios de la Destrucción para aprender a controlar el ki divino sin fugas de energía. En el espacio, el comandante Sorbet busca desesperadamente revivir a su señor.',
    offscreen: [
      'Sorbet y Tagoma roban las esferas del dragón en la Tierra y resucitan a Freezer en pedazos dentro de una cámara de rejuvenecimiento avanzada.',
      'Freezer experimenta por primera vez en su vida un régimen de entrenamiento personal de cuatro meses, descubriendo la transformación «Golden Freezer».',
      'Whis entrena a Goku y Vegeta en un espacio ultradimensional donde el ki ordinario inmoviliza el cuerpo si no se contiene con precisión milimétrica.',
      'Jaco, el Patrullero Galáctico, vuela a toda velocidad hacia la Tierra para advertir a Bulma sobre la flota de mil soldados que se aproxima.',
    ],
    movieIds: ['m19'],
  },
  {
    id: 'il-resurreccion-f-torneo-u6',
    fromVolumeId: 'dbs-resurreccion-f',
    toVolumeId: 'dbs-torneo-u6',
    gap: { label: 'Semanas después', scale: 'dias' },
    kind: 'context',
    title: 'Champa, Vados y las Súper Esferas del Dragón',
    summary:
      'Freezer es devuelto al infierno tras el retroceso temporal de tres minutos de Whis. Semanas más tarde, Champa (Dios de la Destrucción del Universo 6) y su asistente Vados irrumpen en el templo de Beerus. Obsesionado con el ramen de la Tierra, Champa propone un torneo de cinco contra cinco entre ambos universos gemelos.',
    offscreen: [
      'Champa y Vados reúnen en secreto seis de las siete Súper Esferas del Dragón, cada una del tamaño de un planeta con núcleos estelares.',
      'Bulma y Jaco viajan al centro del universo para consultar al sabio Zuno sobre el origen y las reglas de las Súper Esferas creadas por el Dios Dragón Zalama.',
      'Goku y Vegeta reclutan a Piccolo, a Majin Buu y al misterioso Monaka, a quien Beerus presenta falsamente como el guerrero más fuerte que ha enfrentado.',
      'En el Universo 6, Cabba, Frost, Botamo, Magetta y el legendario asesino Hit son convocados para el combate en el Planeta Sin Nombre.',
    ],
  },
  {
    id: 'il-torneo-u6-copy-vegeta',
    fromVolumeId: 'dbs-torneo-u6',
    toVolumeId: 'dbs-copy-vegeta',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'transition',
    title: 'El banquete de Monaka y el agua de Potaufeu',
    summary:
      'El Universo 7 se alza con la victoria gracias al salto temporal de Hit y el ingenio de Goku. Con las Súper Esferas, Beerus pide secretamente restaurar la Tierra del Universo 6. Días más tarde, Monaka llega a la Tierra como repartidor espacial, iniciando un imprevisto enredo.',
    offscreen: [
      'Goten y Trunks se esconden en la furgoneta de reparto de Monaka y terminan atrapados en el remoto planeta Potaufeu.',
      'El agua milagrosa «Commeson» (un arma biológica ancestral) absorbe los poderes de Vegeta y genera una copia idéntica que amenaza con disolver al verdadero príncipe saiyajin.',
      'Goku debe pelear con el clon de Vegeta a máxima potencia antes de que el cuerpo del príncipe desaparezca para siempre.',
    ],
  },
  {
    id: 'il-copy-vegeta-goku-black',
    fromVolumeId: 'dbs-copy-vegeta',
    toVolumeId: 'dbs-goku-black',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'paradox',
    title: 'Pesadilla en el futuro: la llegada de Trunks herido',
    summary:
      'En el Año 780, una máquina del tiempo aterriza violentamente en los jardines de Capsule Corp con Trunks del Futuro inconsciente y al borde de la muerte. En su línea temporal, una entidad idéntica a Son Goku y dotada de un zarcillo Pothala ha erradicado a los dioses y a casi toda la humanidad: Goku Black.',
    offscreen: [
      'En el futuro devastado, Bulma es asesinada frente a Trunks tras lograr sintetizar el combustible para el último viaje de la máquina.',
      'Mai del Futuro lidera el remanente de la resistencia armada en las ruinas subterráneas de la Capital del Oeste.',
      'Goku Black utiliza su Anillo del Tiempo para abrir una grieta dimensional y materializarse temporalmente en el presente para medir fuerzas con Goku.',
      'Beerus y Whis detectan en la firma de ki de Black la resonancia exacta de Zamasu, el aprendiz de Kaioshin del Universo 10 obsesionado con la justicia divina.',
    ],
  },
  {
    id: 'il-goku-black-exhibicion-zen',
    fromVolumeId: 'dbs-goku-black',
    toVolumeId: 'dbs-exhibicion-zen',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'cosmic-event',
    title: 'El borrado del futuro y el amigo para Zen-Oh',
    summary:
      'Tras vencer a Zamasu Fusionado con la espada de luz de Trunks y el borrado absoluto de la línea temporal por parte de Zen-Oh del Futuro, Goku rescata al pequeño monarca cósmico y lo lleva al presente para que sea el compañero de juegos del Gran Zen-Oh.',
    offscreen: [
      'Trunks y Mai viajan a una línea temporal paralela alternativa donde convivirán con versiones alternas de sí mismos.',
      'Goku visita el Palacio de Zen-Oh saltándose todos los protocolos divinos para recordar la promesa del gran torneo multiversal.',
      'El Gran Sacerdote convoca de inmediato a los doce universos para un torneo de exhibición previo al gran evento.',
      'Los Dioses de la Destrucción de todos los universos miran con furia y desprecio a Goku por poner en riesgo la existencia cósmica.',
    ],
  },
  {
    id: 'il-exhibicion-reclutamiento-u7',
    fromVolumeId: 'dbs-exhibicion-zen',
    toVolumeId: 'dbs-reclutamiento-u7',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'cosmic-event',
    title: 'La regla de la aniquilación y las 48 horas',
    summary:
      'El Torneo de Exhibición Zen concluye con la revelación más aterradora: Zen-Oh planeaba erradicar los universos con menor nivel de desarrollo mortal, y el Torneo del Poder será su única oportunidad de supervivencia. Los universos derrotados serán borrados de la existencia en el acto.',
    offscreen: [
      'El Gran Sacerdote concede un plazo improrrogable de 48 horas para que cada universo reúna un equipo de diez guerreros.',
      'Gohan recupera su instinto combativo entrenando hasta el agotamiento con Piccolo y acepta asumir la capitanía táctica del Universo 7.',
      'Krilin y Número 18 son reclutados tras comprobar su trabajo en equipo; Roshi entrena en secreto para superar sus debilidades mundanas.',
      'Majin Buu entrena sin parar, adelgaza y alcanza un estado atlético formidable antes de caer en un sueño profundo del que nadie puede despertarlo.',
    ],
  },
  {
    id: 'il-reclutamiento-torneo-poder',
    fromVolumeId: 'dbs-reclutamiento-u7',
    toVolumeId: 'dbs-torneo-del-poder',
    gap: { label: '48 h', scale: 'dias' },
    kind: 'transition',
    title: 'Cuenta atrás: el décimo guerrero del infierno',
    summary:
      'Con el reloj en cero y Majin Buu en coma de hibernación, Goku toma una decisión insólita que estremece a sus compañeros: viajar al infierno con Uranai Baba para otorgar un permiso de 24 horas a Freezer a cambio de resucitarlo si logran la victoria.',
    offscreen: [
      'Goku vuela a la Isla de los Monstruos para convencer al Androide 17, quien trabaja como guardabosques de animales mitológicos.',
      'Freezer negocia despiadadamente en su capullo del infierno, aceptando combatir solo bajo la promesa de una resurrección completa.',
      'El equipo de diez guerreros se reúne en la terraza de Capsule Corp, tomándose de las manos junto a Whis para ser transportados al Mundo de la Nada.',
      'En el Mundo de la Nada, los ochenta guerreros más poderosos de ocho universos contemplan una arena construida con el mineral más denso del cosmos: el Kachi Katchin.',
    ],
  },
  {
    id: 'il-torneo-poder-black-star',
    fromVolumeId: 'dbs-torneo-del-poder',
    toVolumeId: 'dbgt-black-star',
    gap: { label: '+9 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Nueve años: Broly, Super Hero y el epílogo con Uub',
    summary:
      'El Androide 17 gana el Torneo del Poder y pide revivir a todos los universos borrados. En los años venideros (Año 780 al 789), la Tierra presencia la llegada de Broly a la Tierra, la rebelión de la Patrulla Roja con Cell Max y el despertar de Gohan Bestia. En el Año 784, Goku conoce a Uub en el 28° Torneo y parte a entrenarlo durante cinco años.',
    offscreen: [
      'Goku y Vegeta se fusionan en Gogeta Azul para apaciguar a Broly en la Tierra ártica, forjando más tarde un vínculo amistoso en el planeta de Beerus.',
      'Gohan y Piccolo derrotan a Cell Max en las instalaciones subterráneas de la Nueva Patrulla Roja (Super Hero, Año 783).',
      'En el 28° Torneo de las Artes Marciales (Año 784), Goku identifica la reencarnación bondadosa de Buu en el niño Uub y vuela a su aldea para formarlo como protector del mundo.',
      'En el Año 789, un anciano emperador Pilaf escala el Templo Celeste y abre la bóveda secreta donde yacen las Esferas del Dragón de Estrella Negra.',
    ],
    movieIds: ['m20', 'm21'],
  },
  {
    id: 'il-black-star-baby',
    fromVolumeId: 'dbgt-black-star',
    toVolumeId: 'dbgt-baby-ssj4',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'transition',
    title: 'Viaje galáctico y el parásito tsufuru',
    summary:
      'Goku es convertido en niño por el error de Pilaf con las esferas de estrella negra y viaja por el cosmos junto a Trunks y Pan para reunirlas antes de que la Tierra explote en un año. Pero en el planeta M-2 descubren la peor amenaza: Baby, la creación biológica del extinto pueblo Tsufuru.',
    offscreen: [
      'El robot Gill traga el radar del dragón y se convierte en el navegador inseparable de la nave espacial.',
      'El Dr. Myuu coordina a sus Mutantes Máquina mientras Baby infecta el cuerpo de varios alienígenas para viajar a la Tierra.',
      'Dende y Mr. Popo observan preocupados desde el templo cómo el planeta comienza a sufrir desastres sísmicos por el uso de las esferas oscuras.',
    ],
  },
  {
    id: 'il-baby-super-17',
    fromVolumeId: 'dbgt-baby-ssj4',
    toVolumeId: 'dbgt-super-17',
    gap: { label: '+unos meses', scale: 'meses' },
    kind: 'context',
    title: 'El renacer del planeta Plant y el sacrificio de Piccolo',
    summary:
      'Baby infecta a toda la población de la Tierra y se adueña del cuerpo de Vegeta. Goku desata el legendario Super Saiyajin 4 tras dominar el mono gigante dorado y destruye al parásito lanzándolo al sol. La Tierra es evacuada antes de explotar y luego restaurada con las esferas de Namek.',
    offscreen: [
      'Piccolo toma la decisión de permanecer en la Tierra mientras estalla para que las Esferas de Estrella Negra queden destruidas para siempre con su muerte.',
      'En el Más Allá, el Dr. Myuu y el Dr. Gero se encuentran en el infierno y comienzan a conspirar una alianza científica para crear al androide definitivo.',
      'La humanidad reconstruye sus ciudades tras liberarse del control mental de los parásitos Tsufuru gracias al Agua Sagrada.',
    ],
  },
  {
    id: 'il-super-17-dragones',
    fromVolumeId: 'dbgt-super-17',
    toVolumeId: 'dbgt-dragones-malignos',
    gap: { label: 'Días después', scale: 'dias' },
    kind: 'context',
    title: 'La brecha del infierno y la sobrecarga negativa',
    summary:
      'Gero y Myuu abren un portal interdimensional desde el infierno fusionando al Androide 17 original con el 17 del infierno. Tras la caída del Súper 17 ante el Puño del Dragón de Goku y la venganza de Número 18, los héroes reúnen las esferas para reparar el desastre, pero las esferas se quiebran y emiten un humo negro.',
    offscreen: [
      'Antiguos villanos como Freezer, Cell y los miembros de la Patrulla Roja escapan temporalmente a la superficie antes de ser devueltos al infierno.',
      'Krilin muere asesinado por el Androide 17 bajo control mental, desatando la furia de Número 18.',
      'Las esferas del dragón han acumulado energía negativa a lo largo de décadas por deseos egoístas continuos, desatando a los siete Dragones Malignos sobre el mundo.',
    ],
  },
  {
    id: 'il-epilogo-dragones',
    fromVolumeId: 'dbgt-dragones-malignos',
    toVolumeId: null,
    gap: { label: '+100 años', scale: 'anios' },
    kind: 'time-jump',
    title: 'Cien años después: el legado del guerrero',
    summary:
      'Goku purifica a los dragones con la Genkidama Universal y se marcha sobre el lomo del verdadero Shenlong, fundiéndose con las esferas. Un siglo después (Año 889), la anciana Pan contempla cómo su tataranieto Goku Jr. busca la esfera de cuatro estrellas en el Monte Paoz para salvarle la vida.',
    offscreen: [
      'Las esferas del dragón descansan purificadas en el corazón del cosmos hasta que la humanidad demuestre no depender de milagros para resolver sus problemas.',
      'Pan funda y preserva el legado de la familia Son en la Tierra durante un siglo de paz ininterrumpida.',
      'El espíritu de Son Goku aparece en su vieja cabaña del Monte Paoz para alentar a Goku Jr. a no rendirse jamás y confiar en su propia fuerza.',
      'En el 64° Torneo de las Artes Marciales, Goku Jr. y Vegeta Jr. se transforman en Super Saiyajin, reiniciando el ciclo eterno de la rivalidad saiyajin bajo la estatua de Goku.',
    ],
    movieIds: ['sp3'],
  },
];
