/**
 * Agrega el id del reproductor a la URL del stream local. El servidor usa ese id para encontrar
 * el archivo de esta reproducción: sin él, el master y los segmentos caían en el contenedor
 * "actual" global, y dos reproducciones a la vez se servían entre sí.
 */
export function withClientId(url: string, clientId: string): string {
    if (!url || !clientId) return url
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}clientId=${encodeURIComponent(clientId)}`
}
