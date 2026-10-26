/** Mensaje cuando Google limitó las descargas diarias de un archivo de Drive. */
export const DRIVE_QUOTA_MSG =
    "Google Drive limitó por hoy las descargas de este archivo. Suele liberarse en unas horas; mientras tanto, prueba con otra copia."

const DRIVE_PLAY_PATH = "/api/v1/drive/play"

/**
 * Tras un error nativo en un stream de Drive, pide 1 byte para saber si la
 * causa es la cuota diaria de Google (el servidor responde 503). En ese caso
 * el fallback a transcode no sirve: lee la misma fuente y también falla.
 * Devuelve el mensaje a mostrar, o null si el error es otro.
 */
export async function probeDriveQuotaError(
    url: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
    if (!url.includes(DRIVE_PLAY_PATH)) return null
    try {
        const res = await fetchImpl(url, { headers: { Range: "bytes=0-0" }, credentials: "include" })
        try {
            await res.body?.cancel()
        } catch {}
        return res.status === 503 ? DRIVE_QUOTA_MSG : null
    } catch {
        return null
    }
}
