import * as React from "react"
import type { FeatureBundle } from "framer-motion"

/**
 * Carga diferida de las funciones de framer-motion.
 *
 * El chunk se pide apenas arranca la app (main.tsx), en paralelo con el resto,
 * y el splash HTML no se retira hasta que llegó: así ningún `m.*` con
 * `initial={{ opacity: 0 }}` se ve esperando sus animaciones (quedaría
 * invisible). Si la descarga falla se reintenta; si igual falla, el tope de
 * seguridad del splash (1,5 s) libera la interfaz.
 */

type Importer = () => Promise<{ default: FeatureBundle }>

// Nombre de chunk estable: rsbuild.config.ts lo precarga desde el HTML.
let importer: Importer = () => import(/* webpackChunkName: "motion-features" */ "@/lib/motion-features")
let promise: Promise<FeatureBundle> | null = null
let ready = false
const listeners = new Set<() => void>()

function notify() {
    for (const l of listeners) l()
}

/** Pide el chunk (una sola vez; reintenta una vez si falla). */
export function loadMotionFeatures(): Promise<FeatureBundle> {
    promise ??= importer()
        .catch(() => importer())
        .then((m) => {
            ready = true
            notify()
            return m.default
        })
    return promise
}

/** true cuando las funciones de animación ya están cargadas. */
export function useMotionFeaturesReady(): boolean {
    return React.useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        () => ready,
        () => ready,
    )
}

/** Solo para tests. */
export function __resetMotionFeaturesForTests(next?: Importer) {
    importer = next ?? (() => import(/* webpackChunkName: "motion-features" */ "@/lib/motion-features"))
    promise = null
    ready = false
}
