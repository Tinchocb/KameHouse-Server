export interface TimeJump {
  id: string;
  beforeVolumeId: string;
  gapLabel: string;
  title: string;
  description: string;
  kind: 'time-jump' | 'context';
}

export const TIME_JUMPS: TimeJump[] = [
  {
    id: 'tj-torneo-22',
    beforeVolumeId: 'db-torneo-22',
    gapLabel: '+3 años de entrenamiento',
    title: '3 Años de Entrenamiento Solitario',
    description: 'Tras la primera dispersión de las Esferas, Son Goku recorre el globo terráqueo a pie para perfeccionar su cuerpo antes de reencontrarse con Krillin y el Maestro Roshi.',
    kind: 'time-jump',
  },
  {
    id: 'tj-saiyajin-raditz',
    beforeVolumeId: 'dbz-saiyajin-raditz',
    gapLabel: '+5 años de paz, nace Gohan',
    title: '5 Años de Paz y el Nacimiento de Gohan',
    description: 'Goku vence a Piccolo Jr. en el 23° Torneo y contrae matrimonio con Milk en la Montaña Paoz. Nace Son Gohan. El mundo vive en ignorancia total de las amenazas interestelares.',
    kind: 'time-jump',
  },
  {
    id: 'tj-garlic-jr',
    beforeVolumeId: 'dbz-garlic-jr',
    gapLabel: 'Regreso de Namek (762→764)',
    title: 'Regreso de Namek y la Espera de Goku',
    description: 'Namek es destruido y los refugiados esperan en la Tierra. Tras un año, reviven a Krillin y Yamcha con las esferas namekianas mientras Goku entrena en Yardrat.',
    kind: 'time-jump',
  },
  {
    id: 'tj-buu-majin-vegeta',
    beforeVolumeId: 'dbz-buu-majin-vegeta',
    gapLabel: '+7 años de paz, nace Goten',
    title: '7 Años de Paz y el Sacrificio de Goku',
    description: 'Goku decide no resucitar para no atraer más amenazas a la Tierra. Nace Goten; Gohan ingresa a la preparatoria Orange Star asumiendo la máscara del Gran Saiyaman.',
    kind: 'time-jump',
  },
  {
    id: 'tj-daima-conspiracion',
    beforeVolumeId: 'db-daima-conspiracion',
    gapLabel: 'Contexto Temporal',
    title: 'Daima en la Cronología de Z',
    description: 'Daima ocurre justo después de Kid Buu (año 774), dentro del salto de 10 años previo al epílogo de Dragon Ball Z.',
    kind: 'context',
  },
  {
    id: 'tj-batalla-dioses',
    beforeVolumeId: 'dbs-batalla-dioses',
    gapLabel: '+3 años, despierta Beerus',
    title: 'El Despertar del Dios de la Destrucción',
    description: 'La Tierra borra con las Esferas el recuerdo colectivo de Majin Buu. Mientras tanto, en los confines del Universo 7, Lord Beerus despierta tras 39 años de letargo divino.',
    kind: 'time-jump',
  },
  {
    id: 'tj-black-star',
    beforeVolumeId: 'dbgt-black-star',
    gapLabel: '+9 años',
    title: 'El Epílogo de Z y el Gran Tour',
    description: 'El epílogo de Dragon Ball Z (Año 784, 28° Torneo y la partida de Goku con Uub) cae en este intervalo (780→789). En el Año 789 inicia el viaje de las Esferas de Estrella Negra.',
    kind: 'time-jump',
  },
];
