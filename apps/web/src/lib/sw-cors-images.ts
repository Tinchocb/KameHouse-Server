/**
 * Decisión del Service Worker sobre pedirle una imagen al servidor en modo CORS.
 *
 * En la app de escritorio la página vive en `http://tauri.localhost` y el servidor en
 * `http://127.0.0.1:<puerto>`: cada `<img>` (sin `crossorigin`) es un pedido `no-cors`
 * cross-origin. Esos pedidos no salen de la caché HTTP del navegador (medido: 5 de 5
 * visitas a la red; con `crossorigin="anonymous"` sí se cachean) y el SW solo los ve como
 * respuestas opacas (status 0), que no guarda. Pedirlos desde el SW con `mode: "cors"`
 * devuelve una respuesta legible con status 200: se puede guardar, y la página la acepta
 * igual (una respuesta `cors` es válida para un pedido `no-cors`).
 */

/** Rutas del propio servidor cuyas respuestas son imágenes inmutables. */
const API_IMAGE_PATH = /^\/api\/v1\/(?:image-proxy|video-thumbnail|thumbnail\/)/

export function shouldFetchImageWithCors(requestUrl: string, requestMode: string, swOrigin: string): boolean {
    if (requestMode !== "no-cors") return false
    let url: URL
    try {
        url = new URL(requestUrl)
    } catch {
        return false
    }
    // Mismo origen: la respuesta ya es `basic` y se guarda sin más.
    if (url.origin === swOrigin) return false
    if (url.hostname === "image.tmdb.org") return true
    return API_IMAGE_PATH.test(url.pathname)
}
