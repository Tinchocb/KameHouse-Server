import { defineConfig, loadEnv, RsbuildPluginAPI, RsbuildConfig } from "@rsbuild/core"
import { pluginBabel } from "@rsbuild/plugin-babel"
import { pluginReact } from "@rsbuild/plugin-react"
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack"
import { buildSync } from "esbuild"
import * as fs from "node:fs"
import path from "path"
import { GenerateSW } from "workbox-webpack-plugin"

const { publicVars } = loadEnv({ prefixes: ["SEA_"] })

/** Puerto del API en desarrollo (proxy `/api` y `getServerBaseUrl` en desktop dev). */
const devBackendPort =
    process.env.KAMEHOUSE_DEV_API_PORT ||
    process.env.KAMEHOUSE_PORT ||
    process.env.SEA_PUBLIC_DEV_API_PORT ||
    "43211"
const devBackendTarget = `http://127.0.0.1:${devBackendPort}`

const config: RsbuildConfig = {
    plugins: [
        pluginReact(),
        { // run stuff before build
            name: "before-build",
            setup(api: RsbuildPluginAPI) {
                // api.onBeforeStartDevServer(processJassub)
                api.onBeforeBuild(processJassub)

                function processJassub() {
                    console.log("Running transpilation...")
                    const source = path.resolve(__dirname, "node_modules/jassub/dist/worker/worker.js")
                    const outDir = path.resolve(__dirname, "public", "jassub")
                    const outFile = path.join(outDir, "jassub-worker.js")

                    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

                    // transpile using esbuild (goated)
                    buildSync({
                        entryPoints: [source],
                        outfile: outFile,
                        bundle: true,
                        format: "iife",
                        define: {
                            "import.meta.url": "self.location.href",
                        },
                        minify: false,
                    })

                    // copy wasm files
                    const wasmSource = path.resolve(__dirname, "node_modules/jassub/dist/wasm/jassub-worker.wasm")
                    const wasmModernSource = path.resolve(__dirname, "node_modules/jassub/dist/wasm/jassub-worker-modern.wasm")
                    fs.copyFileSync(wasmSource, path.join(outDir, "jassub-worker.wasm"))
                    fs.copyFileSync(wasmModernSource, path.join(outDir, "jassub-worker-modern.wasm"))
                    console.log("Finished transpiling jassub")

                    // Transpile custom service worker
                    buildSync({
                        entryPoints: [path.resolve(__dirname, "src/sw.ts")],
                        outfile: path.resolve(__dirname, "public/sw-custom.js"),
                        bundle: true,
                        format: "iife",
                        minify: process.env.NODE_ENV === "production"
                    })
                    console.log("Finished transpiling sw-custom.js")
                }
            },
        },
        pluginBabel({
            include: /\.(?:jsx|tsx)$/,
            babelLoaderOptions(opts) {
                opts.plugins ??= []
                opts.plugins.push(["babel-plugin-react-compiler", { target: "18" }])
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
            "react$": path.resolve(__dirname, "./src/react-alias.ts"),
        },
    },
    server: { // dev server
        port: 43210,
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
                onError: (err, req, res) => {
                    const code = (err as any).code || '';
                    if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'EPIPE') {
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
        cleanDistPath: true,
        sourceMap: !!process.env.RSDOCTOR,
        distPath: {
            root: "out",
        },
        filename: {
            js: "[name].[contenthash:8].js",
            css: "[name].[contenthash:8].css",
        },
    },
    html: {
        template: "./index.html",
        title: "KameHouse",
    },
    performance: {
        chunkSplit: {
            forceSplitting: {
                "hls": /hls\.js/,
                "rrweb": /rrweb/,
                "lucide": /lucide-react/,
                "tanstack-query": /@tanstack\/react-query/,
                "tanstack-router": /@tanstack\/react-router/,
            },
        },
    },
    tools: {
        // swc: {
        //   minify: true,
        // },
        rspack: {
            experiments: {
                // breaks rrweb
                // outputModule: true,
            },
            output: { // redundant?
                chunkFilename: "static/js/async/[name].[contenthash:8].js",
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
                process.env.NODE_ENV === 'production' && new GenerateSW({
                    clientsClaim: true,
                    skipWaiting: true,
                    importScripts: ['/sw-custom.js'],
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
                            urlPattern: /\/api\//,
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'api-cache',
                                expiration: {
                                    maxEntries: 200,
                                    maxAgeSeconds: 5 * 60, // 5 minutes TTL
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
                }),
                process.env.RSDOCTOR && new RsdoctorRspackPlugin({}),
            ].filter(Boolean),
            resolve: {
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
