import React from "react"
import type { PremiumEpisode } from "@/api/types/series.types"
import { getDeferredImageSrcSet } from "@/components/shared/deferred-image"
import { isImageLoaded, localImage, markImageLoaded } from "@/lib/helpers/images"

// Episodios que se esperan antes de mostrar la saga: los que entran en pantalla al cambiarla.
const READY_BATCH = 8
// Tope de espera: si el servidor tarda en generar miniaturas en frío, la lista no se queda colgada.
const MAX_WAIT_MS = 1500
const PRELOAD_TIMEOUT_MS = 30000

const inflight = new Map<string, Promise<boolean>>()
// Miniaturas que fallaron: cuentan como resueltas para no esperar el tope en cada cambio de saga.
const failed = new Set<string>()

function isSettled(rawUrl: string | undefined | null): boolean {
    if (!rawUrl) return true
    const src = localImage(rawUrl)
    return isImageLoaded(src) || failed.has(src)
}

/**
 * Descarga y decodifica una miniatura con el mismo `srcSet`/`sizes` que usará la fila,
 * así el `<img>` la encuentra en caché y DeferredImage arranca ya visible (sin fundido).
 */
function preloadThumbnail(rawUrl: string, sizes: string, priority: "high" | "low"): Promise<boolean> {
    const src = localImage(rawUrl)
    if (!src || isImageLoaded(src)) return Promise.resolve(true)
    if (failed.has(src)) return Promise.resolve(false)
    const existing = inflight.get(src)
    if (existing) return existing

    const promise = new Promise<boolean>((resolve) => {
        const img = new Image()
        img.decoding = "async"
        img.fetchPriority = priority
        let settled = false
        const finish = (ok: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            img.onload = null
            img.onerror = null
            inflight.delete(src)
            if (ok) {
                // DeferredImage consulta la URL del proxy; la fila, la original.
                markImageLoaded(src)
                markImageLoaded(rawUrl)
            } else {
                failed.add(src)
            }
            resolve(ok)
        }
        const timeout = setTimeout(() => finish(false), PRELOAD_TIMEOUT_MS)
        img.onload = () => {
            void (img.decode ? img.decode() : Promise.resolve()).then(() => finish(true), () => finish(true))
        }
        img.onerror = () => finish(false)
        const srcSet = getDeferredImageSrcSet(rawUrl)
        if (srcSet) {
            img.sizes = sizes
            img.srcset = srcSet
        }
        img.src = src
    })
    inflight.set(src, promise)
    return promise
}

function preloadEpisode(ep: PremiumEpisode, sizes: string, priority: "high" | "low"): Promise<void> {
    if (!ep.thumbnailUrl) return Promise.resolve()
    return preloadThumbnail(ep.thumbnailUrl, sizes, priority).then((ok) => {
        // Si la principal falla, la fila cae a la de respaldo: también se espera.
        if (!ok && ep.fallbackThumbnailUrl) return preloadThumbnail(ep.fallbackThumbnailUrl, sizes, priority).then(() => undefined)
        return undefined
    })
}

/**
 * Retiene la lista de una saga hasta que sus primeras miniaturas están descargadas, para que
 * aparezca completa de una vez en lugar de ir llenándose. Mientras tanto devuelve la lista
 * anterior (o `null` en la primera carga). Dentro de la misma saga los cambios (progreso,
 * vistos) pasan al instante.
 */
export function useSagaEpisodesReady(
    episodes: PremiumEpisode[],
    sagaKey: string,
    sizes: string,
): { episodes: PremiumEpisode[] | null; pending: boolean } {
    const [readyKey, setReadyKey] = React.useState<string | null>(null)
    const [lastShown, setLastShown] = React.useState<PremiumEpisode[] | null>(null)

    // Si las miniaturas ya estaban en caché no hace falta esperar ni un cuadro.
    const instantReady = readyKey !== sagaKey && episodes.slice(0, READY_BATCH).every(ep => isSettled(ep.thumbnailUrl))
    const isReady = readyKey === sagaKey || instantReady

    if (isReady && lastShown !== episodes) {
        setLastShown(episodes)
    }
    if (instantReady && readyKey !== sagaKey) {
        setReadyKey(sagaKey)
    }

    React.useEffect(() => {
        if (readyKey === sagaKey || instantReady) return
        let cancelled = false
        const preloadRest = () => {
            for (const ep of episodes.slice(READY_BATCH)) void preloadEpisode(ep, sizes, "low")
        }
        const reveal = () => {
            if (!cancelled) setReadyKey(sagaKey)
        }
        const timer = window.setTimeout(reveal, MAX_WAIT_MS)
        void Promise.all(episodes.slice(0, READY_BATCH).map(ep => preloadEpisode(ep, sizes, "high"))).then(() => {
            window.clearTimeout(timer)
            reveal()
            if (!cancelled) preloadRest()
        })
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [sagaKey, episodes, readyKey, instantReady, sizes])

    if (isReady) return { episodes, pending: false }
    return { episodes: lastShown, pending: true }
}
