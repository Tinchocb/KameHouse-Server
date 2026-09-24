import { RsbuildPlugin } from "@rsbuild/core"
import { buildSync } from "esbuild"
import * as fs from "node:fs"
import { createRequire } from "node:module"
import path from "path"

const require = createRequire(import.meta.url)

export const pluginJassubTranspile = (): RsbuildPlugin => ({
    name: "jassub-transpile",
    setup(api) {
        api.onBeforeBuild(processJassub)
        api.onBeforeStartDevServer(processJassub)

        function processJassub() {
            const isProd = process.env.NODE_ENV === "production"
            const jassubDir = path.dirname(require.resolve("jassub/package.json"))
            const source = path.join(jassubDir, "dist/worker/worker.js")
            const outDir = path.resolve(__dirname, "public", "jassub")
            const outFile = path.join(outDir, "jassub-worker.js")
            const wasmOut = path.join(outDir, "jassub-worker.wasm")
            const wasmModernOut = path.join(outDir, "jassub-worker-modern.wasm")
            const swSource = path.resolve(__dirname, "src/sw.ts")
            const swOut = path.resolve(__dirname, "public/sw-custom.js")

            // En dev los outputs ya existen de arranques previos: si son más
            // nuevos que los inputs, se salta la transpilación (era ~varios
            // segundos en cada `rsbuild dev`). En prod siempre se regenera.
            // Cada output se compara contra su propio input: copyFileSync conserva el
            // mtime del .wasm de node_modules, así que compararlo contra sw.ts lo
            // daba siempre por viejo y la transpilación corría en cada arranque.
            const wasmSource = path.join(jassubDir, "dist/wasm/jassub-worker.wasm")
            const wasmModernSource = path.join(jassubDir, "dist/wasm/jassub-worker-modern.wasm")
            if (!isProd
                && isCacheFresh([source], [outFile])
                && isCacheFresh([wasmSource], [wasmOut])
                && isCacheFresh([wasmModernSource], [wasmModernOut])
                && isCacheFresh([swSource], [swOut])) {
                console.log("Skipping jassub transpile (cache fresh)")
                return
            }

            console.log("Running transpilation...")

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
                // En dev no se minifica: es más rápido y el worker solo se usa al reproducir ASS.
                minify: isProd,
                sourcemap: false,
            })

            // copy wasm files
            fs.copyFileSync(wasmSource, wasmOut)
            fs.copyFileSync(wasmModernSource, wasmModernOut)
            console.log("Finished transpiling jassub")

            // Transpile custom service worker
            buildSync({
                entryPoints: [swSource],
                outfile: swOut,
                bundle: true,
                format: "iife",
                minify: isProd
            })
            console.log("Finished transpiling sw-custom.js")
        }

        /** `true` si todos los outputs existen y son más nuevos que los inputs. */
        function isCacheFresh(inputs: string[], outputs: string[]): boolean {
            try {
                const newestInput = Math.max(...inputs.map((f) => fs.statSync(f).mtimeMs))
                return outputs.every((f) => fs.statSync(f).mtimeMs >= newestInput)
            } catch {
                return false
            }
        }
    },
})
