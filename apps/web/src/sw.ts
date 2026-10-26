/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies"
import { registerRoute } from "workbox-routing"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"
import { shouldFetchImageWithCors } from "./lib/sw-cors-images"

const CACHE_CONFIG = {
    wasm: { name: "wasm-decoders-cache", maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
    // Los cupos son holgados a propósito: las URLs son inmutables (llevan `v`, o son del proxy
    // local) y una entrada expulsada de la caché se vuelve a pedir al servidor. Cada entrada
    // pesa unos 5-60 KB, así que 3000 caben de sobra en la cuota del origen, y
    // `purgeOnQuotaError` libera todo si el navegador la agota.
    thumbnails: { name: "video-thumbnails-cache", maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
    images: { name: "images-runtime-cache", maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
}

// Las respuestas opacas (status 0, cross-origin sin CORS) se inflan varios MB cada una en
// la cuota del navegador: unas cientas agotan el origen y arrastran al IndexedDB del
// persister de React Query. Las imágenes cross-origin quedan en la caché HTTP normal.
const CACHEABLE_STATUSES = [200]

const LEGACY_API_CACHE_NAME = "api-metadata-cache"

function createCacheablePlugin(statuses: number[]) {
    return new CacheableResponsePlugin({ statuses })
}

function createExpirationPlugin(maxEntries: number, maxAgeSeconds: number) {
    return new ExpirationPlugin({ maxEntries, maxAgeSeconds, purgeOnQuotaError: true })
}

// Imágenes del servidor (o de TMDB) pedidas desde otro origen, como en la app de escritorio:
// el SW las pide en modo CORS para poder guardarlas (ver lib/sw-cors-images.ts). Si el servidor
// rechaza el CORS (origen no permitido, contraseña), se vuelve al pedido original sin guardar.
const corsForCrossOriginImages = {
    requestWillFetch: async ({ request }: { request: Request }) =>
        shouldFetchImageWithCors(request.url, request.mode, self.location.origin)
            ? new Request(request.url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" })
            : request,
    handlerDidError: async ({ request }: { request: Request }) => fetch(request),
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

// 2. Video thumbnails y endpoints de miniaturas locales (sin extensión requerida en URL).
// Con `v` (mtime+tamaño del archivo) la URL cambia si el archivo cambia: CacheFirst es seguro.
// Sin `v` el frame podría haber cambiado: se sirve el guardado y se revalida en segundo plano.
const isThumbnailRequest = ({ request, url }: { request: Request; url: URL }) =>
    request.method === "GET" &&
    (url.pathname.includes("/video-thumbnail") || url.pathname.includes("/thumbnail/"))

const thumbnailPlugins = () => [
    corsForCrossOriginImages,
    createCacheablePlugin(CACHEABLE_STATUSES),
    createExpirationPlugin(CACHE_CONFIG.thumbnails.maxEntries, CACHE_CONFIG.thumbnails.maxAgeSeconds),
]

registerRoute(
    (ctx) => isThumbnailRequest(ctx) && ctx.url.searchParams.has("v"),
    new CacheFirst({ cacheName: CACHE_CONFIG.thumbnails.name, plugins: thumbnailPlugins() })
)
registerRoute(
    isThumbnailRequest,
    new StaleWhileRevalidate({ cacheName: CACHE_CONFIG.thumbnails.name, plugins: thumbnailPlugins() })
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
            corsForCrossOriginImages,
            createCacheablePlugin(CACHEABLE_STATUSES),
            createExpirationPlugin(CACHE_CONFIG.images.maxEntries, CACHE_CONFIG.images.maxAgeSeconds),
        ],
    })
)

// 4. Las respuestas JSON de /api no pasan por el SW: el persister de React Query
// (IndexedDB) ya las restaura entre sesiones, y cachearlas acá duplicaba datos y podía
// devolver estado viejo (continuidad, estado del servidor). Se borra la caché que
// dejaron versiones anteriores.
self.addEventListener("activate", (event: ExtendableEvent) => {
    event.waitUntil(caches.delete(LEGACY_API_CACHE_NAME))
})

// 5. Manejo explícito de mensaje SKIP_WAITING enviado desde el cliente
self.addEventListener("message", (event: ExtendableMessageEvent) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        (self as unknown as ServiceWorkerGlobalScope).skipWaiting()
    }
})
