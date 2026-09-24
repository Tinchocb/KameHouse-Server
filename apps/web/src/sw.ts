/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import {
    CacheFirst,
    NetworkFirst,
} from "workbox-strategies"
import { registerRoute } from "workbox-routing"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"

const CACHE_CONFIG = {
    wasm: { name: "wasm-decoders-cache", maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
    api: { name: "api-metadata-cache", maxEntries: 100, maxAgeSeconds: 4 * 60 * 60 },
    thumbnails: { name: "video-thumbnails-cache", maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
    images: { name: "images-runtime-cache", maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
}

function createCacheablePlugin(statuses: number[]) {
    return new CacheableResponsePlugin({ statuses })
}

function createExpirationPlugin(maxEntries: number, maxAgeSeconds: number) {
    return new ExpirationPlugin({ maxEntries, maxAgeSeconds })
}

// 1. WASM files (libass, decoders)
registerRoute(
    ({ request }) => request.url.endsWith(".wasm"),
    new CacheFirst({
        cacheName: CACHE_CONFIG.wasm.name,
        plugins: [
            createCacheablePlugin([0, 200]),
            createExpirationPlugin(CACHE_CONFIG.wasm.maxEntries, CACHE_CONFIG.wasm.maxAgeSeconds),
        ],
    })
)

// 2. Video thumbnails y endpoints de miniaturas locales (sin extensión requerida en URL)
registerRoute(
    ({ request, url }) =>
        request.method === "GET" &&
        (url.pathname.includes("/video-thumbnail") || url.pathname.includes("/thumbnail/")),
    new CacheFirst({
        cacheName: CACHE_CONFIG.thumbnails.name,
        plugins: [
            createCacheablePlugin([0, 200]),
            createExpirationPlugin(CACHE_CONFIG.thumbnails.maxEntries, CACHE_CONFIG.thumbnails.maxAgeSeconds),
        ],
    })
)

// 3. Imágenes remotas y dinámicas (TMDB, AniList, etc.)
registerRoute(
    ({ request, url }) =>
        request.method === "GET" &&
        (request.destination === "image" ||
            url.hostname.includes("tmdb.org") ||
            url.hostname.includes("anilist.co")),
    new CacheFirst({
        cacheName: CACHE_CONFIG.images.name,
        plugins: [
            createCacheablePlugin([0, 200]),
            createExpirationPlugin(CACHE_CONFIG.images.maxEntries, CACHE_CONFIG.images.maxAgeSeconds),
        ],
    })
)

// 4. Rutas generales de API (no-streaming, no-thumbnail)
registerRoute(
    ({ request, url }) =>
        url.pathname.startsWith("/api/") &&
        !url.pathname.includes("/mediastream/") &&
        !url.pathname.includes("/video-thumbnail") &&
        !url.pathname.includes("/thumbnail/") &&
        request.method === "GET",
    new NetworkFirst({
        cacheName: CACHE_CONFIG.api.name,
        plugins: [
            createCacheablePlugin([200]),
            createExpirationPlugin(CACHE_CONFIG.api.maxEntries, CACHE_CONFIG.api.maxAgeSeconds),
        ],
    })
)

// 5. Manejo explícito de mensaje SKIP_WAITING enviado desde el cliente
self.addEventListener("message", (event: ExtendableMessageEvent) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        (self as unknown as ServiceWorkerGlobalScope).skipWaiting()
    }
})
