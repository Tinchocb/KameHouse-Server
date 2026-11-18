// TEMPORAL: build de verificación de la fase 3 (configuración real, salida fuera de out/). Borrar al terminar.
import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core"
import base from "./rsbuild.config"

const outRoot = process.env.FB_OUT_ROOT as string

export default defineConfig(mergeRsbuildConfig(base as any, {
    output: { distPath: { root: outRoot } },
}))
