import { isDataSavingEnabled } from "./network-preferences"

type Task = { key: string; run: () => unknown | Promise<unknown>; priority: number }
type Schedule = (callback: (budget: number) => void) => () => void

/** Una sola precarga especulativa en vuelo; cada inicio necesita un nuevo turno ocioso. */
export function createIdlePreloadQueue(schedule: Schedule, allowed: () => boolean) {
    const pending = new Map<string, Task>()
    let active: string | null = null
    let cancelTurn: (() => void) | null = null
    let disposed = false

    const wake = () => {
        if (disposed || active !== null || cancelTurn || !pending.size || !allowed()) return
        cancelTurn = schedule((budget) => {
            cancelTurn = null
            if (disposed || !allowed()) return
            if (budget < 4) { wake(); return }
            let next: Task | undefined
            for (const task of pending.values()) {
                if (!next || task.priority < next.priority) next = task
            }
            if (!next) return
            pending.delete(next.key)
            active = next.key
            // Una excepción o rechazo no bloquea el calentamiento de las demás tareas.
            void Promise.resolve().then(next.run).catch(() => {}).finally(() => {
                active = null
                wake()
            })
        })
    }

    return {
        enqueue(key: string, run: Task['run'], priority = 2) {
            if (disposed || active === key || pending.has(key)) return () => {}
            const task = { key, run, priority }
            pending.set(key, task)
            wake()
            return () => { if (pending.get(key) === task) pending.delete(key) }
        },
        wake,
        dispose() {
            disposed = true
            cancelTurn?.()
            cancelTurn = null
            pending.clear()
        },
    }
}

let shared: ReturnType<typeof createIdlePreloadQueue> | undefined

/** Prioridad: rutas (0), módulos del player (1), imágenes (2). No fuerza callbacks durante interacción. */
export function queueIdlePreload(key: string, run: Task['run'], priority = 2): () => void {
    if (typeof window === "undefined" || isDataSavingEnabled()) return () => {}
    if (!shared) {
        shared = createIdlePreloadQueue((callback) => {
            if (typeof window.requestIdleCallback === "function") {
                const id = window.requestIdleCallback((deadline) => callback(deadline.timeRemaining()))
                return () => window.cancelIdleCallback(id)
            }
            const id = window.setTimeout(() => callback(Infinity), 200)
            return () => window.clearTimeout(id)
        }, () => document.visibilityState !== "hidden" && !isDataSavingEnabled())
        const wake = () => shared?.wake()
        document.addEventListener("visibilitychange", wake)
        const connection = (navigator as Navigator & { connection?: EventTarget }).connection
        connection?.addEventListener?.("change", wake)
        if (import.meta.webpackHot) {
            import.meta.webpackHot.dispose(() => {
                shared?.dispose()
                document.removeEventListener("visibilitychange", wake)
                connection?.removeEventListener?.("change", wake)
            })
        }
    }
    return shared.enqueue(key, run, priority)
}
