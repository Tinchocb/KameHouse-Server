/** Ventana de FPS del panel; las pausas largas en primer plano también son muestras. */
export function createFrameWindow() {
    let previous: number | null = null
    const ticks: number[] = []
    return {
        reset() {
            previous = null
            ticks.length = 0
        },
        sample(now: number): { delta: number; fps: number } | null {
            const last = previous
            previous = now
            ticks.push(now)
            let expired = 0
            while (expired < ticks.length && ticks[expired] <= now - 1000) expired++
            if (expired) ticks.splice(0, expired)
            return last === null ? null : { delta: now - last, fps: ticks.length }
        },
    }
}
