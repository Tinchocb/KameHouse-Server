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
