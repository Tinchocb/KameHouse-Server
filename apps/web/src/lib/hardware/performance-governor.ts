import { useEffect } from "react"
import { usePerformanceStore } from "./performance-store"

/** Tiempo seguido fuera de rango antes de cambiar de modo (activar o soltar el ahorro). */
export const GOVERNOR_SUSTAIN_MS = 5000
/** Pausa en reposo sano entre ráfagas de 1 s (evita correr rAF a 60–240 Hz en quietud). */
export const GOVERNOR_IDLE_COOLDOWN_MS = 5000
/** Tiempo tras arrancar que no cuenta: la carga y el primer render no son el rendimiento real. */
const WARMUP_MS = 2000
const SAMPLE_WINDOW_MS = 1000

export interface GovernorStreaks {
    /** Desde cuándo el FPS está bajo el mínimo sano; `null` si no lo está. */
    lowSince: number | null
    /** Desde cuándo el FPS se recuperó con el ahorro activo; `null` si no. */
    healthySince: number | null
}

interface GovernorSample {
    now: number
    fps: number
    throttled: boolean
    targetHz: number
}

type GovernorAction = "throttle" | "release" | null

/**
 * Umbrales de FPS según el refresco de la pantalla. Es un respaldo ante una degradación grave, no un
 * objetivo de 60 FPS: en pantallas de menos de 120 Hz tolera caer hasta 30 FPS.
 */
export function governorThresholds(targetHz: number): { minHealthyFps: number; recoveryFps: number } {
    return targetHz >= 120 ? { minHealthyFps: 45, recoveryFps: 70 } : { minHealthyFps: 30, recoveryFps: 40 }
}

/**
 * Un cuadro del gobernador: cuánto lleva el FPS bajo o sano y si hay que cambiar el modo. Puro: no toca
 * el store ni el DOM. La histéresis es por tiempo sostenido, no por cantidad de cuadros.
 */
export function stepGovernor(
    streaks: GovernorStreaks,
    sample: GovernorSample,
): { streaks: GovernorStreaks; action: GovernorAction } {
    const { now, fps, throttled, targetHz } = sample
    const { minHealthyFps, recoveryFps } = governorThresholds(targetHz)

    if (fps < minHealthyFps) {
        const lowSince = streaks.lowSince ?? now
        const action = !throttled && now - lowSince >= GOVERNOR_SUSTAIN_MS ? "throttle" : null
        return { streaks: { lowSince, healthySince: null }, action }
    }

    if (throttled && fps >= recoveryFps) {
        const healthySince = streaks.healthySince ?? now
        const action = now - healthySince >= GOVERNOR_SUSTAIN_MS ? "release" : null
        return { streaks: { lowSince: null, healthySince }, action }
    }

    return { streaks: { lowSince: null, healthySince: null }, action: null }
}

/**
 * Mide el FPS mediante ráfagas periódicas y activa o suelta el modo ahorro (`autoThrottleActive`).
 * En reposo sano suspende rAF entre ventanas (`GOVERNOR_IDLE_COOLDOWN_MS`) y despierta al instante
 * con actividad del usuario; durante caídas de FPS o con ahorro activo mide cuadro a cuadro.
 */
