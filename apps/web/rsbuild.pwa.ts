import { GenerateSW } from "workbox-webpack-plugin"

export const getPwaPlugin = () => {
    return new GenerateSW({
        swDest: "sw.js",
        clientsClaim: true,
        skipWaiting: false, // Controlado cooperativamente desde el cliente (pwa-registry) sin cortar streams HLS
        importScripts: ['/sw-custom.js'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB para soportar backdrops y sagas en precache
        exclude: [
            /\.map$/,
            /\.wasm$/,
            /\.(?:m4a|mp3|ogg|wav)$/,
            /^sounds\//,
            /^jassub\//,
            /LICENSE/i,
        ],
        navigateFallback: "/index.html",
        // Evita enmascarar 404s de API/WS con el shell: solo SPA para navegaciones documento
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /\.wasm$/, /\.ass$/],
        runtimeCaching: [
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
