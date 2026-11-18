import { useEffect, useState } from "react"
import { ApiError, buildApiQuery } from "@/api/client/requests"
import { DRIVE_SUBTITLES_ENDPOINTS, isDrivePath } from "./drive-subtitles"
import type { TitleCard } from "./skip-windows"

interface Options {
    /** Ruta gdrive:// del episodio. Con otra cosa (o vacío) el hook no hace nada. */
    path: string | undefined
    /** Segundo desde el que buscar: el fin del opening si se conoce; si no, 0. */
    from: number
    enabled: boolean
}

const RETRY_DELAYS_MS = [4000, 10000]

/**
 * Deja leída en el servidor la placa del título de un episodio que todavía no se abrió (el
 * siguiente). Así, cuando empiece, la respuesta sale de lo ya leído y llega antes de que
 * el usuario toque «Saltar intro». No devuelve nada y nunca falla hacia afuera.
 */
export function prefetchDriveTitleCard(path: string | undefined): void {
    if (!isDrivePath(path)) return
    buildApiQuery<TitleCard, { path: string; from: number }>({
        endpoint: DRIVE_SUBTITLES_ENDPOINTS.titleCard,
        method: "POST",
        data: { path: path as string, from: 0 },
    }).catch(() => { /* es solo una precarga */ })
}

/**
 * Placa del título de un episodio de Drive, leída de sus subtítulos ASS (ver
 * drivesubs_titlecard.go). El servidor responde cuando terminó de leer el tramo, así que
 * el dato llega unos segundos después de abrir el episodio; hasta entonces es undefined.
 * Una falla pasajera se reintenta un par de veces; un archivo que no sirve (501), no.
 */
export function useDriveTitleCard({ path, from, enabled }: Options): TitleCard | undefined {
    const [result, setResult] = useState<{ key: string; card: TitleCard } | null>(null)
    const fromSec = Math.max(0, Math.floor(from))
    const active = enabled && isDrivePath(path)
    const key = `${path ?? ""}|${fromSec}`

    useEffect(() => {
        if (!active) return
        const ctrl = new AbortController()
        let timer: ReturnType<typeof setTimeout> | null = null
        let attempt = 0

        const run = async () => {
            try {
                const card = await buildApiQuery<TitleCard, { path: string; from: number }>({
                    endpoint: DRIVE_SUBTITLES_ENDPOINTS.titleCard,
                    method: "POST",
                    data: { path: path as string, from: fromSec },
                    signal: ctrl.signal,
                })
                if (!ctrl.signal.aborted && card) setResult({ key, card })
            } catch (err) {
                if (ctrl.signal.aborted) return
                if (err instanceof ApiError && err.status === 501) return // definitivo
                const delay = RETRY_DELAYS_MS[attempt++]
                if (delay !== undefined) timer = setTimeout(() => void run(), delay)
            }
        }
        void run()

        return () => {
            ctrl.abort()
            if (timer) clearTimeout(timer)
        }
    }, [active, path, fromSec, key])

    // Solo vale la respuesta del episodio y del punto de partida actuales.
    return active && result?.key === key ? result.card : undefined
}
