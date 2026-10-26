/**
 * "#ef4444" → "239 68 68": canales para usar el color de la era en variables CSS
 * con alfa, p. ej. `rgb(var(--era) / 0.4)`.
 */
export function hexToRgbChannels(hex: string): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return '245 158 11';
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Acento sin era dominante: el tinte de "Todas las eras" y el respaldo de los componentes
 * que no reciben acento. Es el ámbar de `--status-warning`; va en JS porque
 * `hexToRgbChannels` necesita el hex.
 */
export const ALL_ERAS_HEX = '#f59e0b';

/**
 * Eras con versión aclarada para TEXTO. Cada una admite su hex del volumen o su token CSS
 * (de la era o vivo), en minúsculas.
 */
const TEXT_TOKENS = [
  {
    match: ['#e23a55', 'var(--era-dbgt-hex)', 'var(--spotlight-dbgt-vivid)'],
    text: 'var(--era-dbgt-text)',
    rgb: 'var(--era-dbgt-text-rgb)',
  },
  {
    match: ['#f2762e', 'var(--era-db-hex)', 'var(--spotlight-db-vivid)'],
    text: 'var(--era-db-text)',
    rgb: 'var(--era-db-text-rgb)',
  },
  {
    match: ['#3d8bff', 'var(--era-dbs-hex)', 'var(--spotlight-dbs-vivid)'],
    text: 'var(--era-dbs-text)',
    rgb: 'var(--era-dbs-text-rgb)',
  },
  {
    match: ['#a56ef0', 'var(--era-daima-hex)', 'var(--spotlight-daima-vivid)'],
    text: 'var(--era-daima-text)',
    rgb: 'var(--era-daima-text-rgb)',
  },
];

const textToken = (color: string) => {
  const c = color.trim().toLowerCase();
  return TEXT_TOKENS.find((t) => t.match.includes(c));
};

/**
 * Color de la era para TEXTO. DB, DBGT, DBS y Daima usan su versión aclarada (`--era-*-text`): el hex
 * sólido queda bajo 4,5:1 sobre paneles, pestañas y tarjetas. Fondos y bordes siguen con el hex.
 */
export function eraTextColor(color: string): string {
  return textToken(color)?.text ?? color;
}

/** Canales RGB de la era para texto, con el mismo criterio que eraTextColor. */
export function eraTextChannels(hex: string): string {
  return textToken(hex)?.rgb ?? hexToRgbChannels(hex);
}
