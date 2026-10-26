/**
 * Tiempo de reproducción como "mm:ss" o "h:mm:ss". Lo que no es un tiempo válido se muestra
 * como "00:00": 0, NaN, infinito (duración de un stream en vivo) y negativos.
 */
export function formatPlaybackTime(secs: number): string {
    if (!Number.isFinite(secs) || secs <= 0) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)

    const mm = m.toString().padStart(2, "0")
    const ss = s.toString().padStart(2, "0")

    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
