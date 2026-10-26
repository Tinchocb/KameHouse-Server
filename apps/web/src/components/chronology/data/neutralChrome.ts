import type { VolumeData } from '../types';

/**
 * Neutro: el color de saga queda solo como identidad del contenido (chip de la saga, kanji,
 * arte). El cromo de la línea de tiempo (filetes, hilos, brillos, botón de play) pasa a gris.
 */
const NEUTRAL_CHROME_HEX = '#8E8E93';

const volumeCache = new WeakMap<VolumeData, VolumeData>();

export function neutralizeVolume(v: VolumeData): VolumeData {
  const cached = volumeCache.get(v);
  if (cached) return cached;
  const neutral: VolumeData = {
    ...v,
    coverArt: {
      ...v.coverArt,
      identityHex: v.coverArt.identityHex ?? v.coverArt.accentHex,
      accentHex: NEUTRAL_CHROME_HEX,
      spineColor: NEUTRAL_CHROME_HEX,
      borderColor: 'border-white/15',
      auraGradient: 'from-neutral-900 via-neutral-950 to-black',
    },
  };
  volumeCache.set(v, neutral);
  return neutral;
}
