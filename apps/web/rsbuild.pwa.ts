import { GenerateSW } from "workbox-webpack-plugin"

export const getPwaPlugin = () => {
    return new GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['/sw-runtime.js'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: "/index.html",
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
                urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'images',
                    expiration: {
                        maxEntries: 1000,
                        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                    },
                },
            }
        ]
    })
}
