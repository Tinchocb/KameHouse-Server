import { defineConfig, loadEnv, RsbuildConfig } from "@rsbuild/core"
import { pluginBabel } from "@rsbuild/plugin-babel"
import { pluginReact } from "@rsbuild/plugin-react"
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack"
import { createRequire } from "node:module"
import path from "path"
import { pluginJassubTranspile } from "./rsbuild.jassub"
import { getPwaPlugin } from "./rsbuild.pwa"
import { pluginImageCompress } from "@rsbuild/plugin-image-compress"

const require = createRequire(import.meta.url)

const { publicVars } = loadEnv({ prefixes: ["SEA_"] })

/** Puerto del API en desarrollo (proxy `/api` y `getServerBaseUrl` en desktop dev).
 *  El sidecar de Tauri usa 43212 en desarrollo; aseguramos que el proxy apunte al puerto correcto. */
const devBackendPort =
    process.env.KAMEHOUSE_DEV_API_PORT ||
    process.env.KAMEHOUSE_PORT ||
    process.env.SEA_PUBLIC_DEV_API_PORT ||
    "43212"
const devBackendTarget = `http://127.0.0.1:${devBackendPort}`

/** `true` solo en `rsbuild build` (prod). En dev se recorta todo lo costoso
 *  que no aporta al iterar: compresión de imágenes, React Compiler y
 *  transpilación con minify — el boot del dev server es lo que bloquea a `tauri dev`. */
const isProd = process.env.NODE_ENV === "production"

