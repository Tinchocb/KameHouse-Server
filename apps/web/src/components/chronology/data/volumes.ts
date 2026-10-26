import { VolumeData } from '../types';
import { SPAN_VOLUMES } from './spansToVolumes';

export const VOLUMES_DATA: VolumeData[] = SPAN_VOLUMES;

/** IDs legacy → span ids (migración de progreso guardado y deep-links). */
export const LEGACY_VOLUME_TO_SPANS: Record<string, string[]> = {
  'vol-clasico-origen': ['db-pilaf-busqueda', 'db-pilaf-castillo', 'db-torneo-21-entrenamiento', 'db-torneo-21-combates'],
  'vol-clasico-redribbon': ['db-rr-coronel-silver', 'db-rr-torre-musculo', 'db-rr-general-blue', 'db-rr-tao-pai-pai', 'db-uranai-baba-guerreros', 'db-uranai-baba-reencuentro'],
  'vol-clasico-piccolo': ['db-torneo-22-entrenamiento', 'db-torneo-22-combates', 'db-piccolo-daimaku-terror', 'db-piccolo-daimaku-climax', 'db-piccolo-jr-templo', 'db-piccolo-jr-torneo-final'],
  'vol-saiyan-choque': ['dbz-saiyajin-raditz', 'dbz-saiyajin-entrenamiento', 'dbz-saiyajin-nappa-vegeta'],
  'vol-freezer-ssj': ['dbz-namek-viaje-llegada', 'dbz-namek-caceria-esferas', 'dbz-namek-fuerzas-ginyu', 'dbz-freezer-transformaciones', 'dbz-freezer-goku-kaioken', 'dbz-freezer-super-saiyajin', 'dbz-garlic-jr'],
  'vol-cell-trunks': ['dbz-androides-trunks', 'dbz-androides-19-20', 'dbz-androides-17-18', 'dbz-cell-imperfecto', 'dbz-cell-semiperfecto'],
  'vol-cell-games': ['dbz-cell-espera-torneo', 'dbz-cell-goku-vs-cell', 'dbz-cell-gohan-ssj2-final', 'dbz-torneo-otro-mundo'],
  'vol-buu-caos': ['dbz-buu-gran-saiyaman', 'dbz-buu-torneo-25', 'dbz-buu-nave-babidi', 'dbz-buu-despertar-sacrificio', 'dbz-buu-ssj3-fusion-dance', 'dbz-buu-super-buu-gotenks', 'dbz-buu-gohan-mistico', 'dbz-buu-vegetto-kidbuu', 'dbz-buu-mundo-en-paz'],
  'vol-daima-reino': ['db-daima-conspiracion', 'db-daima-tercer-mundo', 'db-daima-tamagami', 'db-daima-climax'],
  'vol-super-dioses': ['dbs-dioses-llegada', 'dbs-dioses-batalla', 'dbs-resurreccion-preparacion', 'dbs-resurreccion-dorado'],
  'vol-super-black': ['dbs-torneo-u6-inicio', 'dbs-torneo-u6-hit', 'dbs-copy-vegeta', 'dbs-black-misterio', 'dbs-black-zamasu-guerra', 'dbs-black-epilogo-interludio'],
  'vol-super-torneo': ['dbs-exhibicion-zen', 'dbs-reclutamiento-u7', 'dbs-torneo-poder-caos', 'dbs-torneo-poder-ultra-instinto', 'dbs-torneo-poder-climax'],
  'vol-gt-viaje': ['dbgt-black-star-origen', 'dbgt-black-star-viaje', 'dbgt-baby-invasion', 'dbgt-baby-ssj4', 'dbgt-super-17', 'dbgt-dragones-primeros', 'dbgt-dragones-climax'],
};

