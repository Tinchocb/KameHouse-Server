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
};