const config: RsbuildConfig = {
    plugins: [
        pluginReact(),
        pluginJassubTranspile(),
        // Solo prod: en dev la compresión de imágenes suma segundos a cada arranque.
        isProd && pluginImageCompress(),
        // Solo prod: React Compiler es una optimización; en dev el transform
        // extra ralentiza el boot sin cambiar el comportamiento.
        isProd && pluginBabel({
            include: /\.(?:jsx|tsx|m?js|m?jsx)$/,
            exclude: [/[\\/]node_modules[\\/]/],
            babelLoaderOptions(opts) {
                opts.presets ??= []
                opts.plugins ??= []
                // React Compiler — must be first plugin so it runs on untransformed source.
                // Files with 'use no memo' are automatically skipped (e.g. usePlayerHls, debug).
                opts.plugins.unshift(["babel-plugin-react-compiler", { target: "19" }])
            },
        }),
    ].filter(Boolean),
    source: {
        entry: {
            index: "./src/main.tsx",
        },
        define: {
            ...publicVars,
            "import.meta.env.SEA_PUBLIC_DEV_API_PORT": JSON.stringify(devBackendPort),
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    dev: {
        // Compilación perezosa en dev: el server arranca en segundos y cada
        // ruta se compila al visitarla (ideal con el code-splitting por ruta).
        lazyCompilation: true,
    },
    server: { // dev server
        port: Number(process.env.PORT) || 43210,
        host: "0.0.0.0",
        headers: {
            "Cross-Origin-Embedder-Policy": "credentialless",
            "Cross-Origin-Opener-Policy": "same-origin",
        },
        proxy: {
            '/api': {
                target: devBackendTarget,
                changeOrigin: true,
                ws: true,
                logLevel: 'silent',
                onError: (err, req, res) => {
                    const code = (err as any).code || '';
                    // Silently drop broken-pipe / aborted connections (browser closed tab, etc.)
                    if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'EPIPE') {
                        return;
                    }
                    // Backend not ready yet (sidecar still starting) — return 503 so the
                    // frontend can distinguish a transient startup delay from a real error.
                    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
                        if (res && 'writeHead' in res && !(res as any).headersSent) {
                            (res as any).writeHead(503, {
                                'Content-Type': 'application/json',
                                'Retry-After': '2',
                            });
                            (res as any).end(JSON.stringify({
                                error: 'Backend server is starting up, please wait...',
                            }));
                        }
                        return;
                    }
                    if (res && 'writeHead' in res && !(res as any).headersSent) {
                        (res as any).writeHead(500, { 'Content-Type': 'text/plain' });
                        (res as any).end('Proxy error: ' + err.message);
                    }
                }
            },
        },
    },
    output: {
        polyfill: "off",
        dataUriLimit: 1024,
        cleanDistPath: true,
        sourceMap: process.env.NODE_ENV === "production" ? "hidden" : !!process.env.RSDOCTOR,
        distPath: {
            root: "out",
        },
        filename: {
            js: process.env.NODE_ENV === "production" ? "[name].[contenthash:8].js" : "[name].js",
        },
    },
    html: {
        template: "./index.html",
        title: "KameHouse",
    },
    performance: {
        preload: process.env.NODE_ENV === "production" ? {
            type: "initial",
            include: [/(?:outfit|space-mono).*\.woff2$/],
        } : false,
        chunkSplit: process.env.NODE_ENV === "production" ? {
            forceSplitting: {
                "react-core": /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                "hls": /[\\/]node_modules[\\/]hls\.js[\\/]/,
                "jassub": /[\\/]node_modules[\\/]jassub[\\/]/,
                "lucide": /[\\/]node_modules[\\/]lucide-react[\\/]/,
                "tanstack-query": /[\\/]node_modules[\\/]@tanstack[\\/]react-query/,
                "tanstack-router": /[\\/]node_modules[\\/]@tanstack[\\/]react-router/,
                "framer-motion": /[\\/]node_modules[\\/](framer-motion|motion)[\\/]/,
                "ui-primitives": /[\\/]node_modules[\\/](@radix-ui|vaul|cmdk)[\\/]/,
                "fontsource": /[\\/]node_modules[\\/]@fontsource/,
                "zod": /[\\/]node_modules[\\/]zod[\\/]/,
            },
            // Route-level code splitting for heavy pages
            manualChunks: {
                "series-detail": /[\\/]src[\\/]routes[\\/]series[\\/]\$seriesId/,
                "movie-detail": /[\\/]src[\\/]routes[\\/]movies[\\/]\$movieId/,
                "chronology": /[\\/]src[\\/]routes[\\/]chronology/,
                "settings": /[\\/]src[\\/]routes[\\/]settings/,
                "admin": /[\\/]src[\\/]routes[\\/]admin/,
            },
        } : {
            strategy: "all-in-one",
        },
    },
    tools: {
        rspack: {
            experiments: {},
            output: {
                chunkFilename: process.env.NODE_ENV === "production" ? "static/js/async/[name].[contenthash:8].js" : "static/js/async/[name].js",
            },
            optimization: {
                chunkIds: !!process.env.RSDOCTOR ? "named" : undefined,
            },
            plugins: [
                TanStackRouterRspack({
                    routesDirectory: "./src/routes",
                    generatedRouteTree: "./src/routeTree.gen.ts",
                    autoCodeSplitting: true,
                    routeFileIgnorePattern: "((^|\\.)(components|hooks|helpers|mappers|types|utils|tabs?)|.*-tab)\\.(ts|tsx)$",
                }),
                process.env.NODE_ENV === 'production' && getPwaPlugin(),
                process.env.RSDOCTOR && new RsdoctorRspackPlugin({}),
            ].filter(Boolean),
            resolve: {
                alias: {
                    "react-scan$": require.resolve("react-scan/dist/index.js"),
                },
                mainFields: ["module", "main"],
                conditionNames: ["import", "module", "browser", "default"],
                fallback: {
                    module: false,
                },
            },
            module: {
                parser: {
                    javascript: {
                        strictExportPresence: false,
                    },
                },
                rules: [
                    { // stops circular deps warning
                        test: /jassub[\\/]dist[\\/].*\.js$/,
                        parser: {
                            worker: false,
                        },
                    },
                    { // don't emit these again
                        test: /\.wasm$/,
                        include: /node_modules[\\/]jassub/,
                        type: "asset/resource",
                        generator: {
                            emit: false,
                        },
                    },
                ],
            },
        },
    },
}
export default defineConfig(config)