export function startPerformanceGovernor(): () => void {
    const startedAt = performance.now()
    // Marcas de los cuadros del último segundo: de ahí sale el FPS.
    const ticks: number[] = []
    let streaks: GovernorStreaks = { lowSince: null, healthySince: null }
    let rafId = 0
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null
    let observableSince: number | null = null
    let stopped = false
    let wakeListening = false

    const resetBurstWindow = () => {
        ticks.length = 0
        observableSince = null
    }
    const resetWindow = () => {
        resetBurstWindow()
        streaks = { lowSince: null, healthySince: null }
    }
    // Ventana tapada, en segundo plano o sin foco: el navegador recorta los rAF y las lecturas bajas no
    // reflejan el rendimiento real de la app.
    const isObservable = () => document.visibilityState === "visible" && document.hasFocus()

    const scheduleFrame = () => {
        if (!stopped && !rafId && isObservable()) {
            rafId = requestAnimationFrame(frame)
        }
    }

    const detachWakeListeners = () => {
        if (!wakeListening) return
        wakeListening = false
        window.removeEventListener("scroll", wakeBurst, { capture: true })
        window.removeEventListener("pointerdown", wakeBurst, { capture: true })
        window.removeEventListener("keydown", wakeBurst, { capture: true })
    }

    const clearCooldown = () => {
        if (cooldownTimer !== null) {
            clearTimeout(cooldownTimer)
            cooldownTimer = null
        }
        detachWakeListeners()
    }

    const wakeBurst = () => {
        clearCooldown()
        if (!stopped && isObservable()) {
            resetBurstWindow()
            scheduleFrame()
        }
    }

    const attachWakeListeners = () => {
        if (wakeListening || stopped) return
        wakeListening = true
        window.addEventListener("scroll", wakeBurst, { capture: true, passive: true })
        window.addEventListener("pointerdown", wakeBurst, { capture: true, passive: true })
        window.addEventListener("keydown", wakeBurst, { capture: true, passive: true })
    }

    const enterCooldown = () => {
        if (stopped || cooldownTimer !== null || !isObservable()) return
        resetBurstWindow()
        attachWakeListeners()
        cooldownTimer = setTimeout(() => {
            cooldownTimer = null
            wakeBurst()
        }, GOVERNOR_IDLE_COOLDOWN_MS)
    }

    const frame = (now: number) => {
        rafId = 0
        if (stopped || !isObservable()) {
            clearCooldown()
            resetWindow()
            return
        }
        observableSince ??= now

        ticks.push(now)
        let start = 0
        while (start < ticks.length && ticks[start] <= now - 1000) start++
        if (start > 0) ticks.splice(0, start)

        // Ventana de 1 s recién llena: sin warm-up tras volver a ser observable.
        // Con 2–10 FPS la marca más antigua del buffer nunca necesariamente alcanza
        // 900 ms: medir el tiempo observable, no la separación entre muestras retenidas.
        const warmed = now - startedAt > WARMUP_MS && now - observableSince >= SAMPLE_WINDOW_MS
        if (!warmed) {
            scheduleFrame()
            return
        }

        const state = usePerformanceStore.getState()
        const result = stepGovernor(streaks, {
            now,
            fps: ticks.length,
            throttled: state.autoThrottleActive,
            targetHz: state.hardwareSpecs?.screenRefreshRate || 60,
        })
        streaks = result.streaks
        if (result.action) state.setAutoThrottleActive(result.action === "throttle")

        const nextThrottled = result.action ? result.action === "throttle" : state.autoThrottleActive
        if (streaks.lowSince !== null || nextThrottled) {
            scheduleFrame()
        } else {
            enterCooldown()
        }
    }

    const syncActivity = () => {
        clearCooldown()
        resetWindow()
        if (stopped || !isObservable()) {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = 0
        } else {
            scheduleFrame()
        }
    }
    document.addEventListener("visibilitychange", syncActivity)
    window.addEventListener("blur", syncActivity)
    window.addEventListener("focus", syncActivity)
    syncActivity()

    return () => {
        stopped = true
        clearCooldown()
        cancelAnimationFrame(rafId)
        document.removeEventListener("visibilitychange", syncActivity)
        window.removeEventListener("blur", syncActivity)
        window.removeEventListener("focus", syncActivity)
    }
}

/** Gobernador activo mientras `enabled` (la interfaz ya está lista) y la preferencia del usuario lo permita. */
export function usePerformanceGovernor(enabled: boolean): void {
    const autoGovernorEnabled = usePerformanceStore((s) => s.autoGovernorEnabled)

    useEffect(() => {
        if (!enabled || !autoGovernorEnabled) return
        return startPerformanceGovernor()
    }, [enabled, autoGovernorEnabled])
}
