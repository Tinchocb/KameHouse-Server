import type { LoreGlossaryTerm } from './types';

/**
 * Glosario de términos canónicos.
 *
 * Regla editorial: solo hechos que se ven o se dicen en la obra (manga/anime) o en
 * material oficial identificable. Las citas nombran la obra o el libro, nunca
 * números de página que no se hayan verificado contra el ejemplar.
 */
export const LORE_GLOSSARY_TERMS: Record<string, LoreGlossaryTerm> = {
  mafuba: {
    key: 'mafuba',
    term: 'Mafūba',
    kanji: '魔封波',
    romaji: 'Mafūba',
    category: 'técnica',
    shortDefinition: 'Técnica de sellado que encierra al objetivo dentro de un recipiente.',
    detailedContext:
      'Creada por Mutaito para encerrar a Piccolo Daimaō en una olla arrocera eléctrica. Consume tanta energía vital que su ejecutor suele morir: así cayeron Mutaito y, décadas después, el Maestro Roshi al intentarla contra Piccolo Daimaō.',
    sourceCitation: 'Dragon Ball (manga) · Saga de Piccolo Daimaō',
  },

  zenkai: {
    key: 'zenkai',
    term: 'Zenkai',
    kanji: '全快',
    romaji: 'Zenkai',
    category: 'concepto-ki',
    shortDefinition: 'Rasgo saiyajin: su poder crece de forma notable tras recuperarse de heridas graves.',
    detailedContext:
      'Vegeta lo explica en Namek y lo explota a propósito haciéndose herir para volver más fuerte tras curarse. El término «zenkai» (recuperación completa) es el que usan los fans y las guías para nombrar el fenómeno.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de Freezer',
  },

  'celulas-s': {
    key: 'celulas-s',
    term: 'Células S',
    kanji: 'S細胞',
    romaji: 'Esu saibō',
    category: 'concepto-ki',
    shortDefinition: 'Células de los Saiyajin vinculadas a la capacidad de volverse Super Saiyajin.',
    detailedContext:
      'Concepto introducido por Akira Toriyama en la era de Dragon Ball Super, posterior a la obra original. Los Saiyajin de carácter sereno las acumulan con más facilidad; la transformación se dispara al sumar una cantidad suficiente a un estallido emocional. No se usa en el manga original para explicar sus transformaciones.',
    sourceCitation: 'Akira Toriyama · Declaraciones de la era Dragon Ball Super (2018)',
  },

  'kachi-katchin': {
    key: 'kachi-katchin',
    term: 'Kachi Katchin',
    kanji: 'カッチン鋼',
    romaji: 'Katchin-kō',
    category: 'objeto',
    shortDefinition: 'El metal más duro del universo.',
    detailedContext:
      'En el planeta de los Kaiōshin se usa un bloque de este metal para probar la Espada Z: la espada se parte al golpearlo, lo que libera al Rō Kaiōshin sellado en su interior.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de Majin Buu',
  },

  'kaio-ken': {
    key: 'kaio-ken',
    term: 'Kaio-ken',
    kanji: '界王拳',
    romaji: 'Kaiōken',
    category: 'técnica',
    shortDefinition: 'Técnica de Kaio del Norte que multiplica de golpe la fuerza y la velocidad.',
    detailedContext:
      'Goku la aprende en el planeta de Kaio. Forzar el multiplicador más allá de lo que el cuerpo tolera lo daña gravemente, como le ocurre al usarla contra Vegeta.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de los Saiyajin',
  },

  'shunkan-ido': {
    key: 'shunkan-ido',
    term: 'Teletransportación (Shunkan Idō)',
    kanji: '瞬間移動',
    romaji: 'Shunkan Idō',
    category: 'técnica',
    shortDefinition: 'Técnica de desplazamiento instantáneo que Goku aprendió en el planeta Yardrat.',
    detailedContext:
      'No depende de la velocidad: Goku necesita percibir el ki de alguien en el destino para fijar el salto. Si no hay un ki reconocible, no puede usarla.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de los Androides',
  },

  senzu: {
    key: 'senzu',
    term: 'Semillas del Ermitaño (Senzu)',
    kanji: '仙豆',
    romaji: 'Senzu',
    category: 'objeto',
    shortDefinition: 'Semillas que cultiva Karin: una sola cura las heridas y restaura la energía.',
    detailedContext:
      'Una semilla alimenta durante diez días. Cura heridas y agotamiento, pero no enfermedades: por eso no sirve contra el virus del corazón de Goku.',
    sourceCitation: 'Dragon Ball (manga) · Torre de Karin',
  },

  'radar-del-dragon': {
    key: 'radar-del-dragon',
    term: 'Radar del Dragón',
    kanji: 'ドラゴンレーダー',
    romaji: 'Doragon Rēdā',
    category: 'objeto',
    shortDefinition: 'Dispositivo que inventó Bulma para localizar las Esferas del Dragón.',
    detailedContext:
      'Detecta la débil onda electromagnética que emiten las esferas. Mientras están convertidas en piedra, durante el año posterior a un deseo, no hay señal que rastrear.',
    sourceCitation: 'Dragon Ball (manga) · Capítulo 1',
  },

  kintoun: {
    key: 'kintoun',
    term: 'Nube Voladora (Kintōun)',
    kanji: '筋斗雲',
    romaji: 'Kintōun',
    category: 'objeto',
    shortDefinition: 'Nube que solo pueden montar quienes tienen el corazón puro.',
    detailedContext:
      'El Maestro Roshi se la regala a Goku por haber rescatado a su tortuga. Quien tiene malas intenciones la atraviesa y cae.',
    sourceCitation: 'Dragon Ball (manga) · Saga de Pilaf',
  },

  potara: {
    key: 'potara',
    term: 'Pendientes Pothala (Potara)',
    kanji: 'ポタラ',
    romaji: 'Potara',
    category: 'objeto',
    shortDefinition: 'Pendientes de los Kaiōshin que fusionan a quienes los usan.',
    detailedContext:
      'En Z, el Rō Kaiōshin presenta la fusión como irreversible: así nace Vegetto. Dragon Ball Super establece después que, entre seres que no son Kaiōshin, la fusión dura una hora.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de Majin Buu / Dragon Ball Super',
  },

  'genki-dama': {
    key: 'genki-dama',
    term: 'Genki-dama',
    kanji: '元気玉',
    romaji: 'Genki-dama',
    category: 'técnica',
    shortDefinition: 'Técnica de Kaio del Norte que reúne energía cedida por los seres vivos.',
    detailedContext:
      'Goku la aprende en el planeta de Kaio. Necesita tiempo para cargarse y depende de la energía que otros ceden; contra Majin Buu solo funciona cuando la gente de la Tierra acepta colaborar.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de los Saiyajin',
  },

  kamehameha: {
    key: 'kamehameha',
    term: 'Kamehameha',
    kanji: 'かめはめ波',
    romaji: 'Kamehameha',
    category: 'técnica',
    shortDefinition: 'Técnica insignia de la Escuela Tortuga que concentra la energía latente del cuerpo en las palmas.',
    detailedContext:
      'Creada por el Maestro Roshi tras 50 años de entrenamiento ininterrumpido. Goku la copió a la primera tras verla una sola vez en la Montaña de Fuego, convirtiéndola en su ataque más icónico y versátil.',
    sourceCitation: 'Dragon Ball (manga) · Saga de Pilaf',
  },

  makankosappo: {
    key: 'makankosappo',
    term: 'Makankōsappō',
    kanji: '魔貫光殺砲',
    romaji: 'Makankōsappō',
    category: 'técnica',
    shortDefinition: 'Rayo perforador en espiral inventado por Piccolo para atravesar defensas impenetrables.',
    detailedContext:
      'Piccolo la desarrolló en secreto durante los cinco años posteriores al 23° Torneo para matar a Goku. La usó para eliminar a Raditz a costa del sacrificio heroico de Goku.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga Saiyajin',
  },

  kikoho: {
    key: 'kikoho',
    term: 'Kikōhō',
    kanji: '気功砲',
    romaji: 'Kikōhō',
    category: 'técnica',
    shortDefinition: 'Técnica destructiva de la Escuela Grulla que consume la propia fuerza vital del usuario.',
    detailedContext:
      'Formando un rombo con las manos, dispara una explosión masiva con gran poder de impacto que crea cráteres cuadrangulares. Su uso excesivo puede causar la muerte inmediata, como le ocurrió a Tenshinhan contra Nappa.',
    sourceCitation: 'Dragon Ball (manga) · Saga del 22° Torneo',
  },

  dodonpa: {
    key: 'dodonpa',
    term: 'Dodonpa',
    kanji: 'どどん波',
    romaji: 'Dodonpa',
    category: 'técnica',
    shortDefinition: 'Rayo concentrado disparado desde la punta del dedo índice, firma de la Escuela Grulla.',
    detailedContext:
      'Creado por el maestro Tsuru y perfeccionado por el asesino Tao Pai Pai. A diferencia del Kamehameha no requiere tiempo prolongado de carga y su haz fino busca perforar órganos vitales.',
    sourceCitation: 'Dragon Ball (manga) · Saga de la Patrulla Roja',
  },

  ozaru: {
    key: 'ozaru',
    term: 'Ōzaru (Gran Mono)',
    kanji: '大猿',
    romaji: 'Ōzaru',
    category: 'concepto-ki',
    shortDefinition: 'Metamorfosis saiyajin que multiplica el poder por diez ante la luna llena.',
    detailedContext:
      'Ocurre cuando los ojos de un saiyajin con cola absorben 17 millones de zenos de rayos Blutz reflejados por la luna llena. Los saiyajin de élite como Vegeta mantienen el raciocinio intacto, mientras que los de clase baja pierden el control.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga Saiyajin',
  },

  'super-saiyajin': {
    key: 'super-saiyajin',
    term: 'Super Saiyajin',
    kanji: '超サイヤ人',
    romaji: 'Sūpā Saiyajin',
    category: 'concepto-ki',
    shortDefinition: 'Transformación legendaria de los Saiyajin caracterizada por aura dorada y ojos esmeralda.',
    detailedContext:
      'Multiplica el poder base por cincuenta. Goku la despertó en Namek tras el asesinato de Krilin a manos de Freezer, rompiendo un mito de mil años de antigüedad en el universo.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de Freezer',
  },

  'ultra-instinto': {
    key: 'ultra-instinto',
    term: 'Ultra Instinto (Migatte no Gokui)',
    kanji: '身勝手の極意',
    romaji: 'Migatte no Gokui',
    category: 'concepto-ki',
    shortDefinition: 'Estado divino donde el cuerpo reacciona y combate sin necesidad del pensamiento consciente.',
    detailedContext:
      'Técnica suprema de los Ángeles. Goku la desató durante el Torneo del Poder al colapsar dentro de su propia Genkidama, rompiendo la cáscara de su potencial interior.',
    sourceCitation: 'Dragon Ball Super · Saga del Torneo del Poder',
  },

  nyoibo: {
    key: 'nyoibo',
    term: 'Báculo Sagrado (Nyoibō)',
    kanji: '如意棒',
    romaji: 'Nyoibō',
    category: 'objeto',
    shortDefinition: 'Báculo mágico indestructible que se alarga y encoge a voluntad del portador.',
    detailedContext:
      'Kamisama lo talló para conectar la cima de la Torre Karin con el Templo Sagrado en las alturas del cielo. Goku lo usó en su infancia y regresa como su arma primordial en Dragon Ball Daima.',
    sourceCitation: 'Dragon Ball (manga) · Torre de Karin / Dragon Ball Daima',
  },

  'sala-del-tiempo': {
    key: 'sala-del-tiempo',
    term: 'Sala del Espíritu y el Tiempo',
    kanji: '精神と時の部屋',
    romaji: 'Seishin to Toki no Heya',
    category: 'lugar',
    shortDefinition: 'Dimensión paralela en el Templo Sagrado donde un año entero equivale a un solo día en el exterior.',
    detailedContext:
      'Posee gravedad diez veces superior a la Tierra, temperaturas que fluctúan entre -40°C y 50°C y aire enrarecido. Clave en los entrenamientos de los Guerreros Z antes de los Juegos de Cell y en la saga de Majin Buu.',
    sourceCitation: 'Dragon Ball Z (manga) · Saga de Cell',
  },

  'esferas-del-dragon': {
    key: 'esferas-del-dragon',
    term: 'Esferas del Dragón',
    kanji: 'ドラゴンボール',
    romaji: 'Doragon Bōru',
    category: 'objeto',
    shortDefinition: 'Siete orbes translúcidos con estrellas que, al reunirse, invocan a un dragón sagrado que cumple deseos.',
    detailedContext:
      'Creadas por Kamisama (las terrestres) y el Gran Patriarca (las de Namek). Tras cumplir un deseo se convierten en piedra durante un año y se dispersan por todo el planeta.',
    sourceCitation: 'Dragon Ball (manga) · Saga de Pilaf',
  },

  'anillo-del-tiempo': {
    key: 'anillo-del-tiempo',
    term: 'Anillo del Tiempo',
    kanji: '時の指輪',
    romaji: 'Toki no Yubiwa',
    category: 'objeto',
    shortDefinition: 'Reliquia sagrada custodiada por los Supremos Kaiōshin para observar futuros alternativos.',
    detailedContext:
      'Solo permite viajar hacia el futuro y regresar al presente, impidiendo viajar al pasado para no crear paradojas. Cada vez que alguien crea una nueva línea temporal mediante viajes no autorizados, nace un nuevo anillo de color verde.',
    sourceCitation: 'Dragon Ball Super · Saga de Goku Black',
  },
};
