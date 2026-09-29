/** Tiempo de reproducción como "mm:ss" o "h:mm:ss". 0/NaN → "00:00". */
export function formatPlaybackTime(secs: number): string {
    if (!secs || isNaN(secs)) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)

    const mm = m.toString().padStart(2, "0")
    const ss = s.toString().padStart(2, "0")

    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
