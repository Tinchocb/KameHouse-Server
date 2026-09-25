import type { MultiverseTimeline } from './types';

/**
 * Líneas temporales de la saga de los Androides y Cell, tal como las cuenta el manga.
 * Viajar al pasado no reescribe la historia de origen: crea una línea paralela.
 */
export const MULTIVERSE_TIMELINES: MultiverseTimeline[] = [
  {
    id: 1,
    designation: 'El futuro de Trunks',
    description:
      'Goku muere por el virus del corazón. Los Androides 17 y 18 aparecen y matan a los guerreros; Gohan sobrevive, entrena a Trunks y muere años después.',
    divergenceEvent:
      'Bulma construye una máquina del tiempo y Trunks viaja al pasado para llevarle a Goku la medicina y avisar de los Androides.',
    keySurvivors: ['Trunks del Futuro', 'Bulma del Futuro'],
    statusAtEnd:
      'Al volver, Trunks destruye a 17 y 18 y más tarde elimina a Cell antes de que pueda completarse.',
    source: 'Dragon Ball Z (manga) · Sagas de los Androides y Cell',
  },
  {
    id: 2,
    designation: 'La línea principal',
    description:
      'Trunks llega en el año 764, derrota a Freezer y al Rey Cold, y le entrega a Goku la medicina. Goku sobrevive al virus y los guerreros se preparan para los Androides.',
    divergenceEvent: 'La llegada de Trunks del Futuro en el año 764.',
    keySurvivors: ['Goku', 'Gohan', 'Vegeta', 'Piccolo', 'Krilin'],
    statusAtEnd:
      'Gohan derrota a Cell en los Juegos de Cell del año 767. Esta es la línea que continúa en las sagas de Majin Buu y posteriores.',
    source: 'Dragon Ball Z (manga) · Sagas de los Androides y Cell',
  },
  {
    id: 3,
    designation: 'El futuro del que viene Cell',
    description:
      'Una línea en la que Trunks ya destruyó a los Androides 17 y 18, lo que deja a Cell sin forma de completarse.',
    divergenceEvent:
      'Cell mata a Trunks, le roba la máquina del tiempo y viaja al pasado de la línea principal, donde espera oculto como larva.',
    keySurvivors: ['Se desconoce'],
    statusAtEnd:
      'En la línea principal, Bulma y Trunks encuentran después la máquina abandonada de Cell, la pista que revela su origen.',
    source: 'Dragon Ball Z (manga) · Saga de Cell',
  },
];
