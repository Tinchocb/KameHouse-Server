import type { BehindTheScenesNote, InterChapterEntry, KeyFact } from '../types';

/**
 * Lore curado por lapso (span id).
 *
 * - keyFacts: datos puntuales para leer de un vistazo (deben ser pares y sin etiquetas duplicadas).
 * - interChapter («Entre caps»): hilos que corren en paralelo o fuera de cámara.
 * - behindTheScenes: notas de producción.
 *
 * Regla editorial: solo hechos que se cuentan en la obra o que dijo su autor, citando
 * obra y saga; nada de niveles de poder de fans, fechas sin fuente ni páginas sin verificar.
 */
interface SpanLore {
  keyFacts?: KeyFact[];
  interChapter?: InterChapterEntry[];
  behindTheScenes?: BehindTheScenesNote[];
}

export const SPAN_LORE: Record<string, SpanLore> = {
  // ── CLÁSICO ──────────────────────────────────────────────────────────────
  'db-pilaf-busqueda': {
    keyFacts: [
      { label: 'Primer encuentro', value: 'Goku y Bulma en el Monte Paoz' },
      { label: 'Deseo a Shenlong', value: 'Oolong pide unas bragas para frustrar a Pilaf' },
      { label: 'Transformación', value: 'Goku en Ōzaru destruye el castillo' },
      { label: 'Desenlace', value: 'Yamcha y Puar le cortan la cola a Goku' },
    ],
    interChapter: [
      {
        title: 'El origen del radar del dragón',
        when: 'Año 749',
        summary:
          'Bulma descubrió la esfera de dos estrellas en el desván de su casa en la Capital del Oeste. Al analizar su composición, descubrió que emitía una frecuencia de ondas electromagnéticas única y construyó el radar para rastrear las demás.',
        source: 'Dragon Ball (manga) · Saga de Pilaf',
      },
      {
        title: 'La vida solitaria en el Monte Paoz',
        when: 'Año 749',
        summary:
          'Goku vivió solo en la montaña tras el fallecimiento de su abuelo Son Gohan, guardando la esfera de cuatro estrellas como un tesoro sagrado e ignorando que él mismo lo había aplastado accidentalmente durante una luna llena.',
        source: 'Dragon Ball (manga) · Saga de Pilaf',
      },
    ],
    behindTheScenes: [
      {
        title: 'Inspiración en Viaje al Oeste',
        text: 'Akira Toriyama diseñó la obra como una reinterpretación humorística del clásico chino Viaje al Oeste: Goku encarna al Rey Mono Sun Wukong, Bulma al monje Xuanzang y Oolong al cerdo Zhu Bajie.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'db-torneo-21-combates': {
    keyFacts: [
      { label: 'Ganador', value: 'Jackie Chun (el Maestro Roshi)' },
      { label: 'Finalista', value: 'Son Goku' },
      { label: 'Técnica imitada', value: 'Goku replica el Kamehameha a la primera' },
      { label: 'Destrucción', value: 'Roshi destruye la luna para frenar al mono gigante' },
    ],
    interChapter: [
      {
        title: 'El secreto de Jackie Chun',
        when: 'Año 750',
        summary:
          'Roshi se inscribió con identidad falsa temiendo que si sus jóvenes alumnos ganaban el torneo con tanta facilidad se volverían presumidos y abandonarían el deseo de superarse.',
        source: 'Dragon Ball (manga) · Saga del 21° Torneo',
      },
      {
        title: 'El agua para la aldea de Nam',
        when: 'Año 750',
        summary:
          'Nam compitió para salvar a su pueblo de una devastadora sequía. Roshi, impresionado por su nobleza, le regaló cápsulas de almacenamiento Hoi-Poi para transportar agua sin cobrarle nada.',
        source: 'Dragon Ball (manga) · Saga del 21° Torneo',
      },
    ],
    behindTheScenes: [
      {
        title: 'El giro hacia los torneos',
        text: 'Su editor Kazuhiko Torishima sugirió la estructura de un torneo de artes marciales para dinamizar la popularidad de la serie en la revista Shōnen Jump, transformando para siempre la identidad del manga.',
        source: 'Kazuhiko Torishima · entrevistas',
      },
    ],
  },

  'db-rr-tao-pai-pai': {
    keyFacts: [
      { label: 'Objetivo de Red', value: 'Crecer de estatura con las esferas' },
      { label: 'Torre Karin', value: 'Goku entrena tres días con el maestro Karin' },
      { label: 'Asesino letal', value: 'Tao Pai Pai derrota a Goku en su primer duelo' },
      { label: 'Desmantelamiento', value: 'Goku arrasa el cuartel general en solitario' },
    ],
    interChapter: [
      {
        title: 'La verdad sobre el Agua Sagrada',
        when: 'Año 750',
        summary:
          'Karin le confiesa a Goku que el agua no tiene propiedades mágicas: el verdadero aumento de fuerza provino del esfuerzo sobrehumano de intentar quitársela al gato sabio durante tres días a gran altura.',
        source: 'Dragon Ball (manga) · Saga de la Patrulla Roja',
      },
      {
        title: 'La ejecución del Comandante Red',
        when: 'Año 750',
        summary:
          'Al descubrir que Red sacrificó regimientos enteros simplemente por vanidad y complejo de estatura en lugar de aspirar a dominar el mundo, su lugarteniente Black le dispara sin piedad.',
        source: 'Dragon Ball (manga) · Saga de la Patrulla Roja',
      },
    ],
    behindTheScenes: [
      {
        title: 'Iconografía militar y cine de espías',
        text: 'La Patrulla Roja rinde tributo a las películas clásicas de James Bond y al cine bélico, con generales identificados con nombres de colores como White, Blue y Metallic.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'db-uranai-baba-reencuentro': {
    keyFacts: [
      { label: 'Condición de Baba', value: '10 millones de zenis o vencer a cinco campeones' },
      { label: 'Último contrincante', value: 'Son Gohan (el abuelo de Goku con máscara)' },
      { label: 'Séptima esfera', value: 'Pilaf la escondió en un estuche anti-radar' },
      { label: 'Deseo concedido', value: 'Bora es resucitado por Shenlong' },
    ],
    interChapter: [
      {
        title: 'El abrazo del abuelo Gohan',
        when: 'Año 750',
        summary:
          'Uranai Baba otorga a Son Gohan un permiso de un día en el mundo de los vivos. Tras comprobar en combate que su nieto ha madurado y revelarle su punto débil en la cola, se quita la máscara de zorro para abrazarlo.',
        source: 'Dragon Ball (manga) · Saga de Uranai Baba',
      },
      {
        title: 'La hermandad mística',
        when: 'Año 750',
        summary:
          'Uranai Baba es la hermana mayor del Maestro Roshi. Su palacio actúa como la aduana espiritual que conecta el mundo de los vivos con el juicio de Enma-sama.',
        source: 'Daizenshuu 7',
      },
    ],
    behindTheScenes: [
      {
        title: 'Monstruos del cine clásico',
        text: 'Los guerreros de Baba rinden tributo directo a los monstruos clásicos de la productora Universal: Drácula, el Hombre Invisible, la Momia y el Hombre Lobo.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'db-torneo-22-combates': {
    keyFacts: [
      { label: 'Campeón', value: 'Tenshinhan' },
      { label: 'Duelo de escuelas', value: 'Estilo Tortuga contra Estilo Grulla' },
      { label: 'Punto de inflexión', value: 'Tenshinhan renuncia a matar y busca el honor' },
      { label: 'Final accidentado', value: 'Goku cae un segundo antes al golpear un camión' },
    ],
    interChapter: [
      {
        title: 'El consejo de Roshi',
        when: 'Año 753',
        summary:
          'Roshi combate como Jackie Chun contra Tenshinhan y salta deliberadamente fuera del cuadrilátero para advertirle que un talento tan formidable no debe ser mancillado por el rencor de Tsuru.',
        source: 'Dragon Ball (manga) · Saga del 22° Torneo',
      },
      {
        title: 'La rebelión de los discípulos',
        when: 'Año 753',
        summary:
          'Cuando el maestro Tsuru ordena a Chaoz inmovilizar a Goku con telequinesis durante la final, Tenshinhan detiene el combate y amenaza a su propio maestro para exigir una pelea justa.',
        source: 'Dragon Ball (manga) · Saga del 22° Torneo',
      },
    ],
    behindTheScenes: [
      {
        title: 'El clan de los tres ojos',
        text: 'Toriyama concibió a Tenshinhan con un tercer ojo místico, otorgándole habilidades basadas en la concentración y la disciplina extrema del budismo Zen.',
        source: 'Daizenshuu 7',
      },
    ],
  },

  'db-piccolo-daimaku-climax': {
    keyFacts: [
      { label: 'Bajas clave', value: 'Krilin, Roshi, Chaoz y el dragón Shenlong' },
      { label: 'Deseo de Piccolo', value: 'Recuperar su juventud y vigor eterno' },
      { label: 'Potenciador', value: 'El Agua Ultra Sagrada liberada por Karin' },
      { label: 'Ataque final', value: 'Puño del Dragón impulsado con un solo brazo' },
    ],
    interChapter: [
      {
        title: 'El sacrificio del Mafūba',
        when: 'Año 753',
        summary:
          'El Maestro Roshi duerme a Tenshinhan para protegerlo e intenta encerrar a Piccolo Daimaoh en la arrocera electrónica con el Mafūba. La técnica falla por poco y Roshi muere consumido por el gasto de ki.',
        source: 'Dragon Ball (manga) · Saga de Piccolo Daimaō',
      },
      {
        title: 'El asesinato de Shenlong',
        when: 'Año 753',
        summary:
          'Inmediatamente después de ver cumplido su deseo de rejuvenecer, Piccolo lanza una descarga de energía a quemarropa que vaporiza a Shenlong, convencido de que así nadie podrá resucitar a sus enemigos.',
        source: 'Dragon Ball (manga) · Saga de Piccolo Daimaō',
      },
    ],
    behindTheScenes: [
      {
        title: 'La entrada de la pura maldad',
        text: 'Toriyama señaló que hasta ese momento sus antagonistas tenían un trasfondo cómico. Piccolo Daimaoh fue diseñado expresamente como un monstruo cruel para generar verdadera angustia en los lectores.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'db-piccolo-jr-torneo-final': {
    keyFacts: [
      { label: 'Campeón', value: 'Son Goku (su único campeonato mundial oficial)' },
      { label: 'Finalista', value: 'Piccolo Jr.' },
      { label: 'Intento divino', value: 'Kamisama intenta sellar a Piccolo con el Mafūba' },
      { label: 'Compromiso', value: 'Goku cumple su promesa y formaliza su boda con Milk' },
    ],
    interChapter: [
      {
        title: 'Goku adulto en el torneo',
        when: 'Año 756',
        summary:
          'Goku se presenta con tres años de entrenamiento y un cuerpo crecido y robusto. Sus amigos de Kame House no lo reconocen hasta que se despoja de su turbante empapado por la lluvia.',
        source: 'Dragon Ball (manga) · Saga del 23° Torneo',
      },
      {
        title: 'La inversión del Mafūba',
        when: 'Año 756',
        summary:
          'Kamisama entra al torneo poseyendo el cuerpo de un humano llamado Shen. Al intentar atrapar a Piccolo Jr. con el Mafūba, Piccolo anticipa el flujo de ki y revierte el vórtice, encerrando al Dios de la Tierra en el frasco.',
        source: 'Dragon Ball (manga) · Saga del 23° Torneo',
      },
    ],
    behindTheScenes: [
      {
        title: 'La disputa por hacer crecer a Goku',
        text: 'La dirección editorial de Shueisha se opuso vehementemente a envejecer a Goku por temor a perder ventas, pero Toriyama insistió en que el personaje debía crecer para ejecutar coreografías marciales más adultas.',
        source: 'Kazuhiko Torishima · entrevistas',
      },
    ],
  },

  // ── DRAGON BALL Z ────────────────────────────────────────────────────────
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

  'dbz-saiyajin-nappa-vegeta': {
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

  'dbz-namek-viaje-llegada': {
    keyFacts: [
      { label: 'Nave de Kami', value: 'Viaje de Bulma, Krilin y Gohan a Namek' },
      { label: 'Nave de Goku', value: 'Gravedad x100 construida por el Dr. Brief' },
      { label: 'Llegada de Freezer', value: 'Búsqueda brutal de las esferas gigantes' },
      { label: 'Recuperación de Vegeta', value: 'Zenkai en el Planeta Freezer 79' },
    ],
    interChapter: [
      {
        title: 'El viaje a Namek',
        when: 'Año 762',
        summary:
          'Bulma, Krilin y Gohan tardan más de un mes en llegar a Namek a bordo de la nave espacial ancestral con la que Kami-sama llegó a la Tierra miles de años atrás.',
        source: 'Dragon Ball Z (manga) · Saga de Namek',
      },
      {
        title: 'Los Zenkais en gravedad x100',
        when: 'Año 762',
        summary:
          'Goku aprovecha los seis días de travesía espacial sometiéndose a una gravedad cien veces superior a la terrestre, consumiendo semillas del ermitaño al borde del colapso para multiplicar su poder exponencialmente.',
        source: 'Dragon Ball Z (manga) · Saga de Namek',
      },
    ],
    behindTheScenes: [
      {
        title: 'La raíz de los namekianos',
        text: 'Toriyama creó el nombre de Namek a partir de namekuji (babosa en japonés). Por eso muchos guerreros namekianos como Dende, Nail o Cargo tienen nombres derivados de caracoles y moluscos.',
        source: 'Akira Toriyama · nombres de los personajes',
      },
    ],
  },

  'dbz-namek-fuerzas-ginyu': {
    keyFacts: [
      { label: 'Llegada de élite', value: 'Fuerzas Especiales Ginyu convocadas por Freezer' },
      { label: 'Alianza forzada', value: 'Vegeta pacta con Krilin y Gohan' },
      { label: 'Poder latente', value: 'El Gran Patriarca libera la fuerza de Gohan y Krilin' },
      { label: 'Intercambio', value: 'Ginyu cambia de cuerpo con Goku usando el Body Change' },
    ],
    interChapter: [
      {
        title: 'La clave en namekiano',
        when: 'Año 762',
        summary:
          'Freezer reúne las siete esferas pero no puede usarlas porque ignora la contraseña secreta y el idioma nativo necesario para invocar al dragón Polunga.',
        source: 'Dragon Ball Z (manga) · Saga de Freezer',
      },
      {
        title: 'El error de Ginyu',
        when: 'Año 762',
        summary:
          'Ginyu roba el cuerpo de Goku pero solo puede usar una fracción de su ki porque desconoce cómo coordinar la mente y el espíritu que exige el Kaioken.',
        source: 'Dragon Ball Z (manga) · Saga de Freezer',
      },
    ],
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

  'dbz-garlic-jr': {
    keyFacts: [
      { label: 'Antagonista inmortal', value: 'Garlic Jr., sellado antes en la Zona Muerta' },
      { label: 'Veneno cósmico', value: 'Agua de la Niebla Negra que convierte en demonios' },
      { label: 'Ausencia de Goku', value: 'Goku entrena en el planeta Yardrat' },
      { label: 'Héroe decisivo', value: 'Gohan destruye el planeta Makyo' },
    ],
    interChapter: [
      {
        title: 'El planeta Makyo',
        when: 'Año 764',
        summary:
          'El planeta Makyo pasa cerca de la Tierra cada 5.000 años, multiplicando el poder de los demonios de Garlic Jr. Gohan destruye el satélite maligno con su escudo de ki.',
        source: 'Dragon Ball Z (anime) · Saga de Garlic Jr.',
      },
      {
        title: 'El Agua Ultra Sagrada en el Templo',
        when: 'Año 764',
        summary:
          'Piccolo y Krilin fingen estar poseídos por la niebla para ganar tiempo mientras Kamisama y Mr. Popo vierten el Agua Ultra Sagrada por los respiraderos de las corrientes del mundo.',
        source: 'Dragon Ball Z (anime) · Saga de Garlic Jr.',
      },
    ],
    behindTheScenes: [
      {
        title: 'El primer arco exclusivo del anime',
        text: 'Esta saga fue creada por Toei Animation como arco puente para dar tiempo a Akira Toriyama de avanzar en el manga antes del inicio de la Saga de los Androides.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'dbz-androides-trunks': {
    keyFacts: [
      { label: 'El joven del futuro', value: 'Trunks decapita a Mecha Freezer y al Rey Cold' },
      { label: 'Medicina clave', value: 'Antídoto para la cardiopatía mortal de Goku' },
      { label: 'Fecha señalada', value: '12 de mayo a las 9:00 AM en isla Amenbo' },
      { label: 'Despertar', value: 'Los androides 17 y 18 asesinan a su creador Gero' },
    ],
    interChapter: [
      {
        title: 'La segunda máquina del tiempo',
        when: 'Año 767',
        summary:
          'Bulma y Trunks descubren una máquina del tiempo idéntica a la suya cubierta de musgo. En su interior hallan la cáscara de un organismo monstruoso: Cell viajó cuatro años antes que Trunks.',
        source: 'Dragon Ball Z (manga) · Saga de los Androides',
      },
      {
        title: 'El entrenamiento de Vegeta',
        when: 'Año 764–767',
        summary:
          'Al enterarse de que otro saiyajin puede convertirse en Super Saiyajin, Vegeta somete su cuerpo a gravedad x300 en Capsule Corp hasta despertar la transformación por puro rencor a sus límites.',
        source: 'Dragon Ball Z (manga) · Saga de los Androides',
      },
    ],
    behindTheScenes: [
      {
        title: 'Los cambios de villano',
        text: 'Su antiguo editor Torishima llamó a Toriyama para quejarse de que los androides 19 y 20 parecían «un anciano y un gordinflón». Cuando Toriyama introdujo a 17 y 18, Torishima protestó diciendo que eran «unos mocosos», obligándolo a idear a Cell.',
        source: 'Kazuhiko Torishima · entrevistas',
      },
    ],
  },

  'dbz-cell-semiperfecto': {
    keyFacts: [
      { label: 'Fusión namekiana', value: 'Piccolo se asimila con Kamisama' },
      { label: 'Absorción primera', value: 'Cell absorbe al Androide 17' },
      { label: 'Súper Vegeta', value: 'Vegeta humilla a Cell Semiperfecto' },
      { label: 'Cuerpo perfecto', value: 'Cell absorbe a 18 con ayuda de la soberbia de Vegeta' },
    ],
    interChapter: [
      {
        title: 'La extinción de las esferas',
        when: 'Año 767',
        summary:
          'Al fusionarse Kamisama con Piccolo, la deidad deja de existir como ente rector y las Esferas del Dragón de la Tierra se convierten en piedra ordinaria, dejando al mundo sin resurrecciones.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
      {
        title: 'La soberbia de los saiyajin',
        when: 'Año 767',
        summary:
          'Vegeta permite conscientemente que Cell absorba a Número 18 para poder enfrentarse a un rival en su máxima plenitud, llegando a atacar a su propio hijo Trunks para evitar que este destruya a la androide.',
        source: 'Dragon Ball Z (manga) · Saga de Cell',
      },
    ],
    behindTheScenes: [
      {
        title: 'El tormento de dibujar las motas de Cell',
        text: 'Toriyama confesó que el diseño manchado de Cell fue una pesadilla semanal para dibujar y entintar, lo que aceleró su deseo de hacerlo evolucionar hacia formas más limpias.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'dbz-cell-gohan-ssj2-final': {
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

  'dbz-torneo-otro-mundo': {
    keyFacts: [
      { label: 'Campeón compartido', value: 'Goku y Paikuhan (descalificados por tocar el techo)' },
      { label: 'Gran rival', value: 'Paikuhan, campeón del cuadrante oeste' },
      { label: 'Técnica inédita', value: 'Súper Kaioken combinado con Super Saiyajin' },
      { label: 'Premio supremo', value: 'Entrenamiento personal con el Gran Kaio-sama' },
    ],
    interChapter: [
      {
        title: 'Las ventajas de un cuerpo muerto',
        when: 'Año 767',
        summary:
          'Goku descubre en el Más Allá que los cuerpos espirituales no sufren el desgaste de energía celular que limita a los seres vivos en la Tierra, permitiéndole forzar multiplicadores extremos.',
        source: 'Dragon Ball Z (anime) · Torneo del Más Allá',
      },
      {
        title: 'La música del Gran Kaio',
        when: 'Año 767',
        summary:
          'El Gran Kaio-sama viste como un rockero con radio portátil y gafas de sol, retrasando su lección prometida a los vencedores alegando que ambos tocaron el techo del cuadrilátero.',
        source: 'Dragon Ball Z (anime) · Torneo del Más Allá',
      },
    ],
    behindTheScenes: [
      {
        title: 'Diseño de Paikuhan por Toriyama',
        text: 'Aunque es una saga de anime, Akira Toriyama diseñó personalmente a Paikuhan basándose en una fisonomía similar a Piccolo para darle un aire de guerrero solemne y honorable.',
        source: 'Akira Toriyama · Daizenshuu 5',
      },
    ],
  },

  'dbz-buu-despertar-sacrificio': {
    keyFacts: [
      { label: 'Permiso terrenal', value: 'Goku regresa por 24 horas para el torneo' },
      { label: 'Mundo demoníaco', value: 'Dabura, rey del mal, actúa a las órdenes de Babidi' },
      { label: 'Orgullo herido', value: 'Vegeta se entrega a la posesión Majin' },
      { label: 'Sacrificio supremo', value: 'Vegeta se autodestruye para salvar a los suyos' },
    ],
    interChapter: [
      {
        title: 'El nacimiento de Goten',
        when: 'Año 767–774',
        summary:
          'Son Goten nació poco después de la batalla contra Cell. Creció jugando con Trunks y aprendió a convertirse en Super Saiyajin sin el tormento emocional que necesitaron sus predecesores.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
      {
        title: 'El pacto con Babidi',
        when: 'Año 774',
        summary:
          'Vegeta permitió conscientemente que el sello Majin de Babidi entrara en su mente para liberarse de la compasión que había adquirido viviendo en la Tierra y forzar una batalla a muerte con Goku.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
    ],
    behindTheScenes: [
      {
        title: 'El encanto de Cenicienta',
        text: 'Los nombres de los magos y del monstruo forman un juego de palabras musical tomado del conjuro de la película Cenicienta de Disney: «Bibbidi-Bobbidi-Boo» (Bibidi, Babidi, Buu).',
        source: 'Akira Toriyama · nombres de los personajes',
      },
    ],
  },

  'dbz-buu-ssj3-fusion-dance': {
    keyFacts: [
      { label: 'Forma divina', value: 'Goku exhibe el Super Saiyajin 3' },
      { label: 'Danza metamorana', value: 'Goku enseña la Fusión a Goten y Trunks' },
      { label: 'Mascota de Buu', value: 'Mr. Satán y el perro Bee ablandan al monstruo' },
      { label: 'Nacimiento del mal', value: 'Super Buu surge de la ira expulsada por el Buu gordo' },
    ],
    interChapter: [
      {
        title: 'El costo del Super Saiyajin 3',
        when: 'Año 774',
        summary:
          'El Super Saiyajin 3 consume una cantidad tan desorbitada de energía vital que consumió de golpe las horas que le quedaban a Goku en la Tierra, obligándolo a despedirse de sus hijos antes de tiempo.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
      {
        title: 'La liberación del Anciano Kaioshin',
        when: 'Año 774',
        summary:
          'Al quebrarse la legendaria Espada Z en el Mundo Sagrado, emerge el Kaioshin de hace 15 generaciones, sellado allí milenios atrás por el Dios de la Destrucción Beerus.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
    ],
    behindTheScenes: [
      {
        title: 'Diseño sin cejas del SSJ3',
        text: 'Para diferenciar el SSJ3 de las formas anteriores, Toriyama eliminó las cejas pronunciando el arco superciliar y alargó la melena dorada hasta la cintura para otorgarle un aspecto salvaje e intimidante.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  'dbz-buu-gohan-mistico': {
    keyFacts: [
      { label: 'Fusión cómica', value: 'Gotenks SSJ3 y los Fantasmas Kamikaze' },
      { label: 'Poder definitivo', value: 'Gohan Místico domina a Super Buu sin esfuerzo' },
      { label: 'Estrategia de Buu', value: 'Absorbe a Gotenks y a Piccolo por sorpresa' },
      { label: 'Acorralado', value: 'Gohan es absorbido tras vencerse el tiempo de Gotenks' },
    ],
    interChapter: [
      {
        title: 'El exterminio de la humanidad',
        when: 'Año 774',
        summary:
          'Super Buu sube al Templo Sagrado y, aburrido de esperar a su oponente, dispara desde su dedo miles de rayos de ki guiados que exterminan a casi todos los seres humanos del planeta en minutos.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
      {
        title: 'La ruptura dimensional',
        when: 'Año 774',
        summary:
          'Piccolo destruye la entrada a la Sala del Espíritu y el Tiempo para sepultar a Buu, pero el monstruo ruge con tanta furia que abre un portal dimensional entre dimensiones a base de pura vibración de ki.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
    ],
    behindTheScenes: [
      {
        title: 'El humor desenfadado de Gotenks',
        text: 'Toriyama disfrutó enormemente escribiendo los combates de Gotenks, usando ataques disparatados como el ataque de los donuts de ki o los fantasmas para aligerar la tensión dramática del final de Z.',
        source: 'Akira Toriyama · entrevistas',
      },
    ],
  },

  'dbz-buu-vegetto-kidbuu': {
    keyFacts: [
      { label: 'Unión Pothala', value: 'Fusión de Goku y Vegeta en Vegetto' },
      { label: 'Involución letal', value: 'Nacimiento de Kid Buu tras arrancar al Buu gordo' },
      { label: 'Aniquilación', value: 'Kid Buu hace estallar el planeta Tierra' },
      { label: 'Técnica victoriosa', value: 'Súper Genkidama con la energía de la humanidad' },
    ],
    interChapter: [
      {
        title: 'El plan de Vegetto',
        when: 'Año 774',
        summary:
          'Vegetto fingió arrogancia deliberadamente para forzar a Buu a absorberlo con una barrera mágica y poder rescatar a sus hijos y amigos atrapados en las entrañas del monstruo.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
      {
        title: 'El papel de Mr. Satán',
        when: 'Año 774',
        summary:
          'Cuando la humanidad desconfiaba de la voz telepática de Goku y Vegeta, fue el llamamiento de Mr. Satán lo que convenció a los terrícolas de levantar los brazos para completar la Genkidama.',
        source: 'Dragon Ball Z (manga) · Saga de Majin Buu',
      },
    ],
    behindTheScenes: [
      {
        title: 'El adiós al manga original',
        text: 'Tras diez años ininterrumpidos y 519 capítulos de serialización semanal, Toriyama cerró la historia original con Goku volando con el pequeño Uub hacia el horizonte.',
        source: 'Akira Toriyama · Daizenshuu 2',
      },
    ],
  },

  // ── DRAGON BALL DAIMA ────────────────────────────────────────────────────
  'db-daima-conspiracion': {
    keyFacts: [
      { label: 'Reino de origen', value: 'El Reino Demoníaco (Makai)' },
      { label: 'Conspiradores', value: 'Rey Gomah, Degesu y la científica Arinsu' },
      { label: 'Hechizo ejecutado', value: 'Los Guerreros Z son transformados en niños' },
      { label: 'Nombre namekiano', value: 'Neva, el creador de las esferas del inframundo' },
    ],
    interChapter: [
      {
        title: 'El temor a los mortales',
        when: 'Año 774–775',
        summary:
          'Tras la aniquilación de Dabura y Kid Buu, los gobernantes del Reino Demoníaco revisaron con horror las imágenes de la batalla en la Tierra y concibieron el rejuvenecimiento forzado como su única garantía de defensa.',
        source: 'Dragon Ball Daima (anime)',
      },
      {
        title: 'Las esferas demoníacas',
        when: 'Año 774–775',
        summary:
          'A diferencia de las esferas terrestres, las esferas del Reino Demoníaco están custodiadas por colosales guerreros acorazados llamados Tamagami y poseen reglas arcanas fijadas por el anciano Neva.',
        source: 'Dragon Ball Daima (anime)',
      },
    ],
    behindTheScenes: [
      {
        title: 'La última gran obra de Toriyama',
        text: 'Daima fue concebida, escrita y supervisada con profunda devoción personal por Akira Toriyama antes de su fallecimiento en 2024, diseñando personalmente el mundo, las razas y los vehículos.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'db-daima-climax': {
    keyFacts: [
      { label: 'Arma recuperada', value: 'El Báculo Sagrado (Nyoibō) de Goku' },
      { label: 'Nuevos aliados', value: 'Glorio y la mecánica Panzy' },
      { label: 'Amenaza sintética', value: 'Majin Kuu creado a partir de semillas Súper' },
      { label: 'Resolución', value: 'Regreso a la Tierra y restauración del estatus' },
    ],
    interChapter: [
      {
        title: 'Física del Reino Demoníaco',
        when: 'Año 775',
        summary:
          'El Reino Demoníaco se divide en tres niveles estancos con gravedad densa y gases que entorpecen la manipulación del ki ordinario, obligando a los combatientes a apoyarse en armas y destreza física.',
        source: 'Dragon Ball Daima (anime)',
      },
      {
        title: 'El linaje de los Glind',
        when: 'Año 775',
        summary:
          'Shin y Degesu pertenecen a la raza original de los Glind que brotó de los árboles mágicos del Reino Demoníaco antes de que una rama emigrara al reino celestial de los Kaioh.',
        source: 'Dragon Ball Daima (anime)',
      },
    ],
    behindTheScenes: [
      {
        title: 'El retorno a las raíces de aventura',
        text: 'Toriyama buscó deliberadamente recuperar el tono de humor, exploración y combate cuerpo a cuerpo con bastón que caracterizó los primeros años de Dragon Ball Clásico.',
        source: 'Akira Toriyama · comentarios oficiales',
      },
    ],
  },

  // ── DRAGON BALL SUPER ────────────────────────────────────────────────────
  'dbs-dioses-batalla': {
    keyFacts: [
      { label: 'Despertar divino', value: 'Lord Beerus despierta tras 39 años de siesta' },
      { label: 'Ritual mítico', value: 'Seis saiyajin de corazón puro invocan al Super Saiyajin Dios' },
      { label: 'Gesto de piedad', value: 'Beerus simula quedarse dormido y no destruye la Tierra' },
      { label: 'Guardián supremo', value: 'Whis se revela como el maestro del Dios de la Destrucción' },
    ],
    interChapter: [
      {
        title: 'La sexta saiyajin',
        when: 'Año 778',
        summary:
          'Al faltar un saiyajin para completar los seis requeridos por la leyenda, Videl revela que está embarazada de Son Gohan: la energía del feto de Pan completa el ritual que otorga el ki divino a Goku.',
        source: 'Dragon Ball Super · Saga de la Batalla de los Dioses',
      },
      {
        title: 'La jerarquía celestial',
        when: 'Año 778',
        summary:
          'Beerus revela que su universo es solo el séptimo de un total de doce universos gemelos, expandiendo la cosmología hacia dimensiones inexploradas.',
        source: 'Dragon Ball Super · Saga de la Batalla de los Dioses',
      },
    ],
    behindTheScenes: [
      {
        title: 'Nombres con sabor a licor',
        text: 'Siguiendo la tradición de juegos de palabras, los dioses y ángeles llevan nombres de bebidas alcohólicas: Beerus (cerveza), Whis (whisky) y Champa (champagne).',
        source: 'Akira Toriyama · entrevistas',
      },
    ],
  },

  'dbs-resurreccion-dorado': {
    keyFacts: [
      { label: 'Resurrección', value: 'Sorbet utiliza las esferas terrestres para revivir a Freezer' },
      { label: 'Nueva forma', value: 'Golden Freezer tras cuatro meses de entrenamiento' },
      { label: 'Evolución saiyajin', value: 'Super Saiyajin Blue dominado por Goku y Vegeta' },
      { label: 'Salvación límite', value: 'Whis retrocede el tiempo tres minutos para salvar la Tierra' },
    ],
    interChapter: [
      {
        title: 'El entrenamiento en el templo de Beerus',
        when: 'Año 779',
        summary:
          'Goku y Vegeta aprenden a evitar que el ki se desborde al exterior de su aura, condensando la energía divina dentro de su masa muscular para alcanzar el estado de Super Saiyajin Blue.',
        source: 'Dragon Ball Super · Saga de la Resurrección de F',
      },
      {
        title: 'La debilidad de Golden Freezer',
        when: 'Año 779',
        summary:
          'Freezer partió a la Tierra inmediatamente tras alcanzar su nueva forma sin acostumbrarse a su consumo energético, sufriendo un desgaste masivo que le costó la victoria.',
        source: 'Dragon Ball Super · Saga de la Resurrección de F',
      },
    ],
    behindTheScenes: [
      {
        title: 'Inspiración en Maximum the Hormone',
        text: 'Toriyama tituló la película tras escuchar la canción «F» de la banda japonesa de heavy metal Maximum the Hormone, la cual fue escrita como homenaje al tirano espacial.',
        source: 'Akira Toriyama · notas de producción',
      },
    ],
  },

  'dbs-torneo-u6-hit': {
    keyFacts: [
      { label: 'Recompensa cósmica', value: 'Las siete Súper Esferas del Dragón del tamaño de planetas' },
      { label: 'Técnica de Hit', value: 'Salto Temporal (Tokitobashi)' },
      { label: 'Combinación divina', value: 'Goku combina Super Saiyajin Blue con Kaioken x10' },
      { label: 'Deseo de Beerus', value: 'Restaura en secreto la Tierra extinta del Universo 6' },
    ],
    interChapter: [
      {
        title: 'El creador Zalama',
        when: 'Año 779',
        summary:
          'Zuno revela a Bulma que las Súper Esferas fueron talladas en el Año 41 por el Dios Dragón Zalama con núcleos estelares indestructibles y sin ninguna limitación de deseo.',
        source: 'Dragon Ball Super · Saga del Torneo del Universo 6',
      },
      {
        title: 'La farsa de Monaka',
        when: 'Año 779',
        summary:
          'Beerus contrata a Monaka, un simple repartidor aficionado, como supuesto guerrero invencible únicamente para estimular el espíritu competitivo de Goku y Vegeta.',
        source: 'Dragon Ball Super · Saga del Torneo del Universo 6',
      },
    ],
    behindTheScenes: [
      {
        title: 'El regreso del Kaioken',
        text: 'La combinación del Kaioken con el Super Saiyajin fue una innovación del anime de Toei Animation que fascinó a los fanáticos por rescatar una técnica clásica de la era Z.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'dbs-copy-vegeta': {
    keyFacts: [
      { label: 'Sustancia milagrosa', value: 'Agua Commeson, arma biológica ancestral de Potaufeu' },
      { label: 'Tiempo límite', value: 'Vegeta real desaparece si el clon no muere en minutos' },
      { label: 'Chupete sellador', value: 'Vegeta debe morder el chupete para no disolverse' },
      { label: 'Destrucción del núcleo', value: 'Monaka pisa accidentalmente el cerebro de Commeson' },
    ],
    interChapter: [
      {
        title: 'El secreto de Potaufeu',
        when: 'Año 779',
        summary:
          'El planeta Potaufeu albergó una civilización pacífica que creó el Commeson para defenderse de invasores, pero el agua cobró consciencia y absorbió a sus propios creadores.',
        source: 'Dragon Ball Super · Saga de Potaufeu',
      },
      {
        title: 'El dilema de Vegeta',
        when: 'Año 779',
        summary:
          'Aunque su vida corre peligro mortal, el orgullo de Vegeta lo lleva a animar a su propio clon para que no se deje vencer fácilmente por Goku.',
        source: 'Dragon Ball Super · Saga de Potaufeu',
      },
    ],
    behindTheScenes: [
      {
        title: 'Regreso de la voz original de Vegeta',
        text: 'En la versión japonesa, el actor Ryō Horikawa grabó un duelo interpretativo consigo mismo al dar voz tanto a Vegeta como a su copia líquida en el mismo episodio.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'dbs-black-zamasu-guerra': {
    keyFacts: [
      { label: 'Identidad del villano', value: 'Zamasu del Universo 10 en el cuerpo robado de Goku' },
      { label: 'Poder oscuro', value: 'Super Saiyajin Rosé de Goku Black' },
      { label: 'Fusión final', value: 'Zamasu Fusionado con pendientes Pothala inmortales' },
      { label: 'Borrado absoluto', value: 'Zen-Oh del Futuro elimina toda la línea temporal contaminada' },
    ],
    interChapter: [
      {
        title: 'La paradoja del Anillo del Tiempo',
        when: 'Año 780',
        summary:
          'Zamasu aprovechó que los anillos del tiempo de los Kaioshin permiten viajar a futuros alternativos para asesinar a los Supremos Kaioshin de todos los universos, extinguiendo a la par a sus Dioses de la Destrucción.',
        source: 'Dragon Ball Super · Saga de Goku Black',
      },
      {
        title: 'El límite mortal de los Pothala',
        when: 'Año 780',
        summary:
          'Gowasu explica que la unión de los pendientes Pothala solo es permanente si ambos portadores son deidades Supremos Kaioshin; en mortales como Vegetto, dura estrictamente una hora.',
        source: 'Dragon Ball Super · Saga de Goku Black',
      },
    ],
    behindTheScenes: [
      {
        title: 'El concepto del Goku maligno',
        text: 'Toriyama llevaba años queriendo explorar la idea de un doppelgänger tenebroso de Goku que combinara su fisonomía con la frialdad e hipocresía de una deidad narcisista.',
        source: 'Akira Toriyama · comentarios oficiales',
      },
    ],
  },

  'dbs-exhibicion-zen': {
    keyFacts: [
      { label: 'Anfitrión', value: 'Zen-Oh del Futuro y Gran Zen-Oh' },
      { label: 'Oponentes', value: 'Universo 7 contra el Trío del Peligro (Universo 9)' },
      { label: 'Debut marcial', value: 'Majin Buu derrota a Basil con patadas y risas' },
      { label: 'Veredicto del Daishinkan', value: 'Los universos perdedores serán borrados en el torneo' },
    ],
    interChapter: [
      {
        title: 'El combate a ciegas de Gohan',
        when: 'Año 780',
        summary:
          'Lavenda rocía veneno corrosivo en los ojos de Gohan; el joven saiyajin decide no usar semillas del ermitaño y aprende a luchar guiándose por el eco de sus pasos.',
        source: 'Dragon Ball Super · Torneo de Exhibición Zen',
      },
      {
        title: 'La intriga de los dioses',
        when: 'Año 780',
        summary:
          'Los doce Dioses de la Destrucción juzgan con pavor la irresponsabilidad de Goku al tratar con tanta familiaridad a Zen-Oh, comenzando a tramar alianzas contra el Universo 7.',
        source: 'Dragon Ball Super · Torneo de Exhibición Zen',
      },
    ],
    behindTheScenes: [
      {
        title: 'El diseño del Trío del Peligro',
        text: 'Los tres hermanos lobo (Bergamo, Basil y Lavenda) fueron conceptualizados para contrastar el combate físico directo con venenos, trucos callejeros y absorción de energía.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'dbs-reclutamiento-u7': {
    keyFacts: [
      { label: 'Plazo improrrogable', value: '48 horas terrestres antes de la campana' },
      { label: 'Baja imprevista', value: 'Majin Buu cae en hibernación profunda de dos meses' },
      { label: 'Sustituto desesperado', value: 'Freezer contratado desde el infierno por 24 horas' },
      { label: 'Entrenamiento de Roshi', value: 'Supera sus debilidades en el Templo de Karin' },
    ],
    interChapter: [
      {
        title: 'La isla secreta del Androide 17',
        when: 'Año 780',
        summary:
          '17 trabaja como guardabosques protegiendo minotauros de cazadores furtivos galácticos, habiendo alcanzado un poder equiparable al Super Saiyajin Blue en completo aislamiento.',
        source: 'Dragon Ball Super · Reclutamiento del Universo 7',
      },
      {
        title: 'El pacto del infierno',
        when: 'Año 780',
        summary:
          'Goku visita a Freezer colgado en su capullo en el infierno de las hadas; Freezer acepta luchar solo bajo promesa solemne de ser resucitado con las Esferas del Dragón.',
        source: 'Dragon Ball Super · Reclutamiento del Universo 7',
      },
    ],
    behindTheScenes: [
      {
        title: 'La sorpresa de Freezer en el equipo',
        text: 'La inclusión de Freezer como décimo miembro en lugar de Majin Buu generó un impacto mediático global, redefiniendo la dinámica interna del equipo de héroes.',
        source: 'Akira Toriyama · comentarios oficiales',
      },
    ],
  },

  'dbs-torneo-poder-climax': {
    keyFacts: [
      { label: 'Escenario cósmico', value: 'Mundo de la Nada con 80 guerreros y 8 universos' },
      { label: 'Estado supremo', value: 'Goku alcanza el Ultra Instinto Dominado' },
      { label: 'Alianza final', value: 'Goku y Freezer cooperan para derribar a Jiren' },
      { label: 'Deseo de 17', value: 'Restaura a todos los universos borrados por Zen-Oh' },
    ],
    interChapter: [
      {
        title: 'La prueba oculta de Zen-Oh',
        when: 'Año 780',
        summary:
          'El Gran Sacerdote desvela tras el torneo que Zen-Oh preveía que el guerrero vencedor pediría restaurar a los universos caídos por altruismo; de haber pedido un deseo egoísta, habría borrado toda la existencia.',
        source: 'Dragon Ball Super · Saga del Torneo del Poder',
      },
      {
        title: 'La resurrección de Freezer',
        when: 'Año 780',
        summary:
          'En reconocimiento a su disciplina y sacrificio durante la batalla final contra Jiren, Whis resucita a Freezer en el acto como regalo por orden de Lord Beerus.',
        source: 'Dragon Ball Super · Saga del Torneo del Poder',
      },
    ],
    behindTheScenes: [
      {
        title: 'La coreografía de Goku y Freezer',
        text: 'La secuencia climática donde Goku y Freezer unen sus fuerzas al compás de la música orquestal se convirtió en uno de los momentos cumbres de la historia moderna de la animación japonesa.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  // ── DRAGON BALL GT ───────────────────────────────────────────────────────
  'dbgt-black-star-origen': {
    keyFacts: [
      { label: 'Error de Pilaf', value: 'Desea por accidente que Goku vuelva a ser niño' },
      { label: 'Cuenta atrás cósmica', value: 'La Tierra estallará en un año si no regresan las esferas' },
      { label: 'Tripulación espacial', value: 'Goku niño, Trunks y su nieta Pan' },
      { label: 'Aliado cibernético', value: 'El robot Gill que se traga el radar del dragón' },
    ],
    interChapter: [
      {
        title: 'El origen de las esferas oscuras',
        when: 'Año 789',
        summary:
          'Las Esferas de Estrella Negra fueron creadas por el Namekiano Anónimo antes de dividirse en Kamisama y Piccolo Daimaō, por lo que retienen un poder inestable capaz de sobrecargar la corteza terrestre.',
        source: 'Dragon Ball GT · Saga del Gran Viaje',
      },
      {
        title: 'El sabotaje de Pan',
        when: 'Año 789',
        summary:
          'Goten iba a tripular la nave espacial con Goku y Trunks, pero Pan despega la nave a escondidas dejándolo varado en la plataforma de lanzamiento.',
        source: 'Dragon Ball GT · Saga del Gran Viaje',
      },
    ],
    behindTheScenes: [
      {
        title: 'Diseño de vestuario por Toriyama',
        text: 'Akira Toriyama diseñó la nave espacial de Capsule Corp, el aspecto de Pan aventurera y los trajes de exploradores de Goku y Trunks para el lanzamiento de GT.',
        source: 'Akira Toriyama · Dragon Ball GT Perfect Files',
      },
    ],
  },

  'dbgt-baby-ssj4': {
    keyFacts: [
      { label: 'Venganza ancestral', value: 'Baby busca restaurar la civilización Tsufuru' },
      { label: 'Posesión', value: 'Vegeta Baby domina a toda la población terrestre' },
      { label: 'Transformación salvaje', value: 'Super Saiyajin 4 tras controlar el Ōzaru Dorado' },
      { label: 'Sacrificio heroico', value: 'Piccolo muere con la Tierra para sellar las esferas oscuras' },
    ],
    interChapter: [
      {
        title: 'El origen de los Tsufuru',
        when: 'Año 789',
        summary:
          'Siglos atrás, los saiyajin primitivos desembarcaron en el planeta Plant y exterminaron a la avanzada civilización Tsufuru para renombrar el mundo como Planeta Vegeta. Baby fue creado con el ADN del rey como su última venganza.',
        source: 'Dragon Ball GT · Saga de Baby',
      },
      {
        title: 'El rito de la cola saiyajin',
        when: 'Año 789',
        summary:
          'El Supremo Kaioshin y Kibitoshin utilizan unas pinzas místicas gigantes para extraer nuevamente la cola de Goku de su cóccix y permitirle canalizar el poder primal del mono gigante.',
        source: 'Dragon Ball GT · Saga de Baby',
      },
    ],
    behindTheScenes: [
      {
        title: 'El diseño del Super Saiyajin 4',
        text: 'El legendario animador Katsuyoshi Nakatsuru diseñó el SSJ4 combinando pelaje rojo carmesí y rasgos salvajes para simbolizar el retorno a las raíces simias de la raza saiyajin.',
        source: 'Katsuyoshi Nakatsuru · entrevistas',
      },
    ],
  },

  'dbgt-super-17': {
    keyFacts: [
      { label: 'Científicos aliados', value: 'Dr. Gero y Dr. Myuu conspiran en el infierno' },
      { label: 'Engendro definitivo', value: 'Fusión del 17 terrestre y el 17 del infierno' },
      { label: 'Baja trágica', value: 'Krilin es asesinado al resistirse a la orden mental' },
      { label: 'Punto débil', value: 'Super 17 baja la guardia al absorber energía' },
    ],
    interChapter: [
      {
        title: 'La trampa del infierno',
        when: 'Año 790',
        summary:
          'Gero y Myuu engañan a Goku para que descienda al infierno y cierran el portal; Cell y Freezer intentan retenerlo en el lago helado antes de ser burlados fácilmente.',
        source: 'Dragon Ball GT · Saga de Súper 17',
      },
      {
        title: 'La venganza de Número 18',
        when: 'Año 790',
        summary:
          'Tras la muerte de Krilin, Número 18 dispara ráfagas de ki continuas a Super 17; esto obliga al androide a absorber energía inmóvil, permitiendo a Goku rematarlo con el Puño del Dragón.',
        source: 'Dragon Ball GT · Saga de Súper 17',
      },
    ],
    behindTheScenes: [
      {
        title: 'El homenaje a los villanos clásicos',
        text: 'Los animadores de Toei aprovecharon la apertura de la brecha del infierno para traer de vuelta a villanos entrañables como la Patrulla Roja, Dodoria y Zarbon en una invasión multitudinaria.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },

  'dbgt-dragones-climax': {
    keyFacts: [
      { label: 'Causa del desastre', value: 'Sobrecarga de energía negativa acumulada en las esferas' },
      { label: 'Rival supremo', value: 'Omega Shenron (Yi Xing Long con las 7 esferas)' },
      { label: 'Fusión suprema', value: 'Gogeta Super Saiyajin 4' },
      { label: 'Golpe final', value: 'Genkidama Universal canalizada por todo el cosmos' },
    ],
    interChapter: [
      {
        title: 'La deuda del uso de las esferas',
        when: 'Año 790',
        summary:
          'Las esferas necesitaban un siglo entre deseos para dispersar la energía negativa que absorben con cada milagro; al usarlas constantemente en apenas unas décadas con el radar, el exceso de energía corrompió al dragón.',
        source: 'Dragon Ball GT · Saga de los Dragones Malignos',
      },
      {
        title: 'La partida de Goku',
        when: 'Año 790',
        summary:
          'Tras conceder un último deseo desinteresado para reconstruir la Tierra, el auténtico Shenlong se marcha llevando el cuerpo y el espíritu de Son Goku para purificar las esferas durante un siglo.',
        source: 'Dragon Ball GT · Saga de los Dragones Malignos',
      },
    ],
    behindTheScenes: [
      {
        title: 'El final de una era en televisión',
        text: 'Emitido en 1997, el episodio 64 de Dragon Ball GT concluyó once años ininterrumpidos de emisión televisiva de Dragon Ball en la cadena Fuji TV en Japón.',
        source: 'Toei Animation · notas de producción',
      },
    ],
  },
};
