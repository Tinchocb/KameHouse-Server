import type { BehindTheScenesNote, InterChapterEntry, KeyFact } from '../types';

/**
 * Lore curado por lapso (span id).
 *
 * - keyFacts: datos puntuales para leer de un vistazo.
 * - interChapter («Entre caps»): hilos que corren en paralelo o fuera de cámara.
 * - behindTheScenes: notas de producción.
 *
 * Regla editorial: solo hechos que se cuentan en la obra o que dijo su autor, citando
 * obra y saga; nada de niveles de poder de fans, fechas sin fuente ni páginas sin verificar.
 * Un lapso sin datos no muestra la sección: es preferible a rellenar.
 */
export interface SpanLore {
  keyFacts?: KeyFact[];
  interChapter?: InterChapterEntry[];
  behindTheScenes?: BehindTheScenesNote[];
}

export const SPAN_LORE: Record<string, SpanLore> = {
  'dbz-saiyajin-raditz': {
    keyFacts: [
      { label: 'Técnica decisiva', value: 'Makankōsappō de Piccolo' },
      { label: 'Baja', value: 'Goku, que muere junto a Raditz' },
      { label: 'Poder de Gohan', value: '1.307 en el rastreador de Raditz' },
      { label: 'Cuenta regresiva', value: 'Un año hasta Vegeta y Nappa' },
    ],
    interChapter: [
      {
        title: 'Por qué nadie puede matar a Piccolo',
        when: 'Año 761',
        summary:
          'Kami y Piccolo Daimaō fueron un solo ser que se dividió en dos. Si uno muere, muere el otro, y con Kami desaparecen las Esferas del Dragón. Por eso la alianza con Piccolo no es solo táctica: sin él tampoco hay forma de revivir a nadie.',
        source: 'Dragon Ball (manga) · Saga de Piccolo Daimaō',
      },
      {
        title: 'Goku en el Más Allá',
        when: 'Año 761–762',
        summary:
          'Kami intercede ante Enma y Goku recorre el Camino de la Serpiente, de un millón de kilómetros, hasta el planeta de Kaio del Norte. Allí la gravedad es diez veces la de la Tierra: atrapa a Bubbles, golpea a Gregory con un martillo y aprende el Kaio-ken y la Genki-dama.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin',
      },
      {
        title: 'Gohan solo en la naturaleza',
        when: 'Año 761–762',
        summary:
          'Piccolo deja a Gohan seis meses solo para que aprenda a sobrevivir. Una noche de luna llena el niño se transforma en Ōzaru; Piccolo destruye la luna y le corta la cola. Después lo entrena en persona hasta la llegada de los Saiyajin.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin',
      },
      {
        title: 'Entrenamiento en el templo de Kami',
        when: 'Año 761–762',
        summary: 'Krilin, Yamcha, Tenshinhan y Chaoz pasan el año entrenando con Kami y Mr. Popo.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin',
      },
    ],
    behindTheScenes: [
      {
        title: 'Nombres de verdura',
        text: 'Los Saiyajin llevan nombres que juegan con verduras: Kakarotto (carrot, zanahoria), Raditz (radish, rábano), Vegeta (vegetable, verdura) y Nappa (un tipo de repollo). Es la primera de las familias de nombres temáticos de Toriyama en Z.',
        source: 'Akira Toriyama · nombres de los personajes',
      },
    ],
  },

  'dbz-saiyajin-vegeta': {
    keyFacts: [
      { label: 'Bajas', value: 'Yamcha, Chaoz, Tenshinhan y Piccolo' },
      { label: 'Esferas del Dragón', value: 'Desaparecen al morir Piccolo y Kami' },
      { label: 'Golpe final', value: 'Gohan, convertido en Ōzaru, cae sobre Vegeta' },
      { label: 'Desenlace', value: 'Goku le perdona la vida a Vegeta' },
    ],
    interChapter: [
      {
        title: 'La carrera de vuelta',
        when: 'Año 762',
        summary:
          'Revivido con las esferas, Goku desanda el Camino de la Serpiente mientras sus amigos ya están peleando. Todo lo que pasa en el páramo ocurre contra reloj, esperando a que llegue.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin',
      },
      {
        title: 'Las bajas',
        when: 'Año 762',
        summary:
          'Yamcha muere a manos de un Saibaiman. Chaoz se autodestruye sobre Nappa sin lograr nada y Tenshinhan cae tras agotarse con el Kikōhō. Piccolo muere protegiendo a Gohan: con él mueren Kami y las Esferas del Dragón de la Tierra.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin',
      },
      {
        title: 'Entrenamiento en el planeta de Kaio',
        when: 'Año 762',
        summary:
          'Yamcha, Tenshinhan, Chaoz y Piccolo llegan al Más Allá y siguen los pasos de Goku: se entrenan con Kaio del Norte mientras sus amigos buscan la forma de revivirlos.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin / Saga de Namek',
      },
      {
        title: 'El camino a Namek',
        when: 'Año 762',
        summary:
          'Goku le perdona la vida a Vegeta, que huye en su nave. Por lo que dijo Vegeta, los guerreros descubren que Piccolo y Kami son namekianos y que Namek tiene sus propias esferas; Mr. Popo les muestra la nave con la que Kami llegó a la Tierra.',
        source: 'Dragon Ball Z (manga) · Saga Saiyajin / Saga de Namek',
      },
    ],
  },

  'dbz-namek-ginyu-freezer': {
    behindTheScenes: [
      {
        title: 'Un menú de lácteos',
        text: 'Freezer toma su nombre del congelador, y las Fuerzas Especiales Ginyu, de los lácteos: Ginyu (gyūnyū, leche), Recoome (cream, crema), Burter (butter, manteca), Jeice (cheese, queso) y Guldo (yogurt).',
        source: 'Akira Toriyama · nombres de los personajes',
      },
    ],
  },

  'dbz-freezer-super-saiyajin': {
    keyFacts: [
      { label: 'Detonante', value: 'Freezer mata a Krilin' },
      { label: 'Transformación', value: 'Goku despierta la leyenda del Super Saiyajin' },
      { label: 'Plazo', value: 'Namek estalla en cinco minutos' },
      { label: 'Escape', value: 'Goku huye en una nave de las Fuerzas Ginyu' },
    ],
    interChapter: [
      {
        title: 'Los deseos que vacían Namek',
        when: 'Año 762',
        summary:
          'Con Piccolo revivido vuelve Kami, y con él las esferas de la Tierra. Shenlong revive a todos los que mataron Freezer y sus hombres; así regresan Porunga y los namekianos, y el siguiente deseo lleva a la Tierra a todos los que estaban en Namek, salvo Goku y Freezer.',
        source: 'Dragon Ball Z (manga) · Saga de Freezer',
      },
      {
        title: 'Goku en Yardrat',
        when: 'Año 762–764',
        summary:
          'Goku escapa del planeta en una nave de las Fuerzas Ginyu y termina en Yardrat, donde aprende la teletransportación. Cuando intentan revivirlo con las esferas, el deseo no funciona: Goku no está muerto.',
        source: 'Dragon Ball Z (manga) · Saga de Freezer / Saga de los Androides',
      },
    ],
    behindTheScenes: [
      {
        title: 'Por qué el pelo rubio',
        text: 'Toriyama contó que dibujar el pelo del Super Saiyajin claro le ahorraba a su asistente el trabajo de entintarlo de negro en cada viñeta.',
        source: 'Akira Toriyama · entrevistas',
      },
    ],
  },

  'dbz-juegos-de-cell': {
    keyFacts: [
      { label: 'Detonante', value: 'Cell destruye la cabeza del Androide 16' },
      { label: 'Transformación', value: 'Gohan alcanza el Super Saiyajin 2' },
      { label: 'Sacrificio', value: 'Goku se lleva a Cell al planeta de Kaio' },
      { label: 'Esferas del Dragón', value: 'Dende, nuevo Kami, las recupera' },
    ],
    interChapter: [
      {
        title: 'Los diez días',
        when: 'Año 767',
        summary:
          'Cell anuncia su torneo por televisión y da diez días de plazo. Goku y Gohan salen de la Habitación del Espíritu y el Tiempo y, en vez de seguir entrenando, descansan.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
      {
        title: 'Un nuevo Kami',
        when: 'Año 767',
        summary:
          'Goku usa la teletransportación para ir al nuevo planeta de los namekianos y traer a Dende, que ocupa el lugar de Kami y vuelve a crear las Esferas del Dragón.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
      {
        title: 'Los deseos',
        when: 'Año 767',
        summary:
          'Shenlong revive a todos los que mató Cell, pero no puede traer a Goku porque ya lo revivió una vez. Goku rechaza que lo revivan con las esferas de Namek y se queda en el Más Allá. Krilin usa el otro deseo para quitarles la bomba a los Androides 17 y 18.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
      {
        title: 'La versión oficial',
        when: 'Año 767',
        summary: 'El mundo cree que Mr. Satan derrotó a Cell, y los guerreros lo dejan así.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
    ],
    behindTheScenes: [
      {
        title: 'Gohan como relevo',
        text: 'Toriyama pensaba que Gohan tomara el lugar de Goku como protagonista después de los Juegos de Cell, pero con el tiempo le devolvió el protagonismo a Goku.',
        source: 'Akira Toriyama · entrevistas',
      },
    ],
  },
};
