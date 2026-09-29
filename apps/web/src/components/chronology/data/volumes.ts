import { VolumeData } from '../types';
import { SPAN_VOLUMES } from './spansToVolumes';

export const VOLUMES_DATA: VolumeData[] = SPAN_VOLUMES;

/** IDs legacy → span ids (migración de progreso guardado y deep-links). */
export const LEGACY_VOLUME_TO_SPANS: Record<string, string[]> = {
  'vol-clasico-origen': ['db-pilaf', 'db-torneo-21'],
  'vol-clasico-redribbon': ['db-red-ribbon', 'db-uranai-baba'],
  'vol-clasico-piccolo': ['db-torneo-22', 'db-piccolo-daimaku', 'db-piccolo-jr'],
  'vol-saiyan-choque': ['dbz-saiyajin-raditz', 'dbz-saiyajin-vegeta'],
  'vol-freezer-ssj': ['dbz-namek-viaje', 'dbz-namek-ginyu-freezer', 'dbz-freezer-super-saiyajin', 'dbz-garlic-jr'],
  'vol-cell-trunks': ['dbz-androides-trunks', 'dbz-cell-imperfecto-perfeccion'],
  'vol-cell-games': ['dbz-juegos-de-cell', 'dbz-torneo-otro-mundo'],
  'vol-buu-caos': ['dbz-buu-majin-vegeta', 'dbz-buu-ssj3-fusion', 'dbz-buu-gotenks-gohan-mistico', 'dbz-buu-vegetto-kidbuu-final'],
  'vol-daima-reino': ['db-daima-conspiracion', 'db-daima-climax'],
  'vol-super-dioses': ['dbs-batalla-dioses', 'dbs-resurreccion-f'],
  'vol-super-black': ['dbs-torneo-u6', 'dbs-copy-vegeta', 'dbs-goku-black'],
  'vol-super-torneo': ['dbs-exhibicion-zen', 'dbs-reclutamiento-u7', 'dbs-torneo-del-poder'],
  'vol-gt-viaje': ['dbgt-black-star', 'dbgt-baby-ssj4', 'dbgt-super-17', 'dbgt-dragones-malignos'],
};

