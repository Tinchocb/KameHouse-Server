import { GenerateSW } from "workbox-webpack-plugin"

export const getPwaPlugin = () => {
    return new GenerateSW({
        swDest: "sw.js",
        clientsClaim: true,
        skipWaiting: false, // Controlado cooperativamente desde el cliente (pwa-registry) sin cortar streams HLS
        importScripts: ['/sw-custom.js'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // Límite holgado: el mayor asset precacheado es index.css (~0,4 MB). public/ no entra al precache.
        exclude: [
            /\.map$/,
            /\.wasm$/,
            /\.woff$/,
            /\.(?:m4a|mp3|ogg|wav)$/,
            /^sounds\//,
            /^jassub\//,
            /LICENSE/i,
            // Chunks pesados bajo demanda (player, hls, jassub, rutas lazy): cacheados en runtime
            /^static\/js\/(?:hls|jassub)\./,
            /^static\/js\/async\//,
            // Arte de lomos (13.39 MB): cacheado bajo demanda vía CacheFirst en runtime
            /^icons\/series-icons\//,
            // Fuentes de idioma no usadas y fallback pesado default.*.woff2 (146 KB)
            /-vietnamese-.*\.woff2$/,
            /^static\/font\/.*-latin-ext-.*\.woff2$/,
            /^static\/font\/default\.[^/]+\.woff2$/,
        ],
        navigateFallback: "/index.html",
        // Evita enmascarar 404s de API/WS con el shell: solo SPA para navegaciones documento
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /\.wasm$/, /\.ass$/],
        runtimeCaching: [
            {
                urlPattern: /\/static\/(?:js|css)\//,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'static-runtime-assets',
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                    expiration: {
                        maxEntries: 200,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                    },
                },
            },
            {
                urlPattern: /\/static\/font\/.*\.woff2$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'runtime-fonts',
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                    expiration: {
                        maxEntries: 40,
                        maxAgeSeconds: 90 * 24 * 60 * 60,
                    },
                },
            },
            {
                urlPattern: /\/api\/v1\/continuity\/item/,
                handler: 'NetworkOnly',
                method: 'PATCH',
                options: {
                    backgroundSync: {
                        name: 'continuity-sync-queue',
                        options: {
                            maxRetentionTime: 24 * 60,
                        },
                    },
                },
            },
            {
                urlPattern: /\/api\/v1\/report\/issue/,
                handler: 'NetworkOnly',
                method: 'POST',
                options: {
                    backgroundSync: {
                        name: 'report-sync-queue',
                        options: {
                            maxRetentionTime: 24 * 60,
                        },
                    },
                },
            },
            {
                urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|avif)(?:\?.*)?$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'images',
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                    expiration: {
                        maxEntries: 1000,
                        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                    },
                },
            }
        ]
    })
}
