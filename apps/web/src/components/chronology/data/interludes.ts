type InterludeGapScale = 'continuo' | 'dias' | 'meses' | 'anios';

type InterludeKind =
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
 * 69 interludios por cada par consecutivo en orden in-universe más un
 * epílogo final. El orden in-universe lo define `compareInUniverse`:
 * Clásico (16) → Z (28) → Daima (4) → Super (15) → GT (7).
 *
 * Datos curados y enriquecidos contra la cronología oficial (Daizenshuu 7 / Chōzenshū 4).
 */
export const CHRONOLOGY_INTERLUDES: ChronologyInterlude[] = [
  {
    "id": "il-db-pilaf-busqueda-db-pilaf-castillo",
    "fromVolumeId": "db-pilaf-busqueda",
    "toVolumeId": "db-pilaf-castillo",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Rumbo a la Fortaleza de Pilaf",
    "summary": "Con seis esferas reunidas tras cruzar el Desierto del Diablo y convencer a Yamcha de una tregua, los secuaces de Pilaf roban las esferas forzando al grupo a perseguirlos a su castillo blindado.",
    "offscreen": [
      "Pilaf, Shu y Mai monitorean el avance del grupo desde su sala de control subterránea.",
      "Yamcha y Puar siguen en secreto el vehículo averiado de Bulma para conseguir las esferas."
    ]
  },
  {
    "id": "il-pilaf-torneo-21",
    "fromVolumeId": "db-pilaf-castillo",
    "toVolumeId": "db-torneo-21-entrenamiento",
    "gap": {
      "label": "+8 meses",
      "scale": "meses"
    },
    "kind": "training",
    "title": "Leche, caparazón y Kame House",
    "summary": "Tras el primer deseo a Shenlong, las esferas se dispersan convertidas en piedra durante un año. Goku y Krilin se someten a ocho meses de riguroso entrenamiento bajo el Maestro Roshi para participar en el 21° Torneo de las Artes Marciales.",
    "offscreen": [
      "Bulma regresa a la Capital del Oeste con Yamcha, Oolong y Puar, asistiendo a la preparatoria mientras el radar queda inactivo.",
      "El método Roshi: levantarse a las 4:30 AM para repartir leche saltando precipicios, arar campos con las manos y nadar huyendo de tiburones con caparazones de 20 kg (luego 40 kg).",
      "Krilin y Goku aprenden lectura, matemáticas y cultura general con Roshi, fundamentando la filosofía del Estilo Tortuga.",
      "Launch se instala como ama de llaves en Kame House, alternando su personalidad dulce y su versión armada tras cada estornudo."
    ],
    "movieIds": [
      "m1",
      "m2"
    ]
  },
  {
    "id": "il-db-torneo-21-entrenamiento-db-torneo-21-combates",
    "fromVolumeId": "db-torneo-21-entrenamiento",
    "toVolumeId": "db-torneo-21-combates",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "De los Caparazones a la Arena",
    "summary": "Tras despojarse de los pesados caparazones y comprobar que su velocidad desafía la gravedad terrenal, Goku y Krilin arrasan en las eliminatorias preliminares y acceden al cuadro de honor de los ocho finalistas.",
    "offscreen": [
      "El Maestro Roshi se disfraza en secreto con peluca blanca y túnica china para inscribirse bajo el seudónimo de Jackie Chun.",
      "Yamcha supera con éxito las preliminares demostrando su técnica del Puño del Lobo."
    ]
  },
  {
    "id": "il-torneo-21-red-ribbon",
    "fromVolumeId": "db-torneo-21-combates",
    "toVolumeId": "db-rr-coronel-silver",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La búsqueda de la esfera de cuatro estrellas",
    "summary": "Tras caer por milímetros ante Jackie Chun en la final del torneo, Goku rechaza la comodidad y parte solo en la Nube Voladora para recuperar la esfera de cuatro estrellas, la única reliquia de su abuelo Son Gohan.",
    "offscreen": [
      "Jackie Chun celebra en secreto haber evitado que sus alumnos caigan en la soberbia prematura.",
      "Nam utiliza el dinero del premio del torneo para comprar agua y provisiones para su aldea en sequía gracias a las cápsulas Hoi-Poi de Roshi.",
      "En las sombras, el ejército del Comandante Red moviliza regimientos en todo el globo para capturar las esferas."
    ]
  },
  {
    "id": "il-db-rr-coronel-silver-db-rr-torre-musculo",
    "fromVolumeId": "db-rr-coronel-silver",
    "toVolumeId": "db-rr-torre-musculo",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "Rumbo a las Tierras Glaciares del Norte",
    "summary": "Tras vencer al escuadrón del Coronel Silver y conseguir su radar modificado, Goku vuela en la Nube Voladora hacia la gélida Aldea Jingle, donde la Patrulla Roja mantiene secuestrado al alcalde.",
    "offscreen": [
      "Suno rescata a Goku del congelamiento en la nieve tras estrellarse su nave en las montañas heladas.",
      "El General White ordena a sus tropas blindar cada planta de la Torre Músculo ante la inminente llegada del intruso."
    ]
  },
  {
    "id": "il-db-rr-torre-musculo-db-rr-general-blue",
    "fromVolumeId": "db-rr-torre-musculo",
    "toVolumeId": "db-rr-general-blue",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "La Alianza con Bulma y el Abismo Submarino",
    "summary": "Liberada la Aldea Jingle gracias a la ayuda del Androide 8 (Octavio), Goku viaja a la Capital del Oeste para que Bulma repare su radar averiado antes de descender al fondo del mar.",
    "offscreen": [
      "Bulma decide unirse de nuevo a Goku inventando un microscópico aparato de reducción para viajar en su bolsillo.",
      "El General Blue, el oficial más disciplinado y despiadado de la Patrulla Roja, lidera la flota de batiscafos hacia la fosa oceánica."
    ]
  },
  {
    "id": "il-db-rr-general-blue-db-rr-tao-pai-pai",
    "fromVolumeId": "db-rr-general-blue",
    "toVolumeId": "db-rr-tao-pai-pai",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Tierra Sagrada y la Contratación del Sicario",
    "summary": "Tras escapar de las trampas de la caverna pirata y Villa Pingüino, Goku vuela hacia la Tierra Sagrada de Karin, mientras el humillado Comandante Red contrata a Tao Pai Pai para eliminarlo.",
    "offscreen": [
      "Tao Pai Pai demuestra su frialdad asesinando al General Blue solo con la lengua.",
      "Bora y Upa reciben a Goku en la base de la gigantesca torre milenaria que se pierde en las nubes."
    ]
  },
  {
    "id": "il-red-ribbon-uranai-baba",
    "fromVolumeId": "db-rr-tao-pai-pai",
    "toVolumeId": "db-uranai-baba-guerreros",
    "gap": {
      "label": "Unos días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "La esfera oculta y el palacio de Baba",
    "summary": "Goku desmantela por completo el Cuartel General de la Patrulla Roja y reúne seis esferas, pero la séptima no emite señal en el radar porque Pilaf la ha blindado en un estuche aislante. El grupo debe recurrir a la adivina Uranai Baba.",
    "offscreen": [
      "Upa aguarda con devoción junto a la tumba de su padre Bora al pie de la Torre Karin, esperando el milagro de Shenlong.",
      "Pilaf, Shu y Mai vigilan desde su fortaleza voladora, convencidos de que su estuche anti-ondas los mantendrá a salvo.",
      "Krilin, Yamcha y Puar se reúnen con Goku en Kame House y deciden acompañarlo al palacio de Uranai Baba."
    ],
    "movieIds": [
      "m3",
      "m4"
    ]
  },
  {
    "id": "il-db-uranai-baba-guerreros-db-uranai-baba-reencuentro",
    "fromVolumeId": "db-uranai-baba-guerreros",
    "toVolumeId": "db-uranai-baba-reencuentro",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Quinto Combatiente del Más Allá",
    "summary": "Tras vencer a la Momia y a Akuman, Uranai Baba presenta a su quinto y último luchador: un anciano con aureola y máscara de zorro que conoce a la perfección cada movimiento de Goku.",
    "offscreen": [
      "El Maestro Roshi intuye de inmediato la verdadera identidad del peleador por su singular postura de combate.",
      "Goku percibe un aroma familiar y una calidez entrañable en su rival enmascarado."
    ]
  },
  {
    "id": "il-uranai-baba-torneo-22",
    "fromVolumeId": "db-uranai-baba-reencuentro",
    "toVolumeId": "db-torneo-22-entrenamiento",
    "gap": {
      "label": "+3 años",
      "scale": "anios"
    },
    "kind": "training",
    "title": "Tres años a pie por el mundo",
    "summary": "Tras revivir a Bora, Roshi prohíbe a Goku usar la Nube Voladora y le ordena recorrer el planeta a pie durante tres años. Mientras tanto, la Escuela Grulla del maestro Tsuru adoctrina a Tenshinhan y Chaoz para la victoria letal.",
    "offscreen": [
      "Goku nada a través de océanos, escala cordilleras nevadas y perfecciona su resistencia muscular y velocidad sin depender de artefactos mágicos.",
      "Krilin y Yamcha entrenan sin descanso en Kame House bajo la tutela directa de Roshi, aprendiendo a proyectar el Kamehameha.",
      "Tenshinhan y Chaoz perfeccionan técnicas mortíferas como el Dodonpa y el Kikōhō en el dojo de la Grulla.",
      "Tao Pai Pai es reconstruido como ciborg clandestinamente tras la explosión de la granada."
    ]
  },
  {
    "id": "il-db-torneo-22-entrenamiento-db-torneo-22-combates",
    "fromVolumeId": "db-torneo-22-entrenamiento",
    "toVolumeId": "db-torneo-22-combates",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Reencuentro en la Isla Papaya",
    "summary": "Cumplidos los tres años de peregrinaje, los discípulos de Roshi se reúnen en la Isla Papaya para el 22° Torneo de Artes Marciales, cruzándose de inmediato con la soberbia de la Escuela Grulla.",
    "offscreen": [
      "Goku sorprende a sus amigos al llegar con su cola intacta y una velocidad que ni los ojos de Roshi pueden seguir.",
      "Chaoz utiliza su telequinesis durante el sorteo para manipular los emparejamientos preliminares."
    ]
  },
  {
    "id": "il-torneo-22-piccolo-daimaku",
    "fromVolumeId": "db-torneo-22-combates",
    "toVolumeId": "db-piccolo-daimaku-terror",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La sombra del Rey Demonio",
    "summary": "Instantes después de la victoria por desempate de Tenshinhan, Krilin es asesinado en los vestuarios por el engendro Tambourine. El papel con el kanji «Demonio» anuncia el regreso del terror milenario: Piccolo Daimaoh.",
    "offscreen": [
      "Goku pierde el control por la furia y persigue a Tambourine con el estómago vacío, lo que casi le cuesta la vida.",
      "El Maestro Roshi relata con horror el pasado: cómo su maestro Mutaito sacrificó su vida utilizando el Mafūba.",
      "Emperor Pilaf pilota la nave donde Piccolo Daimaoh decreta la aniquilación de todos los artistas marciales."
    ]
  },
  {
    "id": "il-db-piccolo-daimaku-terror-db-piccolo-daimaku-climax",
    "fromVolumeId": "db-piccolo-daimaku-terror",
    "toVolumeId": "db-piccolo-daimaku-climax",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Agua Ultra Sagrada y el Juramento de Venganza",
    "summary": "Con Roshi y Chaoz muertos, Piccolo rejuvenecido y Shenlong destruido tras conceder el deseo, Yajirobe traslada a Goku herido a la Torre Karin en busca de la mítica Agua de los Dioses.",
    "offscreen": [
      "Piccolo Daimaoh toma el palacio real de King Castle y decreta la abolición de las leyes en todo el planeta.",
      "Tenshinhan practica frenéticamente el Mafūba jurando sellar al monstruo cueste lo que cueste."
    ]
  },
  {
    "id": "il-piccolo-daimaku-piccolo-jr",
    "fromVolumeId": "db-piccolo-daimaku-climax",
    "toVolumeId": "db-piccolo-jr-templo",
    "gap": {
      "label": "Unos días",
      "scale": "dias"
    },
    "kind": "training",
    "title": "El heredero del mal y el Templo de Kamisama",
    "summary": "Antes de morir perforado por Goku, Piccolo Daimaoh regurgita un huevo con su reencarnación y heredero, Piccolo Jr. Karin envía a Goku al Templo Sagrado para revivir a Shenlong y entrenar con el Dios de la Tierra.",
    "offscreen": [
      "Goku sube con el Báculo Mágico hasta el Templo Sagrado y queda estupefacto al descubrir que Kamisama tiene el mismo rostro que Piccolo Daimaoh.",
      "Mr. Popo enseña a Goku a vaciar su mente («moverse tan silencioso como el cielo y rápido como el rayo»).",
      "Kamisama reconstruye la estatuilla de Shenlong y el dragón resucita a Roshi, Krilin y Chaoz.",
      "El huevo de Piccolo eclosiona en el desierto y el joven demonio entrena jurando vengar a su padre en el 23° Torneo."
    ]
  },
  {
    "id": "il-db-piccolo-jr-templo-db-piccolo-jr-torneo-final",
    "fromVolumeId": "db-piccolo-jr-templo",
    "toVolumeId": "db-piccolo-jr-torneo-final",
    "gap": {
      "label": "+3 años",
      "scale": "anios"
    },
    "kind": "transition",
    "title": "El Desembarco de los Guerreros Maduros",
    "summary": "Tres años de meditación bajo el cielo sagrado transforman a Goku en un joven adulto imponente que desciende a la arena del 23° Torneo, donde Piccolo Jr. aguarda bajo el seudónimo de Ma Junior.",
    "offscreen": [
      "Bulma, Roshi y Krilin casi no reconocen a Goku por su estatura y madurez física.",
      "Chi-Chi se presenta al torneo vestida de artista marcial jurando hacer cumplir la promesa de matrimonio de la infancia."
    ]
  },
  {
    "id": "il-piccolo-jr-saiyajin-raditz",
    "fromVolumeId": "db-piccolo-jr-torneo-final",
    "toVolumeId": "dbz-saiyajin-raditz",
    "gap": {
      "label": "+5 años",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "Cinco años de paz en el Monte Paoz",
    "summary": "Tras casarse con Chi-Chi y perdonar la vida a Piccolo Jr., Goku se retira a la vida silvestre. En el Año 761 nace Son Gohan, mientras una cápsula saiyajin surca el espacio rumbo a la Tierra.",
    "offscreen": [
      "Goku aprende las rutinas de la vida familiar cortando leña y pescando en el Monte Paoz, nombrando a su hijo en honor a su abuelo.",
      "Piccolo Jr. entrena en soledad en los páramos desérticos, perfeccionando su técnica destructiva Makankōsappō.",
      "Raditz viaja en hibernación a través de la galaxia para reclutar a su hermano menor tras la orden de Vegeta y Nappa."
    ],
    "movieIds": [
      "sp1",
      "m5"
    ]
  },
  {
    "id": "il-raditz-vegeta",
    "fromVolumeId": "dbz-saiyajin-raditz",
    "toVolumeId": "dbz-saiyajin-entrenamiento",
    "gap": {
      "label": "+1 año",
      "scale": "anios"
    },
    "kind": "training",
    "title": "El Camino de la Serpiente y el desierto",
    "summary": "Goku se sacrifica sujetando a Raditz para el Makankōsappō de Piccolo. Mientras Goku recorre el millón de kilómetros del Camino de la Serpiente hacia Kaio-sama, Piccolo entrena brutalmente a Gohan en el desierto.",
    "offscreen": [
      "Gohan sobrevive seis meses solo en la naturaleza, aprendiendo a controlar su miedo ante dinosaurios y descubriendo su transformación Oozaru cortada por Piccolo.",
      "Krilin, Yamcha, Tenshinhan, Chaoz y Yajirobe escalan la Torre Karin para entrenar en el Templo de Kamisama.",
      "Goku cruza el Camino de la Serpiente, supera la gravedad 10x del planeta de Kaio-sama y aprende el Kaio-ken y la Genkidama."
    ],
    "movieIds": [
      "m6"
    ]
  },
  {
    "id": "il-dbz-saiyajin-entrenamiento-dbz-saiyajin-nappa-vegeta",
    "fromVolumeId": "dbz-saiyajin-entrenamiento",
    "toVolumeId": "dbz-saiyajin-nappa-vegeta",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Aterrizaje Saiyajin y la Carrera contra el Tiempo",
    "summary": "Las cápsulas de Vegeta y Nappa impactan en la Tierra un día antes de lo previsto. Goku resucita con las esferas pero debe recorrer de vuelta el Camino de la Serpiente a toda velocidad para salvar a sus amigos.",
    "offscreen": [
      "Nappa siembra los Saibaimen para poner a prueba el valor de los Guerreros Z en las llanuras.",
      "Kaio-sama advierte con desesperación a Goku que olvidó calcular el tiempo de regreso por el camino de la serpiente."
    ]
  },
  {
    "id": "il-vegeta-namek-viaje",
    "fromVolumeId": "dbz-saiyajin-nappa-vegeta",
    "toVolumeId": "dbz-namek-viaje-llegada",
    "gap": {
      "label": "+1 mes",
      "scale": "meses"
    },
    "kind": "time-jump",
    "title": "La nave namekiana y el despegue hacia las estrellas",
    "summary": "Con Yamcha, Tenshinhan, Chaoz y Piccolo muertos y las esferas de la Tierra extintas, Krilin recuerda las palabras de los saiyajin sobre el planeta natal de Piccolo. Bulma repara la nave de Kamisama en Yunzabit.",
    "offscreen": [
      "Goku convalece en el hospital de la Capital del Oeste con todos los huesos rotos, bajo el cuidado de Chi-Chi.",
      "Mr. Popo enseña a Bulma los comandos vocales en idioma namekiano para activar la nave estelar ancestral.",
      "Freezer y sus lugartenientes Zarbon y Dodoria detectan las transmisiones de los rastreadores y parten hacia Namekusei para obtener la vida eterna."
    ],
    "movieIds": [
      "m7",
      "m8"
    ]
  },
  {
    "id": "il-dbz-namek-viaje-llegada-dbz-namek-caceria-esferas",
    "fromVolumeId": "dbz-namek-viaje-llegada",
    "toVolumeId": "dbz-namek-caceria-esferas",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Cacería a Tres Bandos en Namek",
    "summary": "Aterrizados en Namekusei, Krilin y Gohan descubren con pavor que el tirano Freezer y el fugitivo Vegeta ya están ejecutando aldeas para arrebatar las gigantescas esferas del dragón verde.",
    "offscreen": [
      "Goku consume una semilla del ermitaño traída por Karin y despega en la nave espacial de Capsule Corp con gravedad 100x.",
      "Vegeta asesina a Kiwi en un páramo rocoso iniciando su venganza clandestina contra Freezer."
    ]
  },
  {
    "id": "il-namek-viaje-ginyu-freezer",
    "fromVolumeId": "dbz-namek-caceria-esferas",
    "toVolumeId": "dbz-namek-fuerzas-ginyu",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "cosmic-event",
    "title": "La llamada a las Fuerzas Especiales Ginyu",
    "summary": "Desesperado tras ser humillado por Vegeta, quien le roba cinco esferas de su propia nave, Freezer convoca por radio galáctica a su escuadrón mercenario supremo: las Fuerzas Especiales Ginyu.",
    "offscreen": [
      "El Gran Patriarca de Namekusei libera el potencial latente de Gohan y Krilin tras bendecirlos con su mano mística.",
      "Goku entrena al borde del colapso físico en la nave bajo gravedad 100x, disparándose Kamehamehas a quemarropa para rozar la muerte y experimentar el Zenkai Power.",
      "Vegeta propone una alianza forzada a Krilin y Gohan al ver aterrizar las cinco cápsulas esféricas de las Fuerzas Ginyu."
    ]
  },
  {
    "id": "il-ginyu-freezer-freezer-ssj",
    "fromVolumeId": "dbz-namek-fuerzas-ginyu",
    "toVolumeId": "dbz-freezer-transformaciones",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El tanque de recuperación y la invocación de Polunga",
    "summary": "Goku queda gravemente herido tras el combate con Ginyu y es introducido en la cámara médica de la nave de Freezer. Krilin, Gohan y Dende aprovechan el sueño de Vegeta para invocar al dragón sagrado Polunga.",
    "offscreen": [
      "Piccolo se comunica telepáticamente con Gohan desde el planeta de Kaio-sama, rogándole que el primer deseo sea revivirlo y transportarlo a Namek.",
      "El Gran Patriarca agoniza en su torre, marcando el tiempo límite antes de que las esferas se extingan para siempre.",
      "Freezer descubre que su deseo de inmortalidad fracasó y vuela a toda velocidad enfurecido hacia su nave."
    ]
  },
  {
    "id": "il-dbz-freezer-transformaciones-dbz-freezer-goku-kaioken",
    "fromVolumeId": "dbz-freezer-transformaciones",
    "toVolumeId": "dbz-freezer-goku-kaioken",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Llanto de Vegeta y la Llegada de Goku",
    "summary": "Tras ser sanado por completo en la cápsula de regeneración, Goku aterriza en el campo de batalla justo cuando Freezer en su forma final tortura y perfora el corazón de un quebrado Vegeta.",
    "offscreen": [
      "Vegeta revela a Goku en su último aliento el genocidio del Planeta Vegeta antes de fallecer.",
      "Goku entierra a su orgulloso rival y encara al emperador del universo con serenidad glacial."
    ]
  },
  {
    "id": "il-dbz-freezer-goku-kaioken-dbz-freezer-super-saiyajin",
    "fromVolumeId": "dbz-freezer-goku-kaioken",
    "toVolumeId": "dbz-freezer-super-saiyajin",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Despertar de la Leyenda Milenaria",
    "summary": "La Genkidama masiva no logra acabar con Freezer, quien reaparece hiriendo de muerte a Piccolo y detonando el cuerpo de Krilin en el aire. La furia incontenible quiebra el alma de Goku, desatando el Super Saiyajin.",
    "offscreen": [
      "Goku ordena a Gohan tomar a Piccolo y volar de inmediato a la nave de escape antes de que Namek colapse.",
      "Freezer experimenta por primera vez en su vida el terror supremo ante los ojos esmeralda del guerrero dorado."
    ]
  },
  {
    "id": "il-freezer-ssj-garlic-jr",
    "fromVolumeId": "dbz-freezer-super-saiyajin",
    "toVolumeId": "dbz-garlic-jr",
    "gap": {
      "label": "+10 meses",
      "scale": "meses"
    },
    "kind": "time-jump",
    "title": "La reconstrucción en la Tierra y la Niebla del Mal",
    "summary": "Namek explota y Goku escapa milagrosamente en una cápsula de las Fuerzas Ginyu hacia el planeta Yardrat. En la Tierra, Polunga resucita a los caídos y transporta a los namekianos a un nuevo hogar pacífico.",
    "offscreen": [
      "Goku aprende en Yardrat el control del ki espiritual y la técnica de la Teletransportación (Shunkan Idō).",
      "Vegeta vaga por el cosmos en una nave robada buscando a Goku para superarlo.",
      "El Planeta Makyo se aproxima a la órbita terrestre cada 5000 años, liberando a Garlic Jr. de la Zona Muerta para corromper a los humanos con la Niebla Aqua."
    ]
  },
  {
    "id": "il-garlic-jr-androides-trunks",
    "fromVolumeId": "dbz-garlic-jr",
    "toVolumeId": "dbz-androides-trunks",
    "gap": {
      "label": "+1 año",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "El joven del futuro y la espada de luz",
    "summary": "Garlic Jr. es devuelto a la Zona Muerta y la Tierra vive un año de tranquilidad. De pronto, dos ki aterradores se aproximan a la atmósfera: Mecha Freezer y su padre el Rey Cold llegan sedientos de venganza.",
    "offscreen": [
      "Los Guerreros Z se reúnen aterrados en el páramo rocoso sabiendo que no tienen oportunidad sin Goku.",
      "Trunks del Futuro desciende de su máquina del tiempo en secreto, empuñando su espada para partir en dos a Freezer en segundos.",
      "Goku aterriza en su cápsula de Yardrat y Trunks le advierte en privado sobre la enfermedad del corazón y la rebelión de los androides en tres años."
    ],
    "movieIds": [
      "m9",
      "m10",
      "sp2"
    ]
  },
  {
    "id": "il-dbz-androides-trunks-dbz-androides-19-20",
    "fromVolumeId": "dbz-androides-trunks",
    "toVolumeId": "dbz-androides-19-20",
    "gap": {
      "label": "+3 años",
      "scale": "anios"
    },
    "kind": "training",
    "title": "Tres años de preparación bajo la advertencia",
    "summary": "Goku, Gohan y Piccolo entrenan juntos, mientras Vegeta desafía la gravedad 450x en la Corporación Cápsula obsesionado con despertar el Super Saiyajin antes del fatídico 12 de mayo a las 10 de la mañana.",
    "offscreen": [
      "Yamcha, Krilin y Tenshinhan llevan sus cuerpos al límite en los gimnasios de gravedad.",
      "El Dr. Gero culmina en su laboratorio montañoso al Androide 19 y se autoconvierte en el Androide 20."
    ]
  },
  {
    "id": "il-dbz-androides-19-20-dbz-androides-17-18",
    "fromVolumeId": "dbz-androides-19-20",
    "toVolumeId": "dbz-androides-17-18",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Despertar de los Gemelos en el Laboratorio",
    "summary": "Acorralado tras ser mutilado por Vegeta en Super Saiyajin, el Dr. Gero huye a su laboratorio secreto en las montañas septentrionales para activar a sus creaciones más temidas: el Androide 17 y la Androide 18.",
    "offscreen": [
      "Trunks llega a la ciudad y comprueba aterrado que los androides 19 y 20 no son los mismos que destruyeron su futuro.",
      "17 y 18 decapitan a su creador y activan también al pacifista Androide 16."
    ]
  },
  {
    "id": "il-androides-cell-imperfecto",
    "fromVolumeId": "dbz-androides-17-18",
    "toVolumeId": "dbz-cell-imperfecto",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "context",
    "title": "La segunda máquina del tiempo y la cáscara vacía",
    "summary": "Los androides 17 y 18 humillan a Vegeta y parten tranquilamente en camioneta para buscar a Goku. Bulma informa del hallazgo de una segunda máquina del tiempo cubierta de musgo que llegó desde un futuro alternativo.",
    "offscreen": [
      "Goku convalece bajo los efectos de la medicina para el corazón que trajo Trunks.",
      "Kamisama y Piccolo observan cómo miles de ciudadanos desaparecen sin dejar rastro en la ciudad de Ginger Town.",
      "Piccolo toma la dolorosa decisión de fusionarse para siempre con Kamisama, convirtiéndose en el Super Namekiano definitivo."
    ],
    "movieIds": [
      "m11"
    ]
  },
  {
    "id": "il-dbz-cell-imperfecto-dbz-cell-semiperfecto",
    "fromVolumeId": "dbz-cell-imperfecto",
    "toVolumeId": "dbz-cell-semiperfecto",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "training",
    "title": "La Habitación del Tiempo y la Absorción de 17",
    "summary": "Goku se recupera de su cardiopatía e introduce a Vegeta y Trunks en la Habitación del Tiempo. Mientras tanto, Cell localiza a los androides en las islas tropicales y absorbe a 17 ante el horror de Piccolo.",
    "offscreen": [
      "Piccolo es noqueado por Cell y arrojado al océano.",
      "Androide 16 combate valientemente demostrando su Hell's Flash antes de la absorción de 17."
    ]
  },
  {
    "id": "il-cell-imperfecto-juegos-cell",
    "fromVolumeId": "dbz-cell-semiperfecto",
    "toVolumeId": "dbz-cell-espera-torneo",
    "gap": {
      "label": "+10 días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "El nacimiento del cuerpo perfecto y el anuncio televisivo",
    "summary": "Vegeta permite arrogantemente a Cell absorber a 18 para buscar un duelo perfecto. Cell alcanza su Perfección Absoluta, barre a Vegeta y Trunks y convoca por televisión a los Juegos de Cell en un plazo de diez días.",
    "offscreen": [
      "Goku y Gohan entran a la Habitación del Tiempo, donde Gohan alcanza el Super Saiyajin y ambos aprenden a mantener la transformación como estado natural y relajado.",
      "Goku viaja a Nuevo Namekusei y trae a Dende para consagrarse como nuevo Dios de la Tierra y reactivar las esferas con tres deseos.",
      "Mr. Satán se proclama salvador del mundo organizando ruedas de prensa multitudinarias."
    ],
    "movieIds": [
      "m12"
    ]
  },
  {
    "id": "il-dbz-cell-espera-torneo-dbz-cell-goku-vs-cell",
    "fromVolumeId": "dbz-cell-espera-torneo",
    "toVolumeId": "dbz-cell-goku-vs-cell",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Apertura del Torneo y el Duelo Supremo de Goku",
    "summary": "Llegado el mediodía fijado por Cell, los guerreros aterrizan en la plataforma de roca perfecta construida por el bioandroide. Tras la patética farsa de Mr. Satán, Goku sube a la arena para abrir el combate.",
    "offscreen": [
      "Cell despliega una velocidad y técnica calcadas a las de Goku, disfrutando cada segundo del combate.",
      "Goku planifica en secreto medir el verdadero límite de Cell para confiarle el destino del universo a Gohan."
    ]
  },
  {
    "id": "il-dbz-cell-goku-vs-cell-dbz-cell-gohan-ssj2-final",
    "fromVolumeId": "dbz-cell-goku-vs-cell",
    "toVolumeId": "dbz-cell-gohan-ssj2-final",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Semilla Senzu y la Furia Desatada de Gohan",
    "summary": "Para estupor de todos, Goku se rinde, le arroja una semilla Senzu a Cell para sanarlo y empuja a su hijo Gohan al combate, asegurando que su poder oculto es el único capaz de destruirlo.",
    "offscreen": [
      "Cell engendra a los Cell Juniors para torturar a los Guerreros Z y forzar la ira de Gohan.",
      "La cabeza destrozada del Androide 16 susurra sus últimas palabras pidiéndole a Gohan que proteja a la naturaleza."
    ]
  },
  {
    "id": "il-juegos-cell-otro-mundo",
    "fromVolumeId": "dbz-cell-gohan-ssj2-final",
    "toVolumeId": "dbz-torneo-otro-mundo",
    "gap": {
      "label": "Pocos meses",
      "scale": "meses"
    },
    "kind": "cosmic-event",
    "title": "Goku en el Más Allá y el Torneo Celestial",
    "summary": "Goku se sacrifica teletransportando al autodestructivo Cell al planeta de Kaio-sama. En la Tierra, Gohan desintegra a Super Perfect Cell con el Kamehameha Padre-Hijo. En el Más Allá, Goku participa en el torneo de los cuatro Kaios.",
    "offscreen": [
      "Goku llega al Palacio del Gran Kaio-sama y conoce a guerreros legendarios como Paikuhan y Olibu.",
      "Trunks regresa a su línea temporal con el poder adquirido y extermina con facilidad a los androides 17, 18 y Cell imperfecto de su futuro.",
      "Vegeta cae en una profunda depresión marcial jurando no volver a pelear al perder a su eterno rival."
    ],
    "movieIds": [
      "m13"
    ]
  },
  {
    "id": "il-otro-mundo-buu-majin-vegeta",
    "fromVolumeId": "dbz-torneo-otro-mundo",
    "toVolumeId": "dbz-buu-gran-saiyaman",
    "gap": {
      "label": "+7 años",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "Siete años de paz y el Gran Saiyaman",
    "summary": "La Tierra vive siete años de prosperidad. Gohan ingresa a la preparatoria Orange Star en Satan City, combate el crimen como el justiciero enmascarado Gran Saiyaman y conoce a Videl, la hija de Mr. Satán.",
    "offscreen": [
      "Goten y Trunks crecen entrenando juntos y alcanzando el Super Saiyajin a edad infantil para asombro de sus familias.",
      "Vegeta retoma su entrenamiento obsesivo en la gravedad de Capsule Corp soñando con el regreso de Kakarotto.",
      "Goku entrena intensamente en el Más Allá, superando la barrera del Super Saiyajin 2 y desbloqueando el legendario Super Saiyajin 3."
    ],
    "movieIds": [
      "m14",
      "m15"
    ]
  },
  {
    "id": "il-dbz-buu-gran-saiyaman-dbz-buu-torneo-25",
    "fromVolumeId": "dbz-buu-gran-saiyaman",
    "toVolumeId": "dbz-buu-torneo-25",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "El Retorno de Goku por Un Día",
    "summary": "Goku anuncia telepáticamente a través de Uranai Baba que tiene permiso del Más Allá para volver a la Tierra durante 24 horas y competir en el 25° Torneo de Artes Marciales junto a todos sus amigos.",
    "offscreen": [
      "Gohan enseña a Videl a controlar su ki y a volar sobre los cielos de Satan City.",
      "Spopovich y Yamu reciben órdenes de Babidi para infiltrarse en el torneo y recolectar energía pura."
    ]
  },
  {
    "id": "il-dbz-buu-torneo-25-dbz-buu-nave-babidi",
    "fromVolumeId": "dbz-buu-torneo-25",
    "toVolumeId": "dbz-buu-nave-babidi",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Infiltración en la Nave Espacial Enterrada",
    "summary": "Tras el asalto a Gohan en la arena, Shin (el Supremo Kaiosama) y Kibito guían a Goku, Vegeta y Gohan hacia la nave subterránea del mago Babidi oculta bajo las rocas.",
    "offscreen": [
      "Dabura petrifica con su saliva a Krilin y Piccolo.",
      "Goku y Vegeta superan con burlas los primeros niveles derrotando a Yakon y Pui Pui."
    ]
  },
  {
    "id": "il-buu-majin-vegeta-buu-ssj3-fusion",
    "fromVolumeId": "dbz-buu-nave-babidi",
    "toVolumeId": "dbz-buu-despertar-sacrificio",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La M de Babidi y el Despertar de la Bestia Rosa",
    "summary": "Babidi explota el rencor y orgullo reprimido de Vegeta convirtiéndolo en Majin Vegeta. El colosal intercambio de energía con Goku llena el medidor que rompe el sello del temible Majin Buu.",
    "offscreen": [
      "Majin Vegeta noquea a Goku a traición con un golpe en la nuca para enfrentar él solo al monstruo rosado.",
      "Shin y Gohan son barridos en segundos por el poder infantil pero destructivo de Majin Buu.",
      "Trunks y Goten vuelan hacia el lugar de la batalla sintiendo el ki gigantesco de sus padres."
    ]
  },
  {
    "id": "il-dbz-buu-despertar-sacrificio-dbz-buu-ssj3-fusion-dance",
    "fromVolumeId": "dbz-buu-despertar-sacrificio",
    "toVolumeId": "dbz-buu-ssj3-fusion-dance",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "training",
    "title": "La Danza Metamor y el Rugido del Super Saiyajin 3",
    "summary": "Tras el fútil sacrificio de Vegeta, Goku despierta y traslada a los sobrevivientes al Templo Sagrado. Ante la inminente destrucción del planeta, decide enseñar a Goten y Trunks la técnica sagrada de la Fusión.",
    "offscreen": [
      "Goku despliega el Super Saiyajin 3 haciendo temblar el planeta entero para frenar a Buu mientras Trunks rescata el radar del dragón.",
      "El tiempo de Goku en la Tierra se agota por el gasto energético del SSJ3 y se despide de todos regresando al Más Allá.",
      "Piccolo toma el mando del entrenamiento de Goten y Trunks en la plataforma celestial."
    ]
  },
  {
    "id": "il-buu-ssj3-fusion-buu-gotenks-gohan",
    "fromVolumeId": "dbz-buu-ssj3-fusion-dance",
    "toVolumeId": "dbz-buu-super-buu-gotenks",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "context",
    "title": "Mr. Satán, el Perro Bee y la Maldad Pura",
    "summary": "El Buu Gordo entabla amistad con Mr. Satán y rescata a un perrito herido, pero unos pistoleros disparan a Bee desatando la furia interna de Buu. El humo negro engendra a Evil Buu, quien devora al gordo transformándose en el aterrador Super Buu.",
    "offscreen": [
      "Super Buu asesina a los pistoleros y sube al Templo Sagrado exigiendo pelear de inmediato con el guerrero prometido.",
      "Gohan entrena en el sagrado Planeta Supremo bajo el ritual místico de desbloqueo de poder del Anciano Kaiosama de hace 15 generaciones.",
      "Piccolo encierra a Super Buu en la Habitación del Tiempo para dar minutos cruciales a Gotenks."
    ]
  },
  {
    "id": "il-buu-gotenks-buu-vegetto-kidbuu",
    "fromVolumeId": "dbz-buu-super-buu-gotenks",
    "toVolumeId": "dbz-buu-gohan-mistico",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Retorno del Guerrero Definitivo",
    "summary": "Gotenks SSJ3 y Super Buu destruyen la dimensión de la Habitación del Tiempo y continúan su duelo en el templo, destruyéndolo por completo. En el clímax del combate, Gohan Místico aterriza desde el Más Allá con un poder abrumador.",
    "offscreen": [
      "Gohan humilla sin esfuerzo a Super Buu con una serenidad marcial nunca antes vista.",
      "Super Buu finge huir y tiende una trampa para absorber a Gotenks y Piccolo."
    ]
  },
  {
    "id": "il-dbz-buu-gohan-mistico-dbz-buu-vegetto-kidbuu",
    "fromVolumeId": "dbz-buu-gohan-mistico",
    "toVolumeId": "dbz-buu-vegetto-kidbuu",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Los Pendientes Pothala y la Genkidama Universal",
    "summary": "Super Buu absorbe a Gohan y acorrala a Goku, forzando al Anciano Kaiosama a darle su propia vida y los pendientes Pothala. En el último instante, Enma Daioh envía a Vegeta a la Tierra para consumar la legendaria fusión Vegetto.",
    "offscreen": [
      "Vegetto juega con Buu y se deja absorber deliberadamente para rescatar a sus hijos del vientre del monstruo.",
      "Kid Buu desintegra la Tierra y Goku convoca la Genkidama Universal con ayuda de Mr. Satán en el Planeta Supremo."
    ]
  },
  {
    "id": "il-dbz-buu-vegetto-kidbuu-dbz-buu-mundo-en-paz",
    "fromVolumeId": "dbz-buu-vegetto-kidbuu",
    "toVolumeId": "dbz-buu-mundo-en-paz",
    "gap": {
      "label": "+10 años",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "Diez Años de Paz y la Reencarnación de Buu",
    "summary": "Las esferas del dragón borran el recuerdo de Majin Buu en la humanidad y el Buu Gordo vive en paz con Mr. Satán. Pasan diez años de calma absoluta hasta el 28° Torneo de Artes Marciales.",
    "offscreen": [
      "Gohan y Videl se casan y tienen a Pan, quien demuestra una fuerza asombrosa desde bebé.",
      "Goku entrena solo esperando que se cumpla su deseo de que el alma de Buu renazca como un ser bondadoso."
    ],
    "movieIds": [
      "m16",
      "m17"
    ]
  },
  {
    "id": "il-kidbuu-daima-conspiracion",
    "fromVolumeId": "dbz-buu-mundo-en-paz",
    "toVolumeId": "db-daima-conspiracion",
    "gap": {
      "label": "Pocos meses",
      "scale": "meses"
    },
    "kind": "cosmic-event",
    "title": "La sombra del Reino Demoníaco",
    "summary": "Tras la erradicación de Kid Buu, la celebración en la Tierra es vigilada desde el Reino de los Demonios por el Rey Gomah y Degesu, quienes conspiran para robar las esferas del dragón y neutralizar a los saiyajin.",
    "offscreen": [
      "Gomah y Degesu utilizan las esferas de la Tierra para convertir a Goku y sus amigos en niños mediante un deseo a Shenlong.",
      "El misterioso Glorio desciende en nave para ofrecer transporte a Goku hacia el desconocido Gran Reino Demoníaco.",
      "Goku recupera su entrañable Báculo Sagrado (Nyoibō) adaptándose a su nuevo cuerpo infantil."
    ]
  },
  {
    "id": "il-db-daima-conspiracion-db-daima-tercer-mundo",
    "fromVolumeId": "db-daima-conspiracion",
    "toVolumeId": "db-daima-tercer-mundo",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Entrada al Tercer Mundo Demoníaco",
    "summary": "Goku Mini, Kaio-shin Mini y Glorio cruzan la puerta dimensional interestelar, aterrizando en los agrestes y misteriosos paisajes del Tercer Mundo Demoníaco donde las leyes de la física son completamente ajenas.",
    "offscreen": [
      "Glorio demuestra sus habilidades de combate y tecnología demoníaca.",
      "Goku prueba las comidas locales y aprende a dominar su báculo sagrado en gravedad extraña."
    ]
  },
  {
    "id": "il-db-daima-tercer-mundo-db-daima-tamagami",
    "fromVolumeId": "db-daima-tercer-mundo",
    "toVolumeId": "db-daima-tamagami",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "transition",
    "title": "La Búsqueda de las Esferas de los Tamagami",
    "summary": "Con la joven princesa Panzy sumada al equipo, los guerreros viajan por las fortalezas demoníacas desafiando a los colosales Tamagami, guardianes ancestrales de las esferas creadas por Neva.",
    "offscreen": [
      "La Dra. Arinsu vigila los progresos de Goku desde sus laboratorios oscuros.",
      "Vegeta Mini y Piccolo Mini buscan su propia forma de ingresar al reino demoníaco."
    ]
  },
  {
    "id": "il-daima-conspiracion-daima-climax",
    "fromVolumeId": "db-daima-tamagami",
    "toVolumeId": "db-daima-climax",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Batalla en el Primer Mundo y el Ojo del Mal",
    "summary": "Reunidas las esferas demoníacas, el Rey Gomah desata el Ojo del Mal transformándose en un coloso monstruoso. Goku Mini, Vegeta Mini y sus aliados deben liberar el ki máximo para salvar ambos mundos.",
    "offscreen": [
      "Neva revela la verdad milenaria sobre la creación de las esferas del dragón en el Reino Demoníaco.",
      "Degesu y la Dra. Arinsu intentan traicionarse mutuamente en la sala del trono.",
      "Goku demuestra que el corazón saiyajin y el ki puro no conocen límites de edad o estatura."
    ]
  },
  {
    "id": "il-daima-climax-batalla-dioses",
    "fromVolumeId": "db-daima-climax",
    "toVolumeId": "dbs-dioses-llegada",
    "gap": {
      "label": "+3 años",
      "scale": "anios"
    },
    "kind": "cosmic-event",
    "title": "El despertar del Dios de la Destrucción",
    "summary": "Restaurados sus cuerpos tras la odisea demoníaca, la paz perdura en la Tierra. En el confín del Universo 7, el Dios de la Destrucción Lord Beerus despierta tras 39 años de siesta buscando al mítico Super Saiyajin Dios.",
    "offscreen": [
      "Goku trabaja como agricultor por orden de Milk pero escapa a entrenar al planeta de Kaio-sama.",
      "El Pez Oráculo confirma a Whis la visión del guerrero divino que rivalizará con Beerus.",
      "Bulma organiza su fiesta de cumpleaños número 38 en un crucero de lujo con todos los Guerreros Z."
    ],
    "movieIds": [
      "m18"
    ]
  },
  {
    "id": "il-dbs-dioses-llegada-dbs-dioses-batalla",
    "fromVolumeId": "dbs-dioses-llegada",
    "toVolumeId": "dbs-dioses-batalla",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Ritual de los Seis Saiyajin Puros",
    "summary": "Tras humillar a Vegeta y a los Guerreros Z por un plato de pudín, Beerus amenaza con pulverizar el planeta. Goku convoca a Shenlong, quien revela el ritual milenario para concebir al Super Saiyajin God.",
    "offscreen": [
      "Videl revela su embarazo de Pan para completar el sexto corazón saiyajin requerido por el ritual.",
      "El cielo se tiñe de carmesí y Goku renace con el aura divina de los dioses."
    ]
  },
  {
    "id": "il-batalla-dioses-resurreccion-f",
    "fromVolumeId": "dbs-dioses-batalla",
    "toVolumeId": "dbs-resurreccion-preparacion",
    "gap": {
      "label": "+1 año",
      "scale": "anios"
    },
    "kind": "training",
    "title": "El entrenamiento con Whis y la venganza de Sorbet",
    "summary": "Beerus perdona la Tierra fascinado por su gastronomía. Goku y Vegeta convencen a Whis para que los entrene en el planeta de Beerus sellando su ki interior, mientras el remanente del ejército de Freezer llega a la Tierra.",
    "offscreen": [
      "Sorbet y Tagoma roban las esferas del dragón en la Tierra y resucitan al tirano troceado en pedazos.",
      "Freezer es regenerado en una cámara médica y decide entrenar cuatro meses por primera vez en su vida.",
      "Goku y Vegeta alcanzan el Super Saiyajin Blue conteniendo el poder divino dentro del Super Saiyajin."
    ],
    "movieIds": [
      "m19"
    ]
  },
  {
    "id": "il-dbs-resurreccion-preparacion-dbs-resurreccion-dorado",
    "fromVolumeId": "dbs-resurreccion-preparacion",
    "toVolumeId": "dbs-resurreccion-dorado",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Desembarco de Golden Freezer y el Super Saiyajin Blue",
    "summary": "Freezer aterriza con mil soldados en las costas terrestres. Gohan y los veteranos resisten con valentía hasta que Whis teletransporta a Goku y Vegeta directamente al campo de batalla.",
    "offscreen": [
      "Jaco el Patrullero Galáctico alerta a Bulma sobre la invasión estelar.",
      "Freezer desvela su nueva piel dorada alcanzada tras meses de tortura autoimpuesta."
    ]
  },
  {
    "id": "il-resurreccion-f-torneo-u6",
    "fromVolumeId": "dbs-resurreccion-dorado",
    "toVolumeId": "dbs-torneo-u6-inicio",
    "gap": {
      "label": "Pocos meses",
      "scale": "meses"
    },
    "kind": "cosmic-event",
    "title": "El reto de Champa y las Súper Esferas del Dragón",
    "summary": "Champa, Dios de la Destrucción del Universo 6 y hermano gemelo de Beerus, reta a un torneo entre universos disputando la Tierra y las Súper Esferas del Dragón del tamaño de planetas.",
    "offscreen": [
      "Beerus y Champa seleccionan cinco guerreros por universo para el combate en el Planeta Sin Nombre.",
      "Bulma construye el radar de súper esferas con ayuda de Jaco y visita al sabio Zuno para conocer su origen.",
      "Beerus inventa la mentira de Monaka para motivar a Goku y Vegeta a superarse."
    ]
  },
  {
    "id": "il-dbs-torneo-u6-inicio-dbs-torneo-u6-hit",
    "fromVolumeId": "dbs-torneo-u6-inicio",
    "toVolumeId": "dbs-torneo-u6-hit",
    "gap": {
      "label": "Mismo día",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Asesino Legendario del Salto Temporal",
    "summary": "Vegeta barre a Frost, Magetta y enseña al joven Cabba a transformarse en Super Saiyajin. Pero el Universo 6 guarda a su as definitivo: Hit, el sicario milenario que manipula el flujo del tiempo.",
    "offscreen": [
      "Hit noquea a Vegeta en un parpadeo deteniendo el tiempo 0,1 segundos.",
      "Goku observa el combate de pie ideando cómo quebrar la técnica del asesino."
    ]
  },
  {
    "id": "il-torneo-u6-copy-vegeta",
    "fromVolumeId": "dbs-torneo-u6-hit",
    "toVolumeId": "dbs-copy-vegeta",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "context",
    "title": "El Agua Sobrehumana del Planeta Pot-au-feu",
    "summary": "Tras ganar el torneo y desear con las Súper Esferas restaurar la Tierra del Universo 6, Trunks y Goten quedan atrapados accidentalmente en la nave de Monaka rumbo al planeta Pot-au-feu.",
    "offscreen": [
      "Gryll y sus bandidos liberan el Agua Sobrehumana (Commeson), que clona a Vegeta absorbiendo todos sus poderes.",
      "El verdadero Vegeta se vuelve transparente y dispone de minutos antes de desaparecer para siempre.",
      "Goku viaja a Pot-au-feu para medirse contra la réplica exacta de Vegeta Super Saiyajin Blue."
    ]
  },
  {
    "id": "il-copy-vegeta-goku-black",
    "fromVolumeId": "dbs-copy-vegeta",
    "toVolumeId": "dbs-black-misterio",
    "gap": {
      "label": "Pocos días",
      "scale": "dias"
    },
    "kind": "paradox",
    "title": "La pesadilla del futuro y el rostro de Goku",
    "summary": "Vegeta es salvado y la paz retorna a Capsule Corp. De pronto, la máquina del tiempo aterriza ensangrentada en el jardín con Trunks del Futuro inconsciente, huyendo de una deidad destructora idéntica a Son Goku: Goku Black.",
    "offscreen": [
      "En el futuro apocalíptico, Mai y Trunks resisten como guerrilla urbana ante los ataques despiadados de Black.",
      "Goku Black utiliza su Anillo del Tiempo para abrir una brecha temporal y seguir a Trunks al presente.",
      "Beerus y Whis detectan en el ki de Black la firma energética del Supremo Kaiosama del Universo 10, Zamasu."
    ]
  },
  {
    "id": "il-dbs-black-misterio-dbs-black-zamasu-guerra",
    "fromVolumeId": "dbs-black-misterio",
    "toVolumeId": "dbs-black-zamasu-guerra",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Plan Cero Humanos y la Inmortalidad Divina",
    "summary": "Goku, Vegeta y Trunks viajan al futuro alternativo descubriendo la alianza entre Goku Black en Super Saiyajin Rosé y el Zamasu del futuro que ostenta la inmortalidad absoluta concedida por las Súper Esferas.",
    "offscreen": [
      "Vegeta es atravesado por la espada de ki de Black en su primer asalto.",
      "Trunks despierta la transformación del Super Saiyajin Rage para contener a ambos dioses mientras Goku aprende el Mafūba."
    ]
  },
  {
    "id": "il-dbs-black-zamasu-guerra-dbs-black-epilogo-interludio",
    "fromVolumeId": "dbs-black-zamasu-guerra",
    "toVolumeId": "dbs-black-epilogo-interludio",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Fusión Divina y el Botón de Zeno-sama",
    "summary": "Ante el poder de Vegetto Blue y la Espada de la Esperanza de Trunks, Zamasu corrompe el firmamento del universo. Sin otra alternativa, Goku presiona el botón obsequiado por Zeno-sama, quien erradica la línea temporal corrupta.",
    "offscreen": [
      "Goku rescata al Zeno-sama del futuro y lo presenta como amigo al Zeno-sama del presente.",
      "Trunks y Mai se despiden entre lágrimas rumbo a una nueva línea temporal pacífica."
    ]
  },
  {
    "id": "il-goku-black-exhibicion-zen",
    "fromVolumeId": "dbs-black-epilogo-interludio",
    "toVolumeId": "dbs-exhibicion-zen",
    "gap": {
      "label": "Pocos meses",
      "scale": "meses"
    },
    "kind": "cosmic-event",
    "title": "La promesa de Zeno-sama y los Universos en Riesgo",
    "summary": "Goku recuerda a Zeno-sama su promesa del gran torneo multiversal. El Rey de Todo convoca a los 12 Dioses de la Destrucción y Kaioshins al Torneo de Exhibición Zen, anunciando que los universos derrotados serán borrados.",
    "offscreen": [
      "Goku, Gohan y Majin Buu disputan el torneo preliminar frente al Trío del Peligro del Universo 9.",
      "Toppo, líder de las Tropas del Orgullo del Universo 11, reta a Goku advirtiéndole que Jiren es más fuerte que los dioses.",
      "El Gran Sacerdote Daishinkan decreta que 80 guerreros combatirán simultáneamente en un Battle Royale de 48 minutos."
    ]
  },
  {
    "id": "il-exhibicion-reclutamiento-u7",
    "fromVolumeId": "dbs-exhibicion-zen",
    "toVolumeId": "dbs-reclutamiento-u7",
    "gap": {
      "label": "+40 horas",
      "scale": "dias"
    },
    "kind": "context",
    "title": "El reclutamiento contrarreloj del Universo 7",
    "summary": "Quedan menos de dos días para el inicio del torneo y Goku debe reunir diez guerreros. Mientras Gohan recupera su estado místico con Piccolo, Goku recluta a Krilin, A18, A17 y al Maestro Roshi.",
    "offscreen": [
      "Goku visita la isla de guardaparques del Androide 17 comprobando su gigantesco aumento de poder.",
      "Majin Buu cae en un sueño profundo irreversible y Goku viaja al Infierno para reclutar por 24 horas a Freezer.",
      "Los asesinos del Universo 9 intentan emboscar a Freezer con energía destructiva pero son exterminados con sadismo."
    ]
  },
  {
    "id": "il-reclutamiento-torneo-poder",
    "fromVolumeId": "dbs-reclutamiento-u7",
    "toVolumeId": "dbs-torneo-poder-caos",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "cosmic-event",
    "title": "El Reino de la Nada y el Inicio del Battle Royale",
    "summary": "Los diez elegidos del Universo 7 se toman de las manos y aterrizan en la arena circular construida en el Reino de la Nada. Daishinkan da inicio a los 48 minutos más intensos de la historia del multiverso.",
    "offscreen": [
      "Universos enteros son eliminados y borrados de la existencia en los primeros compases del torneo.",
      "El Maestro Roshi demuestra la maestría del Estilo Tortuga derrotando oponentes al límite de su resistencia vital.",
      "Gohan lidera la formación estratégica del equipo manteniendo la cordura en el caos."
    ]
  },
  {
    "id": "il-dbs-torneo-poder-caos-dbs-torneo-poder-ultra-instinto",
    "fromVolumeId": "dbs-torneo-poder-caos",
    "toVolumeId": "dbs-torneo-poder-ultra-instinto",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Genkidama Colapsada y la Señal Divina",
    "summary": "Jiren devora la Genkidama de Goku forzándolo a caer dentro del abismo energético. De las cenizas del impacto, Goku despierta con ojos plateados la Doctrina Egoísta: el Ultra Instinto Señal.",
    "offscreen": [
      "Los Dioses de la Destrucción se ponen de pie asombrados ante el despertar del Migatte no Gokui.",
      "Goku esquiva cada golpe de Jiren sin pensar, guiado por el instinto puro de sus células."
    ]
  },
  {
    "id": "il-dbs-torneo-poder-ultra-instinto-dbs-torneo-poder-climax",
    "fromVolumeId": "dbs-torneo-poder-ultra-instinto",
    "toVolumeId": "dbs-torneo-poder-climax",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Cabello Plateado y el Milagro de la Alianza",
    "summary": "Goku supera sus límites y domina el Ultra Instinto Completo con cabello blanco plateado, superando a Jiren antes de que su cuerpo colapse. En los últimos segundos, Goku, Freezer y 17 unen fuerzas por el destino del cosmos.",
    "offscreen": [
      "Vegeta entrega su último ki a Goku antes de caer de la plataforma.",
      "A17 sobrevive en la arena y pide a Super Shenlong el deseo altruista de restaurar todos los universos borrados."
    ]
  },
  {
    "id": "il-torneo-poder-black-star",
    "fromVolumeId": "dbs-torneo-poder-climax",
    "toVolumeId": "dbgt-black-star-origen",
    "gap": {
      "label": "+9 años",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "Diez años después: El templo y las esferas de estrella negra",
    "summary": "Tras el regreso a la vida pacífica y el torneo con Oob, Goku culmina su entrenamiento en el Templo Sagrado. El anciano Pilaf se infiltra para robar las olvidadas Esferas de la Estrella Negra creadas por el Piccolo original.",
    "offscreen": [
      "Pilaf tropieza y desea accidentalmente ante el Shenlong Rojo que Goku vuelva a ser niño.",
      "Kaio del Norte advierte que si las esferas de estrella negra no se reúnen en un año en la Tierra, el planeta entero explotará.",
      "Bulma y Trunks preparan la nave espacial de alta tecnología para el viaje interestelar."
    ],
    "movieIds": [
      "m20",
      "m21"
    ]
  },
  {
    "id": "il-dbgt-black-star-origen-dbgt-black-star-viaje",
    "fromVolumeId": "dbgt-black-star-origen",
    "toVolumeId": "dbgt-black-star-viaje",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "El Despegue Interestelar con Pan y Giru",
    "summary": "Pan sabotea el despegue sustituyendo a Goten, y la nave espacial despega hacia el cosmos con Goku Mini, Trunks y Pan a bordo, conociendo de inmediato al simpático robot Giru.",
    "offscreen": [
      "Giru absorbe el radar del dragón fusionándolo con su cuerpo.",
      "El trío viaja de planeta en planeta viviendo extrañas aventuras cómicas y rescatando las primeras esferas."
    ]
  },
  {
    "id": "il-black-star-baby",
    "fromVolumeId": "dbgt-black-star-viaje",
    "toVolumeId": "dbgt-baby-invasion",
    "gap": {
      "label": "Pocos meses",
      "scale": "meses"
    },
    "kind": "cosmic-event",
    "title": "El rencor de los Tsufurujin y el parásito Baby",
    "summary": "En el Planeta M2, los guerreros descubren la conspiración del Dr. Myuu y su creación definitiva: Baby, el parásito artificial creado con el ADN del extinto pueblo Tsufurujin para vengarse de los saiyajin.",
    "offscreen": [
      "Baby escapa por el espacio e infecta en secreto la Tierra tomando el control de Goten, Gohan y Vegeta.",
      "Goku, Trunks y Pan regresan felices a la Tierra con las esferas sin sospechar que todos sus amigos y familiares son marionetas de Baby.",
      "Goku es desterrado a la extraña Dimensión del Espacio Sugoroku tras ser derrotado por Vegeta-Baby."
    ]
  },
  {
    "id": "il-dbgt-baby-invasion-dbgt-baby-ssj4",
    "fromVolumeId": "dbgt-baby-invasion",
    "toVolumeId": "dbgt-baby-ssj4",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "La Extracción de la Cola y el Oozaru Dorado",
    "summary": "En el Planeta Supremo, el Anciano Kaiosama utiliza unas tenazas gigantes para extraerle la cola a Goku. De regreso a la Tierra, la contemplación del planeta hace rugir el Oozaru Dorado primal.",
    "offscreen": [
      "Pan llora frente al gigantesco mono dorado recordando sus viajes y haciéndolo recobrar la cordura.",
      "El pelaje rojo y la melena oscura del legendario Super Saiyajin 4 emergen en Goku."
    ]
  },
  {
    "id": "il-baby-super-17",
    "fromVolumeId": "dbgt-baby-ssj4",
    "toVolumeId": "dbgt-super-17",
    "gap": {
      "label": "+1 año",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "La conspiración del Infierno y la Fusión de los 17",
    "summary": "Baby es destruido y Piccolo se sacrifica con la explosión de la Tierra para extinguir las esferas negras. Un año después, el Dr. Gero y el Dr. Myuu unen sus conocimientos en el Infierno para crear al Androide 17 definitivo.",
    "offscreen": [
      "Los muertos y viejos villanos escapan a la Tierra a través de una brecha dimensional.",
      "Goku baja al Infierno para detener a Cell y Freezer y queda atrapado por una barrera mágica.",
      "Super 17 absorbe la energía de todos los Guerreros Z y asesina a Krilin provocando la furia de A18."
    ]
  },
  {
    "id": "il-super-17-dragones",
    "fromVolumeId": "dbgt-super-17",
    "toVolumeId": "dbgt-dragones-primeros",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "cosmic-event",
    "title": "La Fisura de las Esferas y el Humo Negro",
    "summary": "Goku destruye a Super 17 con el Puño del Dragón. Al reunir las esferas para revivir a Krilin, estas se quiebran emitiendo un humo negro: la energía negativa acumulada por 40 años de deseos engendra a los 7 Dragones Malignos.",
    "offscreen": [
      "El Shenlong de ojos rojos anuncia el castigo cósmico por el abuso egoísta de los deseos.",
      "Goku y Pan parten por el planeta con Giru derrotando a los primeros cuatro dragones de energía negativa.",
      "Suu Shenron, el noble dragón de cuatro estrellas, entabla un duelo de honor y respeto con Goku."
    ]
  },
  {
    "id": "il-dbgt-dragones-primeros-dbgt-dragones-climax",
    "fromVolumeId": "dbgt-dragones-primeros",
    "toVolumeId": "dbgt-dragones-climax",
    "gap": {
      "label": "Inmediato",
      "scale": "continuo"
    },
    "kind": "transition",
    "title": "Omega Shenron y la Fusión de Gogeta SSJ4",
    "summary": "Syn Shenron absorbe las siete esferas corrompidas mutando en Omega Shenron. Bulma crea la máquina de rayos Blantz para que Vegeta alcance el SSJ4 y se fusione con Goku en el todopoderoso Gogeta Super Saiyajin 4.",
    "offscreen": [
      "Gogeta SSJ4 juega con Omega Shenron con confeti y el Big Bang Kamehameha x100.",
      "La fusión se disuelve por exceso de poder y Goku prepara la Genkidama Universal de toda la galaxia."
    ]
  },
  {
    "id": "il-epilogo-dragones",
    "fromVolumeId": "dbgt-dragones-climax",
    "toVolumeId": null,
    "gap": {
      "label": "+100 años",
      "scale": "anios"
    },
    "kind": "time-jump",
    "title": "El Adiós de Goku y la Leyenda Eterna",
    "summary": "Shenlong purificado sana a la Tierra y anuncia que las esferas deben marcharse para siempre. Goku se acuesta sobre el lomo del dragón, absorbe las esferas en su cuerpo y se despide de Krilin y Piccolo. Cien años después, una anciana Pan sonríe en el torneo al vislumbrar el espíritu de Goku contemplando el combate de Goku Jr. y Vegeta Jr.",
    "offscreen": [
      "Goku comparte una última taza de té con el Maestro Roshi y Krilin en Kame House antes de partir.",
      "Piccolo estrecha la mano de Goku en el Infierno como guardián eterno de los dos mundos.",
      "La estatua de Goku en el torneo recuerda al héroe inmortal cuyo corazón bondadoso salvó el universo."
    ],
    "movieIds": [
      "sp3"
    ]
  }
];
