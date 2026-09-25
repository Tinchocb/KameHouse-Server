import type { LoreArtifact } from './types';

/**
 * Artefactos canónicos. Misma regla editorial que el glosario: la cita nombra la
 * obra o el libro, sin números de página ni de capítulo que no se hayan verificado.
 */
export const LORE_ARTIFACTS: Record<string, LoreArtifact> = {
  'semillas-del-ermitano': {
    id: 'semillas-del-ermitano',
    name: 'Semillas del Ermitaño',
    japaneseName: '仙豆 (Senzu)',
    category: 'místico',
    creator: 'Maestro Karin (Torre de Karin)',
    firstAppearance: {
      episodeOrChapter: 'Dragon Ball · Saga de Piccolo Daimaō',
      context: 'Karin las cultiva en su torre y se vuelven el recurso de curación de los guerreros.',
    },
    rulesAndLimitations: [
      'Una semilla alimenta durante diez días.',
      'Cura heridas y agotamiento de forma casi instantánea.',
      'No cura enfermedades: no sirve contra el virus del corazón de Goku.',
      'Karin tiene una cantidad limitada; quedarse sin semillas es un problema recurrente.',
    ],
    cosmicSignificance:
      'Sostienen a los guerreros en Namek, en los Juegos de Cell y en la saga de Majin Buu.',
    source: {
      source: 'manga',
      bookOrArticle: 'Dragon Ball / Dragon Ball Z (manga)',
    },
  },

  'radar-del-dragon': {
    id: 'radar-del-dragon',
    name: 'Radar del Dragón',
    japaneseName: 'ドラゴンレーダー (Dragon Radar)',
    category: 'tecnología',
    creator: 'Bulma (Capsule Corporation)',
    firstAppearance: {
      ageYear: 749,
      episodeOrChapter: 'Dragon Ball · Capítulo 1',
      context: 'Bulma, de 16 años, sale a buscar las esferas con el radar que construyó.',
    },
    rulesAndLimitations: [
      'Detecta la débil onda electromagnética que emiten las esferas.',
      'Durante el año posterior a un deseo las esferas son piedra y no hay señal.',
      'Bulma arma versiones nuevas para otros juegos de esferas, como las de Namek.',
    ],
    cosmicSignificance: 'Sin el radar no empieza la historia: es lo que lleva a Bulma hasta Goku.',
    source: {
      source: 'manga',
      bookOrArticle: 'Dragon Ball (manga)',
    },
  },

  'nube-voladora': {
    id: 'nube-voladora',
    name: 'Nube Voladora (Kintōun)',
    japaneseName: '筋斗雲 (Kintōun)',
    category: 'místico',
    creator: 'Desconocido (Goku la recibe del Maestro Roshi)',
    firstAppearance: {
      ageYear: 749,
      episodeOrChapter: 'Dragon Ball · Saga de Pilaf',
      context: 'El Maestro Roshi se la regala a Goku por rescatar a su tortuga.',
    },
    rulesAndLimitations: [
      'Solo pueden montarla quienes tienen el corazón puro.',
      'Puede destruirse con un ataque, como hace Tao Pai Pai durante la saga del Ejército Red Ribbon.',
    ],
    cosmicSignificance: 'Es el medio de transporte de Goku en su infancia y luego pasa a Gohan y Goten.',
    source: {
      source: 'manga',
      bookOrArticle: 'Dragon Ball (manga)',
    },
  },

  'pendientes-pothala': {
    id: 'pendientes-pothala',
    name: 'Pendientes Pothala',
    japaneseName: 'ポタラ (Potara)',
    category: 'divino',
    creator: 'Kaiōshin',
    firstAppearance: {
      ageYear: 774,
      episodeOrChapter: 'Dragon Ball Z · Saga de Majin Buu',
      context: 'El Rō Kaiōshin se los da a Goku para fusionarse y enfrentar a Majin Buu.',
    },
    rulesAndLimitations: [
      'Dos personas se ponen un pendiente cada una, en orejas opuestas, y se fusionan al instante.',
      'En Z el Rō Kaiōshin presenta la fusión como irreversible.',
      'Dragon Ball Super establece que entre seres que no son Kaiōshin la fusión dura una hora.',
    ],
    cosmicSignificance: 'Es el origen de Vegetto.',
    source: {
      source: 'manga',
      bookOrArticle: 'Dragon Ball Z (manga) / Dragon Ball Super',
    },
  },

  'camara-de-gravedad': {
    id: 'camara-de-gravedad',
    name: 'Cámara de Gravedad',
    japaneseName: '重力室 (Jūryoku-shitsu)',
    category: 'tecnología',
    creator: 'Dr. Brief (Capsule Corporation)',
    firstAppearance: {
      ageYear: 762,
      episodeOrChapter: 'Dragon Ball Z · Saga de Freezer',
      context: 'Viene instalada en la nave con la que Goku viaja a Namek.',
    },
    rulesAndLimitations: [
      'Goku entrena en la nave hasta 100 veces la gravedad de la Tierra.',
      'Vegeta usa después una cámara en Capsule Corp para entrenar antes de los Androides.',
    ],
    cosmicSignificance:
      'Explica el salto de poder con el que Goku llega a Namek y frena a las Fuerzas Especiales Ginyu.',
    source: {
      source: 'manga',
      bookOrArticle: 'Dragon Ball Z (manga)',
    },
  },
};
