const SAGA_IMAGE_MAP: Record<string, string[]> = {
  'db-pilaf': ['/sagas/pilaf.webp', '/sagas/original/busqueda-esferas.webp'],
  'db-torneo-21': ['/sagas/torneo-21.webp'],
  'db-red-ribbon': ['/sagas/red-ribbon.webp'],
  'db-uranai-baba': ['/sagas/uranai-baba.webp'],
  'db-torneo-22': ['/sagas/torneo-22.webp'],
  'db-piccolo-daimaku': ['/sagas/piccolo-daimaku.webp'],
  'db-piccolo-jr': ['/sagas/piccolo-daimaku.webp', '/sagas/original/goku-vs-piccolo-jr.webp'],
  'dbz-saiyajin-raditz': ['/sagas/saiyajin.webp'],
  'dbz-saiyajin-vegeta': ['/sagas/saiyajin.webp', '/sagas/z/vegeta-saga.webp'],
  'dbz-namek-viaje': ['/sagas/namek-freezer.webp', '/sagas/z/goku-llega-namek.webp'],
  'dbz-namek-ginyu-freezer': ['/sagas/namek-freezer.webp'],
  'dbz-freezer-super-saiyajin': ['/sagas/namek-freezer.webp'],
  'dbz-garlic-jr': ['/sagas/garlic-jr.webp'],
  'dbz-androides-trunks': ['/sagas/trunks-androides-cell.webp', '/sagas/z/trunks-saga.webp'],
  'dbz-cell-imperfecto-perfeccion': ['/sagas/trunks-androides-cell.webp', '/sagas/z/perfect-cell-saga.webp'],
  'dbz-juegos-de-cell': ['/sagas/z/cell-games-saga.webp', '/sagas/z/perfect-cell-saga.webp'],
  'dbz-torneo-otro-mundo': ['/sagas/z/cell-games-saga.webp'],
  'dbz-buu-majin-vegeta': ['/sagas/majin-buu.webp', '/sagas/z/fusion-saga.webp'],
  'dbz-buu-ssj3-fusion': ['/sagas/majin-buu.webp', '/sagas/z/fusion-saga.webp'],
  'dbz-buu-gotenks-gohan-mistico': ['/sagas/majin-buu.webp', '/sagas/z/fusion-saga.webp'],
  'dbz-buu-vegetto-kidbuu-final': ['/sagas/majin-buu.webp', '/sagas/z/kid-buu-saga.webp'],
  'db-daima-conspiracion': ['/sagas/daima.webp'],
  'db-daima-climax': ['/sagas/daima.webp'],
  'dbs-batalla-dioses': ['/sagas/batalla-dioses.webp'],
  'dbs-resurreccion-f': ['/sagas/resurreccion-f.webp', '/sagas/super/freezer-dorado.webp'],
  'dbs-torneo-u6': ['/sagas/super/torneo-u6.webp'],
  'dbs-copy-vegeta': ['/sagas/super/freezer-dorado.webp', '/sagas/batalla-dioses.webp'],
  'dbs-goku-black': ['/sagas/trunks-futuro.webp'],
  'dbs-exhibicion-zen': ['/sagas/super/torneo-u6.webp', '/sagas/batalla-dioses.webp'],
  'dbs-reclutamiento-u7': ['/sagas/super/reclutamiento-u7.webp', '/sagas/super/torneo-u6.webp'],
  'dbs-torneo-del-poder': ['/sagas/super/torneo-u6.webp'],
  'dbgt-black-star': ['/sagas/black-star.webp'],
  'dbgt-baby-ssj4': ['/sagas/baby.webp'],
  'dbgt-super-17': ['/sagas/baby.webp'],
  'dbgt-dragones-malignos': ['/sagas/black-star.webp'],
  'vol-clasico-origen': ['/sagas/pilaf.webp', '/sagas/torneo-21.webp', '/sagas/original/busqueda-esferas.webp'],
  'vol-clasico-redribbon': ['/sagas/red-ribbon.webp', '/sagas/torneo-22.webp'],
  'vol-clasico-piccolo': ['/sagas/piccolo-daimaku.webp', '/sagas/original/goku-vs-piccolo-jr.webp'],
  'vol-saiyan-choque': ['/sagas/saiyajin.webp', '/sagas/z/vegeta-saga.webp'],
  'vol-freezer-ssj': ['/sagas/namek-freezer.webp', '/sagas/z/goku-llega-namek.webp'],
  'vol-cell-trunks': ['/sagas/trunks-androides-cell.webp', '/sagas/z/trunks-saga.webp'],
  'vol-cell-games': ['/sagas/z/cell-games-saga.webp', '/sagas/z/perfect-cell-saga.webp'],
  'vol-buu-caos': ['/sagas/majin-buu.webp', '/sagas/z/fusion-saga.webp', '/sagas/z/kid-buu-saga.webp'],
  'vol-daima-reino': ['/sagas/daima.webp'],
  'vol-super-dioses': ['/sagas/batalla-dioses.webp', '/sagas/resurreccion-f.webp'],
  'vol-super-black': ['/sagas/trunks-futuro.webp'],
  'vol-super-torneo': ['/sagas/super/ultra-instinto-completo-victoria.webp', '/sagas/super/torneo-u6.webp'],
  'vol-gt-viaje': ['/sagas/black-star.webp', '/sagas/baby.webp', '/sagas/gt/omega-shenron.webp'],
};

