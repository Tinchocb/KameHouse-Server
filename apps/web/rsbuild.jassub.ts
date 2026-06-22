import { RsbuildPlugin } from "@rsbuild/core"
import { buildSync } from "esbuild"
import * as fs from "node:fs"
import path from "path"

export const pluginJassubTranspile = (): RsbuildPlugin => ({
    name: "jassub-transpile",
    setup(api) {
        api.onBeforeBuild(processJassub)
        api.onBeforeStartDevServer(processJassub)

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
})
