import { GlossaryTerm } from '../types';

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'super-saiyan',
    term: 'Super Saiyajin (Super Saiyan)',
    originalJapanese: '超サイヤ人 (Sūpā Saiya-jin)',
    category: 'Biología & Razas',
    categoryColor: '#fbbf24',
    shortDefinition: 'Transformación genética legendaria de la raza Saiyajin que multiplica por 50 el poder base al romper la barrera de Ki mediante una explosión de cólera pura.',
    deepLore: 'Durante milenios considerada un mito del Universo 7, la transformación requiere una acumulación suficiente de "Células S" combinada con un detonante emocional extremo. En el Planeta Namek (Año 762), el asesinato de Krillin por Freezer provocó que Son Goku quebrara el límite evolutivo, tiñendo su cabello de dorado brillante y sus pupilas de esmeralda ante la mirada atónita del tirano espacial.',
    canonicalRules: [
      'Multiplicador oficial: x50 sobre el poder de combate base en su primer grado.',
      'Requiere un umbral elevado de Células S, las cuales proliferan en corazones calmos y entornos con gravedad alta.',
      'El estado inicial provoca una agitación psicológica que incrementa la hostilidad y agresividad.',
      'Variantes perfeccionadas (Full Power) logran mantener la forma como estado natural de reposo sin desgaste de estamina.'
    ],
    associatedVolumeIds: ['dbz-freezer-super-saiyajin', 'dbz-juegos-de-cell', 'dbz-buu-majin-vegeta'],
    keyQuote: '«Soy el guerrero de la leyenda que ha despertado por la furia... ¡Soy el Super Saiyajin Son Goku!»'
  },
  {
    id: 'namekian-physiology',
    term: 'Fisiología Namekiana (Namekian Physiology)',
    originalJapanese: 'ナメック星人の生理 (Namekku-seijin no Seiri)',
    category: 'Biología & Razas',
    categoryColor: '#10b981',
    shortDefinition: 'Biología hermafrodita no carnívora del pueblo de Namek, basada en la hidratación pura, reproducción clonal por huevos y capacidad celular de regeneración y asimilación espiritual.',
    deepLore: 'Los Namekianos solo requieren agua para mantener su metabolismo orgánico. Se dividen en dos clanes biológicos: la Casta Guerrera (como Piccolo o Nail, de inmenso potencial marcial) y el Clan Dragón (como Kami-sama o Dende, dotados con la facultad mística de manipular la materia y crear las Esferas del Dragón). Su habilidad más formidable es la "Fusión Asimilativa", donde un individuo cede su cuerpo y espíritu para engrosar de forma permanente la conciencia y fuerza del receptor.',
    canonicalRules: [
      'Regeneración de extremidades y tejidos siempre que el núcleo cerebral no sufra daño fatal.',
      'Audición ultrasensible con antenas craneales capaces de captar frecuencias planetarias.',
      'Elasticidad muscular extrema para extender extremidades en combate.',
      'Fusión Asimilativa: Proceso irreversible donde dos almas se unifican manteniendo una sola identidad base.'
    ],
    associatedVolumeIds: ['db-piccolo-daimaku', 'dbz-namek-viaje', 'dbz-androides-trunks'],
    keyQuote: '«No soy ni Kami-sama ni Piccolo... Soy el Namekiano que ha olvidado su propio nombre.»'
  },
  {
    id: 'temporal-ring',
    term: 'Anillo del Tiempo (Time Ring)',
    originalJapanese: '時の指輪 (Toki no Yubiwa)',
    category: 'Mecánicas Temporales',
    categoryColor: '#14b8a6',
    shortDefinition: 'Artefactos sagrados custodiados por los Supremos Kaio-shin que permiten viajar al futuro sin alterar la continuidad temporal ni generar paradojas.',
    deepLore: 'Solo los Kaio-shin autorizados pueden portar estos anillos. El anillo plateado maestro representa la línea temporal principal, mientras que cada anillo verde adicional que descansa en la caja del Reino Sagrado es el testimonio directo de un pecado mortal: una bifurcación histórica creada cada vez que alguien viajó al pasado y modificó los acontecimientos (como los viajes de Trunks del Futuro y Cell).',
    canonicalRules: [
      'Solo pueden ser utilizados por o en presencia de un Kaio-shin portador de pendientes Potara oficiales.',
      'Permiten avanzar al futuro y regresar al presente exacto de partida; viajar al pasado está terminantemente prohibido por la ley cósmica.',
      'Cada viaje al pasado de una máquina mortal materializa instantáneamente un nuevo anillo verde en la caja sagrada.',
      'Goku Black utilizó el anillo de Gowasu para perseguir a Trunks a través de las grietas dimensionales.'
    ],
    associatedVolumeIds: ['dbz-androides-trunks', 'dbs-goku-black'],
    keyQuote: '«Un nuevo anillo verde ha nacido en el cofre... significa que alguien en el cosmos ha cometido el pecado de fracturar el tiempo.»'
  },
  {
    id: 'ki-divino',
    term: 'Ki Divino (Godly Ki)',
    originalJapanese: '神の気 (Kami no Ki)',
    category: 'Divinidad & Ki',
    categoryColor: '#06b6d4',
    shortDefinition: 'Energía espiritual densa de nivel divino que no se dispersa hacia el exterior y resulta completamente imperceptible para los sentidos de seres mortales ordinarios.',
    deepLore: 'A diferencia del Ki mortal que se proyecta como una llamarada ardiente con fugas constantes de presión, el Ki Divino se sella en lo más profundo del interior del cuerpo. Un mortal solo puede percibirlo indirectamente por la abrumadora presión física o si aprende a controlar el flujo interno de su propia energía bajo la tutela de un Dios de la Destrucción o un Ángel.',
    canonicalRules: [
      'Infranqueable e invisible para los rastreadores tecnológicos y el sentido sensorial de Ki común.',
      'Se alcanza mediante el ritual de los seis Saiyajins de corazón puro o entrenamiento celestial con un Ángel.',
      'Exige un control milimétrico de la mente para impedir que el aura se escape del cuerpo.',
      'Permite acceder a estados como Super Saiyan God (rojo) y Super Saiyan Blue (azul).'
    ],
    associatedVolumeIds: ['dbs-batalla-dioses', 'dbs-torneo-del-poder'],
    keyQuote: '«No puedo sentir la energía de Goku... y sin embargo, siento que la gravedad del universo entero está sobre nosotros.»'
  },
  {
    id: 'potara-vs-metamor',
    term: 'Fusiones: Potara vs Danza Metamor',
    originalJapanese: 'ポタラとメタモル星人の合体 (Potara to Metamoru-seijin no Gattai)',
    category: 'Técnicas & Fusiones',
    categoryColor: '#a855f7',
    shortDefinition: 'Las dos metodologías canónicas para combinar a dos guerreros en un solo ente trascendente con poder superior a la suma multiplicada de ambos.',
    deepLore: 'La Danza Metamor requiere que ambos combatientes posean estaturas similares y sincronicen su Ki en una danza simétrica perfecta de 30 minutos (dando origen a Gogeta o Gotenks). En contraste, los Pendientes Potara de los Kaio-shin unen a los usuarios simplemente colocándolos en orejas opuestas: para divinidades la unión es eterna, mientras que para los mortales dura exactamente 1 hora (dando origen a Vegetto).',
    canonicalRules: [
      'Danza Metamor: 30 minutos de duración; error de postura produce versiones fallidas (obeso o esquelético).',
      'Pendientes Potara: Fusión instantánea; consumo masivo de Ki acorta prematuramente el límite de 1 hora en mortales.',
      'La personalidad resultante no es una copia de ninguno, sino una nueva conciencia con vestimenta mixta.',
      'El poder resultante no es aditivo (A + B), sino un multiplicador astronómico sobre el máximo de ambos.'
    ],
    associatedVolumeIds: ['dbz-buu-majin-vegeta', 'dbs-torneo-del-poder'],
    keyQuote: '«Cuando dos personas usan estos pendientes, el resultado es mucho más que la suma de sus poderes... ¡Es un guerrero absoluto!»'
  },
  {
    id: 'habitacion-del-tiempo',
    term: 'Habitación del Tiempo (Hyperbolic Time Chamber)',
    originalJapanese: '精神と時の部屋 (Seishin to Toki no Heya)',
    category: 'Mecánicas Temporales',
    categoryColor: '#eab308',
    shortDefinition: 'Dimensión de bolsillo situada en el Palacio de Kami-sama donde 1 año entero en su interior transcurre en tan solo 1 día en el mundo exterior.',
    deepLore: 'Con una atmósfera de aire enrarecido de baja densidad, temperaturas fluctuantes entre -40°C y 50°C, y una gravedad 10 veces superior a la de la Tierra, el Salón del Espíritu y el Tiempo representa un abismo blanco infinito que pone a prueba la salud mental y resistencia física extrema de cualquier guerrero.',
    canonicalRules: [
      'Tasa de compresión temporal: 365 días interiores equivalen a 24 horas del calendario terrestre exterior.',
      'Capacidad límite tradicional: Máximo 2 personas simultáneas y un límite estricto de 2 días de estancia por vida para mortales.',
      'Atmósfera con un cuarto del oxígeno terrestre y vacío sensorial blanco que puede quebrar la cordura.',
      'Grito dimensional: Un guerrero con Ki colosal (como Gotenks SSJ3 o Super Buu) puede rasgar el tejido espaciotemporal para escapar.'
    ],
    associatedVolumeIds: ['dbz-androides-trunks', 'dbz-juegos-de-cell', 'dbz-buu-majin-vegeta'],
    keyQuote: '«Allí dentro no hay nada excepto aire denso, gravedad diez veces mayor y un vacío blanco sin fin. Un año allá es un solo día aquí afuera.»'
  },
  {
    id: 's-cells',
    term: 'Células S (S-Cells)',
    originalJapanese: 'S細胞 (Esu Saibō)',
    category: 'Biología & Razas',
    categoryColor: '#f97316',
    shortDefinition: 'Organelas microscópicas presentes en la sangre Saiyajin descritas canónicamente por Akira Toriyama, responsables directas de permitir el acceso al Super Saiyajin.',
    deepLore: 'La mayoría de Saiyajins del extinto Planeta Vegeta poseían muy pocas Células S debido a su estilo de vida violento, despiadado y bélico. Para multiplicar las Células S se requieren dos condiciones complementarias: un espíritu apacible y sereno, y un poder de combate base adecuadamente entrenado. Por ello, los descendientes híbridos criados en la Tierra pacífica (Gohan, Goten y Trunks) nacieron con una densidad desorbitada de Células S.',
    canonicalRules: [
      'Un entorno pacífico y un corazón noble multiplican exponencialmente el conteo de Células S.',
      'Son heredables genéticamente: los hijos conciben mayor facilidad de transformación si el progenitor ya poseía un recuento elevado.',
      'Una explosión de furia desencadena la combustión de estas células, manifestando el aura dorada.',
      'Explica por qué Goten y Trunks lograron transformarse a temprana edad sin traumas de combate severos.'
    ],
    associatedVolumeIds: ['dbz-saiyajin-vegeta', 'dbz-namek-viaje', 'dbz-juegos-de-cell'],
    keyQuote: '«Tener un espíritu amable es la mejor manera de aumentar tus Células S... pero para detonarlas necesitas el detonante de la ira.»'
  },
  {
    id: 'zenkai-power',
    term: 'Poder Zenkai (Saiyan Near-Death Power)',
    originalJapanese: 'サイヤ人の死線復活 (Saiya-jin no Shisen Fukkatsu)',
    category: 'Biología & Razas',
    categoryColor: '#ef4444',
    shortDefinition: 'Mecanismo biológico genético adaptativo por el cual un Saiyajin incrementa drásticamente su fuerza física y Ki tras sobrevivir a heridas que lo colocaron al borde de la muerte.',
    deepLore: 'Este rasgo evolutivo permitió a los Saiyajins convertirse en la especie depredadora definitiva del Universo 7. Las células del cuerpo analizan el trauma recibido y mutan para que el organismo no vuelva a ser vulnerable a esa escala de daño. Durante la invasión a Namek, Vegeta y Goku explotaron conscientemente este mecanismo para reducir la colosal brecha que los separaba de la Fuerza Ginyu y Freezer.',
    canonicalRules: [
      'Solo se activa si el individuo sobrevive de forma natural o es curado mediante tecnología médica o Semillas Senzu.',
      'El daño infligido por propia mano no produce el mismo incremento adaptativo biológico.',
      'El incremento pierde relevancia a medida que el Saiyajin alcanza los estados divinos, donde el cuerpo ya roza el límite orgánico.',
      'Cell heredó este rasgo gracias a sus células Saiyajin, regenerándose en su forma Super Perfecta tras autodestruirse.'
    ],
    associatedVolumeIds: ['dbz-saiyajin-vegeta', 'dbz-namek-viaje', 'dbz-juegos-de-cell'],
    keyQuote: '«Cada vez que un Saiyajin roza las puertas de la muerte y regresa, su poder se multiplica monstruosamente.»'
  },
  {
    id: 'multiverse-branches',
    term: 'Líneas Temporales Multiversales',
    originalJapanese: '多元時間軸 (Tagen Jikan-jiku)',
    category: 'Mecánicas Temporales',
    categoryColor: '#2dd4bf',
    shortDefinition: 'Estructura cosmológica donde cada viaje al pasado no altera la historia original, sino que bifurca el flujo cuántico creando un universo paralelo independiente.',
    deepLore: 'En Dragon Ball, el principio de causalidad no es lineal: cuando Trunks viajó al Año 764 para advertir a Goku sobre los Androides, su futuro devastado no se arregló. Por el contrario, nació la "Línea 1" donde Goku sobrevive con la medicina cardíaca, mientras su "Línea 2" original siguió existiendo en ruinas. La presencia de la máquina de Cell en el subsuelo confirmó la existencia de múltiples ramificaciones simultáneas.',
    canonicalRules: [
      'Paradoja del abuelo imposibilitada: modificar el pasado no reescribe el presente del viajero.',
      'Existen al menos 4 líneas canónicas documentadas por los Anillos del Tiempo de los Kaio-shin.',
      'La máquina de tiempo de Capsule Corp utiliza energía gravitacional cuántica para rasgar el tejido temporal.',
      'Zeno-sama tiene la potestad de erradicar una línea temporal completa si se corrompe (como ocurrió con la Línea de Trunks).'
    ],
    associatedVolumeIds: ['dbz-androides-trunks', 'dbs-goku-black'],
    keyQuote: '«Aunque destruya a los androides aquí, mi mundo allá en el futuro seguirá siendo un infierno... Pero este presente merece tener una oportunidad.»'
  },
  {
    id: 'ultra-instinto',
    term: 'Doctrina Egoísta / Ultra Instinto',
    originalJapanese: '身勝手の極意 (Migatte no Gokui)',
    category: 'Divinidad & Ki',
    categoryColor: '#e0e7ff',
    shortDefinition: 'Estado trascendental propio de los Ángeles donde cada parte del cuerpo piensa, esquiva y ataca de manera autónoma sin intervención del cerebro ni retraso neuronal.',
    deepLore: 'Incluso para los Dioses de la Destrucción, dominar el Migatte no Gokui es una proeza esquiva. Al vaciar por completo la mente de pensamientos, juicios y tensiones de batalla, el flujo de combate se vuelve espontáneo y absoluto. Durante el Torneo del Poder (Año 780), Son Goku superó sus propios límites mortales al chocar contra su propia Genki-dama absorbida, despertando el Ultra Instinto Señal y posteriormente la forma dominada de cabello plateado.',
    canonicalRules: [
      'Elimina por completo el tiempo de reacción neurológico entre estímulo sensorial y movimiento muscular.',
      'Requiere un estado de calma emocional absoluta, contraria a la ira furiosa del Super Saiyajin.',
      'Provoca un desgaste físico y neurológico masivo en un cuerpo mortal si se mantiene más allá de unos minutos.',
      'Whis y los demás Ángeles del Gran Sacerdote mantienen este estado de forma natural e ininterrumpida las 24 horas del día.'
    ],
    associatedVolumeIds: ['dbs-torneo-del-poder'],
    keyQuote: '«El juicio es lento; pensar antes de esquivar te vuelve vulnerable. Deja que cada fibra de tu cuerpo decida por sí misma.»'
  },
  {
    id: 'mafuba',
    term: 'Mafuba (Evil Containment Wave)',
    originalJapanese: '魔封波 (Mafūba)',
    category: 'Técnicas & Fusiones',
    categoryColor: '#84cc16',
    shortDefinition: 'Técnica prohibida creada por el Maestro Mutaito que manipula la energía espiritual para arremolinar a un ser maligno e inmortal y sellarlo en un recipiente hermético con un talismán.',
    deepLore: 'Desarrollada durante la primera invasión de Piccolo Daimaō (Año 461), el Mafuba es una de las pocas armas eficaces contra seres de maldad infinita o inmortales (como Zamasu) a los que no se puede derrotar con fuerza bruta. El costo tradicional de su ejecución es la fuerza vital del usuario, cobrándose la vida de Mutaito y posteriormente del Maestro Roshi cuando intentó detener a Piccolo anciano.',
    canonicalRules: [
      'Requiere un vórtice giratorio de Ki para atrapar al objetivo y dirigirlo con precisión a la boca del recipiente.',
      'El contenedor (termo, vasija, olla) debe cerrarse de inmediato con una tapa y sellarse con un talismán de kanjis sagrados.',
      'Si el usuario carece de suficiente Ki de reserva, la técnica drena su energía vital hasta causarle la muerte.',
      'Un adversario con suficiente destreza puede realizar el "Contra-Mafuba" para revertir la corriente hacia el ejecutante.'
    ],
    associatedVolumeIds: ['db-piccolo-daimaku', 'dbs-goku-black'],
    keyQuote: '«¡Ma-fu-ba! ¡Sella el mal eterno dentro de las tinieblas de este frasco sagrado!»'
  },
  {
    id: 'senzu-beans',
    term: 'Semillas del Ermitaño (Senzu Beans)',
    originalJapanese: '仙豆 (Senzu)',
    category: 'Artefactos Cósmicos',
    categoryColor: '#22c55e',
    shortDefinition: 'Legumbres místicas cultivadas exclusivamente por el Maestro Karin en la cúspide de su Torre Sagrada, capaces de restaurar instantáneamente la energía y sanar cualquier herida mortal.',
    deepLore: 'Una sola semilla provee sustento alimenticio equivalente a diez días de saciedad para un humano común y regenera huesos rotos, laceraciones y Ki agotado en un instante. Sin embargo, no pueden curar enfermedades de origen biológico natural (como el virus del corazón que afectó a Goku en la saga de los Androides).',
    canonicalRules: [
      'Restauración instantánea del 100% de la salud física y energía espiritual al ser ingerida.',
      'Incapaces de restaurar miembros ya cicatrizados ni sanar patologías orgánicas o genéticas.',
      'Tiempo de cosecha prolongado en pequeñas vasijas de barro, lo que limita su disponibilidad en épocas de guerra.',
      'Combinadas con el poder Zenkai Saiyajin, permitieron saltos de poder estratosféricos en períodos mínimos.'
    ],
    associatedVolumeIds: ['db-piccolo-daimaku', 'dbz-saiyajin-raditz', 'dbz-juegos-de-cell'],
    keyQuote: '«Come esto... es una Semilla del Ermitaño. En un segundo todas tus heridas desaparecerán y recuperarás tus fuerzas.»'
  }
];

export const GLOSSARY_CATEGORIES = [
  'Todos',
  'Biología & Razas',
  'Mecánicas Temporales',
  'Divinidad & Ki',
  'Técnicas & Fusiones',
  'Artefactos Cósmicos'
] as const;
