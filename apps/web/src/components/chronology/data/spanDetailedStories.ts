import type { StoryBattle } from '../types';

/**
 * Historias detalladas curadas por lapso (span id) para los splits que
 * compartían un único relato legacy: Super partido en 8, GT en 4 y Daima en 2.
 * Los hitos de episodios se generan en `spansToVolumes.ts` desde el JSON canónico.
 */
export interface SpanStoryNarrative {
  prologue: string;
  escalation: string;
  turningPoint: string;
  aftermath: string;
  keyBattles: StoryBattle[];
}

export const SPAN_DETAILED_STORIES: Record<string, SpanStoryNarrative> = {
  'dbs-batalla-dioses': {
    prologue:
      'Cuatro años después de la erradicación de Majin Buu, la paz reina en la Tierra y Goku trabaja a regañadientes como agricultor por orden de Milk. En el confín del Universo 7, el Dios de la Destrucción Lord Beerus despierta tras 39 años de letargo, impulsado por la premonición del Pez Oráculo sobre un rival digno: el "Super Saiyajin Dios".',
    escalation:
      'Beerus y su asistente angelical Whis visitan el planeta de Kaio-sama, donde Goku despliega el Super Saiyajin 3 y es noqueado con dos golpes displicentes. El Dios desciende entonces a la fiesta de cumpleaños de Bulma. Vegeta, que conoce su rango por advertencias de su padre, se humilla bailando y cocinando para mantenerlo sereno, hasta que una disputa por el pudín desata la ira del destructor.',
    turningPoint:
      'Cuando Beerus abofetea a Bulma, Vegeta explota en furia y logra conectar golpes que ni Goku SSJ3 consiguió. Goku convoca a Shenlong, quien revela la leyenda: cinco Saiyajin de corazón puro deben verter su luz en un sexto. Con Vegeta, Gohan, Goten, Trunks y Pan aún en el vientre de Videl, Goku renace con aura carmesí como Super Saiyajin God.',
    aftermath:
      'El choque en la estratosfera genera ondas que amenazan la tela del universo. Goku pierde la forma por agotamiento pero su cuerpo retiene la memoria del ki divino. Beerus vence por desgaste, finge dormirse ante la gastronomía terrestre y perdona el planeta. Whis aceptará luego a Goku y Vegeta como discípulos.',
    keyBattles: [
      { fighter1: 'Goku Super Saiyajin 3', fighter2: 'Lord Beerus (planeta Kaio)', outcome: 'Goku noqueado con un golpe en el cuello sin rozar al Dios' },
      { fighter1: 'Vegeta enfurecido', fighter2: 'Lord Beerus (fiesta de Bulma)', outcome: 'Vegeta supera momentáneamente al SSJ3 por amor a Bulma' },
      { fighter1: 'Goku Super Saiyajin God', fighter2: 'Lord Beerus en el espacio', outcome: 'Goku asimila el ki divino; Beerus perdona la Tierra' },
    ],
  },

  'dbs-resurreccion-f': {
    prologue:
      'Mientras Goku y Vegeta entrenan bajo Whis en el planeta de Beerus aprendiendo a sellar su ki por dentro, los restos del ejército de Freezer llegan a la Tierra. Sorbet y Tagoma reúnen las Esferas del Dragón con un radar robado y resucitan a su emperador, aún troceado desde su derrota en Namek.',
    escalation:
      'Freezer es regenerado en una cápsula médica y, por primera vez en su vida, decide entrenar: cuatro meses de tortura autoimpuesta le bastan para alcanzar la forma Golden Freezer. Desembarca con mil soldados. Gohan, Piccolo, Krilin, Tenshinhan y Roshi contienen la invasión mientras Jaco avisa a Bulma, que contacta a Whis justo a tiempo.',
    turningPoint:
      'Goku y Vegeta regresan con el Super Saiyajin Blue (SSGSS), el God contenido en el Super Saiyajin. Goku domina a Golden Freezer hasta que Sorbet lo atraviesa con un rayo por la espalda. Vegeta toma el relevo y pulveriza al tirano, pero Freezer detona la Tierra en represalia y solo el retroceso temporal de tres minutos de Whis permite a Goku rematarlo con un Kamehameha.',
    aftermath:
      'La Tierra se salva por segundos y Freezer regresa al infierno personal de capullos y hadas. El episodio confirma a Whis como maestro de ambos saiyajin y deja instalada la rivalidad Goku-Vegeta por el Blue perfecto, antesala del torneo entre universos que Champa ya está exigiendo.',
    keyBattles: [
      { fighter1: 'Guerreros Z', fighter2: 'Ejército de 1000 soldados de Freezer', outcome: 'Jaco, Krilin y los veteranos resisten hasta la llegada de Goku' },
      { fighter1: 'Goku Super Saiyajin Blue', fighter2: 'Golden Freezer', outcome: 'Goku domina hasta la trampa de Sorbet por la espalda' },
      { fighter1: 'Vegeta Super Saiyajin Blue', fighter2: 'Golden Freezer agotado', outcome: 'Vegeta pulveriza a Freezer; Whis revierte la explosión planetaria' },
    ],
  },

  'dbs-torneo-u6': {
    prologue:
      'Champa, el Dios de la Destrucción del Universo 6 y hermano gemelo obeso de Beerus, reta a un torneo entre universos con las Súper Esferas del Dragón (del tamaño de planetas) como premio. Beerus acepta y Goku debe reunir cinco luchadores: él, Vegeta, Piccolo, Majin Buu y un misterioso monito llamado Monaka, a quien Beerus infla como el más fuerte para motivarlos.',
    escalation:
      'El torneo se celebra en el planeta sin nombre entre universos. Botamo, el guerrero de goma del U6, anula a Goku hasta que este lo arroja fuera con ingenio. Frost, el "emperador justo" gemelo de Freezer, envenena su aguja contra Goku y Piccolo hasta que Jaco revela la trampa y Frost es descalificado. Vegeta barre a Frost, Magetta y Cabba, a quien enseña a transformarse en Super Saiyajin con una provocación brutal sobre su familia.',
    turningPoint:
      'Hit, el sicario legendario del U6 con más de mil años de asesinatos, detiene el tiempo 0,1 segundos con su Salto Temporal y noquea a Vegeta de un solo golpe. Goku combina el Super Saiyajin Blue con el Kaio-ken x10, rompiendo su cuerpo para forzar a Hit a mejorar su salto a 0,5 segundos. Al límite del colapso físico, Goku se rinde para no morir, confiando en Monaka.',
    aftermath:
      'Monaka cae de un golpe, pero Beerus ordena a Goku pelear disfrazado y Hit, que ya había descubierto el teatro, se deja eliminar para saldar su deuda de honor con Goku. El Universo 7 gana y Beerus pide como deseo a las Súper Esferas restaurar la Tierra del Universo 6. Zeno-sama aparece atraído por el torneo y promete un futuro Torneo del Poder entre todos los universos.',
    keyBattles: [
      { fighter1: 'Vegeta', fighter2: 'Frost, Magetta y Cabba', outcome: 'Vegeta barre medio equipo rival y despierta el SSJ de Cabba' },
      { fighter1: 'Goku Blue + Kaio-ken x10', fighter2: 'Hit (Salto Temporal)', outcome: 'Goku fuerza a Hit a evolucionar y se rinde al borde del colapso' },
      { fighter1: 'Monaka (teatro de Beerus)', fighter2: 'Hit', outcome: 'Hit se deja caer para devolver el favor a Goku' },
    ],
  },

  'dbs-copy-vegeta': {
    prologue:
      'Tras la fiesta de victoria del Torneo U6, Goten y Trunks se cuelan en la nave de Monaka y acaban en el Planeta Pot-au-feu, donde una sustancia legendaria duerme sellada: el Agua Sobrenatural Commeson, capaz de copiar el cuerpo y el poder de quien toca.',
    escalation:
      'Unos invasores liberan a Commeson, que absorbe a Vegeta y crea una copia perfecta con su poder, su técnica y su orgullo, mientras el Vegeta original se transparenta y se desvanece. Gotenks intenta frenar al clon y fracasa; Goku acude desde el planeta de Kaio-sama y escala a Super Saiyajin Blue para igualar a su propio rival.',
    turningPoint:
      'El duelo Blue contra Blue se equilibra hasta que Trunks comprende el punto débil: el núcleo viscoso de Commeson. Con Monaka pisoteando accidentalmente el núcleo y Trunks protegiendo el cuerpo desvanecido de su padre, la copia pierde estabilidad y Goku la desintegra con un Kamehameha a plena potencia.',
    aftermath:
      'Vegeta recupera su cuerpo y su orgullo intacto, aunque jamás perdonará que una charca lo haya copiado. Monaka vuelve a casa como héroe accidental y el episodio cierra la etapa ligera antes de la llegada de Trunks del Futuro con la peor noticia posible.',
    keyBattles: [
      { fighter1: 'Gotenks', fighter2: 'Vegeta Copia', outcome: 'La fusión infantil no logra dañar al clon perfecto' },
      { fighter1: 'Goku Super Saiyajin Blue', fighter2: 'Vegeta Copia Blue', outcome: 'Duelo igualado hasta la ruptura del núcleo de Commeson' },
      { fighter1: 'Trunks + Monaka', fighter2: 'Núcleo de Commeson', outcome: 'Pisotón accidental que desestabiliza al monstruo' },
    ],
  },

  'dbs-exhibicion-zen': {
    prologue:
      'Goku visita a Zeno-sama para recordarle el torneo multiversal prometido. Los dos Reyes de Todo aceptan encantados, pero el Gran Sacerdote añade la condición helada: los universos perdedores serán borrados de la existencia. Para calibrar el espectáculo se organiza un Torneo de Exhibición: el Universo 7 contra el Trío del Peligro del Universo 9.',
    escalation:
      'Majin Buu derrota a Basil con astucia elástica; Gohan, ciego por el veneno de Lavenda, redescubre su instinto y vence por nocaut técnico; Goku supera a Bergamo absorbiendo el poder de sus propios ataques. Toppo del Universo 11 interrumpe y humilla a Bergamo de un golpe, presentándose como candidato a Dios de la Destrucción y advirtiendo sobre Jiren el Gris.',
    turningPoint:
      'El Gran Sacerdote confirma ante los dioses consternados que el borrado es literal: el Torneo del Poder será un Battle Royale de 80 luchadores de 8 universos en el Reino de la Nada. Goku pasa de héroe a villano cósmico ante los demás universos por haber provocado la matanza.',
    aftermath:
      'Beerus ordena reclutar diez guerreros en horas. Gohan recupera su gi de combate y su rol de capitán, y la cuenta regresiva al torneo deja a la Tierra como sede del equipo más improvisado del multiverso.',
    keyBattles: [
      { fighter1: 'Majin Buu', fighter2: 'Basil (Trío del Peligro)', outcome: 'Buu gana jugando con su rival de goma' },
      { fighter1: 'Gohan envenenado', fighter2: 'Lavenda', outcome: 'Gohan vence ciego recuperando su instinto marcial' },
      { fighter1: 'Goku', fighter2: 'Bergamo + aparición de Toppo', outcome: 'Goku vence; Toppo advierte sobre Jiren' },
    ],
  },

  'dbs-reclutamiento-u7': {
    prologue:
      'Con el borrado universal como sentencia, Goku y Gohan recorren la Tierra para reunir diez guerreros en menos de un día. La lista base es clara: Vegeta, Piccolo, Krilin, Tenshinhan, Roshi y los Androides 18 y 17, ahora guardabosques con un poder descomunal jamás medido.',
    escalation:
      'Krilin supera su trauma contra el ki de Goku y vuelve al equipo; el Maestro Roshi demuestra que su experiencia vale más que el poder bruto; el Androide 17 solo acepta tras proteger su isla de cazadores espaciales junto a Goku. La crisis estalla cuando Majin Buu cae en su hibernación de dos meses y deja un hueco imposible de llenar.',
    turningPoint:
      'Goku toma la decisión extrema: reclutar a Freezer desde el infierno por 24 horas mediante Uranai Baba, a cambio de prometerle la resurrección con las Esferas. El tirano acepta con una sonrisa, asesina a los sicarios del Universo 9 que lo prueban y se presenta en la arena con su halo dorado intacto.',
    aftermath:
      'El equipo de diez queda cerrado con el villano más odiado como comodín. Beerus monta en cólera, Whis sonríe y el Universo 7 parte al Reino de la Nada con un plan simple: sobrevivir 100 taks (48 minutos) contra 70 enemigos que los consideran responsables del torneo.',
    keyBattles: [
      { fighter1: 'Goku', fighter2: 'Krilin (prueba de valor)', outcome: 'Krilin supera su miedo y regresa al equipo' },
      { fighter1: 'Goku + 17', fighter2: 'Cazadores espaciales', outcome: 'Alianza que convence al androide guardabosques' },
      { fighter1: 'Freezer', fighter2: 'Sicarios del Universo 9', outcome: 'Freezer demuestra su Golden intacto desde el infierno' },
    ],
  },

  'dbs-torneo-del-poder': {
    prologue:
      'Ochenta guerreros de ocho universos caen en la arena de kachi katchin del Reino de la Nada. La regla es simple y terminal: caer fuera de la plataforma es eliminación, y el último universo en pie sobrevive mientras Zeno-sama borra al resto sin pestañear.',
    escalation:
      'El Universo 7 sobrevive al caos inicial con táctica de equipo: 17 y 18 barren gradas, Roshi se sacrifica sellando con el Mafuba, Krilin y Tenshinhan caen con honor, y Vegeta despierta el Blue Evolution contra Toppo, ya convertido en Dios de la Destrucción. Jiren el Gris, del Universo 11, elimina a placer sin despeinarse y hunde a Goku en la Genkidama que este le lanza.',
    turningPoint:
      'Del corazón de su propia Genkidama, Goku emerge con el Ultra Instinto Señal: su cuerpo esquiva sin pensar. Tras dos despertares parciales, alcanza el Ultra Instinto Dominado de cabello plateado y somete a Jiren hasta que su cuerpo mortal colapsa por el desgaste. En los segundos finales, Goku y Freezer, enemigos eternos, cargan hombro a hombro para arrojar a Jiren fuera de la arena.',
    aftermath:
      'El Androide 17, vencedor oculto tras sacrificarse contra Jiren, pide a las Súper Esferas restaurar los universos borrados en vez de su crucero soñado. El Gran Sacerdote revela que era la prueba moral de Zeno-sama: un deseo egoísta habría borrado todo. Freezer resucita, cumple su pacto a medias y parte libre; Goku promete a Jiren una revancha.',
    keyBattles: [
      { fighter1: 'Vegeta Blue Evolution', fighter2: 'Toppo Dios de la Destrucción', outcome: 'Vegeta detona su orgullo y elimina al candidato divino' },
      { fighter1: 'Goku Ultra Instinto Dominado', fighter2: 'Jiren el Gris', outcome: 'Goku somete a Jiren hasta el colapso de su cuerpo mortal' },
      { fighter1: 'Goku + Freezer', fighter2: 'Jiren', outcome: 'Carga suicida conjunta que arroja a Jiren fuera de la arena' },
    ],
  },

  'dbgt-black-star': {
    prologue:
      'Diez años después de partir con Oob, Goku entrena en paz hasta que el anciano Pilaf se infiltra en el Palacio Celestial y encuentra las Esferas de Estrella Negra, creadas por el Namekiano sin nombre antes de dividirse. Su deseo chapucero convierte a Goku en niño y dispersa las esferas por el universo.',
    escalation:
      'Kaio-shin advierte la sentencia: si las siete esferas no regresan a la Tierra en un año, el planeta colapsará. Goku, Trunks y Pan parten en la nave Tako con el radar y el robot Gill. Planeta tras planeta (Imegga, Kelbo, Luud), el trío choca con el Dr. Myu y sus mutantes mientras Pan madura de polizón caprichosa a guerrera.',
    turningPoint:
      'La esfera de cuatro estrellas del abuelo Gohan reaparece una y otra vez como talismán del viaje. Al reunir seis esferas, el grupo descubre que la última está en manos del propio Dr. Myu y su dios máquina Luud, que exige sacrificios de muñecas vivientes.',
    aftermath:
      'Con las esferas casi completas, la nave pone rumbo a la Tierra para cerrar el año límite. Pero Myu ya envió su verdadera creación entre las sombras: el parásito Baby, último superviviente tsufur, viaja oculto hacia el planeta azul con un plan de venganza milenaria.',
    keyBattles: [
      { fighter1: 'Goku niño + Trunks + Pan', fighter2: 'Secuaces de Don Kee (Imegga)', outcome: 'Liberación del planeta sometido y primera esfera recuperada' },
      { fighter1: 'Goku niño', fighter2: 'General Rilldo (M2)', outcome: 'Goku supera al general mutante de Myu' },
      { fighter1: 'Trío Tako', fighter2: 'Dios Luud', outcome: 'Pan destruye el núcleo del dios máquina desde dentro' },
    ],
  },

  'dbgt-baby-ssj4': {
    prologue:
      'Baby, el parásito creado por el Dr. Myu con el odio de la raza tsufur exterminada por los Saiyajin, llega a la Tierra y posee cuerpos en cadena: primero Trunks, luego Goten y Gohan, hasta alcanzar su objetivo perfecto, el príncipe Vegeta, cuyo orgullo herido lo hace vulnerable.',
    escalation:
      'Baby-Vegeta infecta a toda la humanidad con su semilla y convierte el planeta en el nuevo Planeta Tsufur. Goku, atrapado fuera de la Tierra, recupera su cola gracias a Kaio-shin y, bajo la luz de la Tierra vista desde el espacio, se transforma en Oozaru Dorado fuera de control hasta que Pan le devuelve la memoria con llanto: nace el Super Saiyajin 4 de pelaje carmesí.',
    turningPoint:
      'El SSJ4 iguala a Baby-Vegeta Oozaru Dorado y lo supera con el 10x Kamehameha. Baby huye en nave, Goku lo persigue y lo estrella contra el sol con otro Kamehameha. La humanidad despierta del control, pero las Esferas de Estrella Negra, cumplida su función, se apagan.',
    aftermath:
      'Vegeta conserva el recuerdo del SSJ4 gracias a la onda Bruits artificial de Bulma. La Tierra celebra sin saber que el uso constante de las esferas durante décadas ya cargó su núcleo de energía negativa, la factura que pronto nacerá como dragones.',
    keyBattles: [
      { fighter1: 'Baby-Vegeta', fighter2: 'Gohan y Goten poseídos vs. Goku', outcome: 'Baby controla a la familia y derrota al Goku niño' },
      { fighter1: 'Goku Super Saiyajin 4', fighter2: 'Baby-Vegeta Oozaru Dorado', outcome: 'El 10x Kamehameha quiebra al parásito dorado' },
      { fighter1: 'Goku SSJ4', fighter2: 'Baby (huida espacial)', outcome: 'Baby estrellado contra el sol; la Tierra despierta' },
    ],
  },

  'dbgt-super-17': {
    prologue:
      'En el infierno, el Dr. Gero y el Dr. Myu fusionan sus odios y construyen un nuevo Androide 17 infernal, gemelo cuántico del 17 terrestre. Al sincronizarse ambos 17, se abre un portal entre el infierno y la Tierra por donde escapan todos los villanos muertos.',
    escalation:
      'Cell y Freezer tienden su emboscada a Goku en el infierno y lo encierran con hielo especial, pero Goku los derrota a ambos de un golpe por bando y escapa con Piccolo, que se queda atrás para cerrar el portal desde dentro. En la Tierra, el Super Androide 17 absorbe todo ataque de ki y asesina a Krilin ante Marron.',
    turningPoint:
      'Goku descubre que el Super 17 solo es vulnerable durante la absorción. Con el 18 terrestre recordando a su hermano y el Dr. Gero traicionado por su propia creación, el 17 original sabotea desde dentro el control de Myu y abre la guardia fatal.',
    aftermath:
      'Goku atraviesa al Super 17 con el Puño del Dragón y el Kamehameha simultáneo. El 17 original muere pidiendo perdón a su hermana. Krilin será revivido después, pero la muerte del androide deja claro que la tecnología del odio ya superó a sus creadores.',
    keyBattles: [
      { fighter1: 'Goku', fighter2: 'Cell + Freezer (infierno)', outcome: 'Goku los derrota de un golpe y escapa del portal' },
      { fighter1: 'Super Androide 17', fighter2: 'Vegeta, Gohan, Goten, Trunks y Oob', outcome: 'El Super 17 absorbe todo y masacra a los defensores' },
      { fighter1: 'Goku (Puño del Dragón)', fighter2: 'Super Androide 17', outcome: 'Kamehameha interno que desintegra al androide definitivo' },
    ],
  },

  'dbgt-dragones-malignos': {
    prologue:
      'Kaio-shin Anciano revela la factura final: cada deseo egoísta con las Esferas cargó su cristal de energía negativa durante medio siglo. Las esferas se quiebran y nacen los siete Dragones Malignos, cada uno con una esfera agrietada en el cuerpo, dispuestos a pudrir la Tierra.',
    escalation:
      'Goku y Pan cazan dragones uno por uno: Haze, Rage, Otcéano y Naturon caen ante el SSJ4, pero Eis y Nuova revelan honor guerrero (Nuova muere ayudando a Goku) y Syn Shenron absorbe las siete esferas para mutar en Omega Shenron, cuyo campo de energía negativa corrompe el planeta entero.',
    turningPoint:
      'Ni el SSJ4 de Goku ni el recién despertado SSJ4 de Vegeta bastan contra Omega. La única salida es la fusión: Gogeta Super Saiyajin 4 nace y humilla a Omega con el Big Bang Kamehameha, pero se desfusiona por jugar con su presa. Omega contraataca al límite y Goku, ciego por su propio ataque, reúne la Genkidama Universal con la energía de todo el cosmos.',
    aftermath:
      'Omega se desintegra y las esferas purificadas ascienden al cielo. Shenlong aparece sin invocación, concede el último deseo en silencio y parte llevándose a Goku sobre su lomo ante la mirada de sus amigos. Un siglo después, su descendiente Goku Jr. aún custodia la esfera de cuatro estrellas.',
    keyBattles: [
      { fighter1: 'Goku SSJ4 + Pan', fighter2: 'Eis y Nuova Shenron', outcome: 'Nuova traiciona a su hermano y muere como guerrero honorable' },
      { fighter1: 'Gogeta Super Saiyajin 4', fighter2: 'Omega Shenron', outcome: 'Humillación total desperdiciada por exceso de juego' },
      { fighter1: 'Goku (Genkidama Universal)', fighter2: 'Omega Shenron', outcome: 'Purificación del karma negativo y despedida con Shenlong' },
    ],
  },

  'db-daima-conspiracion': {
    prologue:
      'Tras la muerte de Dabura a manos de Majin Buu, el Reino Demonio queda acéfalo y el Rey Gomah asciende al trono con su consejero Degesu y la hechicera Arinsu. Al observar con un monitor ancestral la derrota de Buu, Gomah concluye que los Guerreros Z son la amenaza a neutralizar y viaja a la Tierra por las Esferas del Dragón demoníacas.',
    escalation:
      'Gomah desea que Goku y sus compañeros regresen a la infancia para debilitarlos. Goku, Vegeta, Piccolo, Bulma y los demás despiertan como niños, con el ki intacto pero cuerpos torpes y alcance reducido. El misterioso majin Glorio aparece ofreciendo una nave hacia el Reino Demonio a cambio de ayuda contra Gomah, y Shin se une como guía de su propio pueblo originario.',
    turningPoint:
      'El grupo cruza la grieta dimensional al Tercer Mundo Demoníaco, donde Tamagamis colosales custodian las Esferas del Reino. Goku redescubre el Báculo Sagrado (Nyoibo) para compensar su tamaño y derrota al primer Tamagami, ganando la primera esfera demoníaca y la atención de Arinsu, que crea a Majin Kuu como rival.',
    aftermath:
      'Con una esfera en mano y Panzy, la joven demonio rebelde, unida al grupo, el equipo avanza al Segundo Mundo mientras Gomah activa el Ojo Maligno Terciario. La conspiración deja de ser un golpe preventivo y se revela como una guerra de sucesión por el trono demoníaco.',
    keyBattles: [
      { fighter1: 'Gomah + Degesu', fighter2: 'Shenlong demoníaco', outcome: 'Deseo que infantiliza a todos los Guerreros Z' },
      { fighter1: 'Goku Mini (Nyoibo)', fighter2: 'Tamagami del Tercer Mundo', outcome: 'Primera Esfera del Reino Demonio conquistada' },
      { fighter1: 'Glorio + Shin', fighter2: 'Fuerzas del Rey Gomah', outcome: 'Huida hacia el Segundo Mundo con Panzy' },
    ],
  },

  'db-daima-climax': {
    prologue:
      'En el Segundo Mundo, el equipo se topa con el Tamagami intermedio y con Majin Kuu, la criatura fallida de Arinsu que evoluciona con cada derrota. Vegeta Mini reclama su turno y demuestra que el orgullo saiyajin no entiende de estaturas.',
    escalation:
      'Gomah absorbe el Ojo Maligno y muta en un gigante de poder abrumador; Degesu traiciona a su propio hermano Shin por el trono. Arinsu completa a Majin Duu, rival digno de Tamagamis, mientras Goku cae ante Gomah y Vegeta sostiene la línea con el Super Saiyajin 3 infantil, una forma que su cuerpo mini apenas soporta.',
    turningPoint:
      'Neva, el namekiano legendario creador de los Tamagamis, despierta el poder latente de Goku: el Super Saiyajin 4 renace en la continuidad, con pelaje carmesí sobre cuerpo infantil. Goku SSJ4 quiebra al Rey Gomah Ojo Maligno con el 10x Kamehameha mientras Glorio destruye el núcleo del castillo.',
    aftermath:
      'El Reino Demonio elige su nuevo orden, los Glind recuperan su historia y los Guerreros Z regresan a la adultez con las Esferas Demoníacas. Shin comprende por fin el origen de su pueblo y Goku, de vuelta a su tamaño, guarda el Nyoibo: la última obra concebida por Toriyama cierra el círculo volviendo al báculo del primer capítulo.',
    keyBattles: [
      { fighter1: 'Vegeta Mini SSJ3', fighter2: 'Tamagami del Segundo Mundo', outcome: 'Vegeta conquista la segunda esfera al límite de su cuerpo' },
      { fighter1: 'Majin Duu', fighter2: 'Tamagami del Primer Mundo', outcome: 'Duu evoluciona y arrebata la tercera esfera' },
      { fighter1: 'Goku Mini Super Saiyajin 4', fighter2: 'Rey Gomah Ojo Maligno', outcome: '10x Kamehameha que clausura la conspiración demoníaca' },
    ],
  },
};
