import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"

/** Duración utilizable: finita y positiva. */
export function isUsableDuration(dur: number | null | undefined): dur is number {
    return typeof dur === "number" && Number.isFinite(dur) && dur > 0
}

/**
 * Duración del video saneada.
 *
 * El navegador puede reportar duration = Infinity/NaN en direct play de MKV
 * sin duración en el header. Si ese valor entra al estado, toda la lógica de
 * "cerca del final" (auto-skip de outro, avance marathon, panel de siguiente
 * episodio) se rompe: `total - curr <= N` nunca es cierto. Saneamos acá y
 * caemos a la duración de ffprobe (metadataDuration) que el server ya conoce.
 */
export function usePlayerDuration(metadataDuration: number | undefined) {
    const [duration, setDurationState] = useState(0)

    const metadataDurationRef = useRef(metadataDuration)
    useLayoutEffect(() => {
        metadataDurationRef.current = metadataDuration
    }, [metadataDuration])

    const setDuration = useCallback((dur: number) => {
        if (isUsableDuration(dur)) {
            setDurationState(dur)
            return
        }
        const meta = metadataDurationRef.current
        if (isUsableDuration(meta)) {
            setDurationState(meta)
        }
        // Sin valor confiable: conservar el anterior en vez de guardar Infinity/0.
    }, [])

    // Semilla inicial: si la metadata del server llega antes (o el navegador nunca
    // emite un durationchange finito), partimos de la duración de ffprobe.
    useEffect(() => {
        if (duration === 0 && isUsableDuration(metadataDuration)) {
            const timer = setTimeout(() => setDurationState(metadataDuration), 0)
            return () => clearTimeout(timer)
        }
    }, [metadataDuration, duration])

    return { duration, setDuration }
}