export function getSagaFallbackImages(volumeId: string): string[] {
  if (SAGA_IMAGE_MAP[volumeId]) return SAGA_IMAGE_MAP[volumeId];
  // Match by prefix
  for (const [key, imgs] of Object.entries(SAGA_IMAGE_MAP)) {
    if (volumeId.startsWith(key)) return imgs;
  }
  if (volumeId.startsWith('db-pilaf')) return ['/sagas/pilaf.webp', '/sagas/original/busqueda-esferas.webp'];
  if (volumeId.startsWith('db-torneo-21')) return ['/sagas/torneo-21.webp'];
  if (volumeId.startsWith('db-rr')) return ['/sagas/red-ribbon.webp'];
  if (volumeId.startsWith('db-uranai')) return ['/sagas/uranai-baba.webp'];
  if (volumeId.startsWith('db-torneo-22')) return ['/sagas/torneo-22.webp'];
  if (volumeId.startsWith('db-piccolo-daimaku')) return ['/sagas/piccolo-daimaku.webp'];
  if (volumeId.startsWith('db-piccolo-jr')) return ['/sagas/piccolo-daimaku.webp', '/sagas/original/goku-vs-piccolo-jr.webp'];
  if (volumeId.startsWith('dbz-saiyajin')) return ['/sagas/saiyajin.webp', '/sagas/z/vegeta-saga.webp'];
  if (volumeId.startsWith('dbz-namek')) return ['/sagas/namek-freezer.webp', '/sagas/z/goku-llega-namek.webp'];
  if (volumeId.startsWith('dbz-freezer')) return ['/sagas/namek-freezer.webp'];
  if (volumeId.startsWith('dbz-garlic')) return ['/sagas/garlic-jr.webp'];
  if (volumeId.startsWith('dbz-androides')) return ['/sagas/trunks-androides-cell.webp', '/sagas/z/trunks-saga.webp'];
  if (volumeId.startsWith('dbz-cell')) return ['/sagas/trunks-androides-cell.webp', '/sagas/z/perfect-cell-saga.webp'];
  if (volumeId.startsWith('dbz-torneo-otro')) return ['/sagas/z/cell-games-saga.webp'];
  if (volumeId.startsWith('dbz-buu')) return ['/sagas/majin-buu.webp', '/sagas/z/fusion-saga.webp'];
  if (volumeId.startsWith('db-daima')) return ['/sagas/daima.webp'];
  if (volumeId.startsWith('dbs-dioses')) return ['/sagas/batalla-dioses.webp'];
  if (volumeId.startsWith('dbs-resurreccion')) return ['/sagas/resurreccion-f.webp', '/sagas/super/freezer-dorado.webp'];
  if (volumeId.startsWith('dbs-torneo-u6')) return ['/sagas/super/torneo-u6.webp'];
  if (volumeId.startsWith('dbs-copy')) return ['/sagas/super/freezer-dorado.webp', '/sagas/batalla-dioses.webp'];
  if (volumeId.startsWith('dbs-black')) return ['/sagas/trunks-futuro.webp'];
  if (volumeId.startsWith('dbs-exhibicion')) return ['/sagas/super/torneo-u6.webp'];
  if (volumeId.startsWith('dbs-reclutamiento')) return ['/sagas/super/reclutamiento-u7.webp'];
  if (volumeId.startsWith('dbs-torneo-poder')) return ['/sagas/super/torneo-u6.webp', '/sagas/super/ultra-instinto-completo-victoria.webp'];
  if (volumeId.startsWith('dbgt-black-star')) return ['/sagas/black-star.webp'];
  if (volumeId.startsWith('dbgt-baby')) return ['/sagas/baby.webp'];
  if (volumeId.startsWith('dbgt-super-17')) return ['/sagas/baby.webp'];
  if (volumeId.startsWith('dbgt-dragones')) return ['/sagas/black-star.webp'];

  return ['/sagas/pilaf.webp'];
}
