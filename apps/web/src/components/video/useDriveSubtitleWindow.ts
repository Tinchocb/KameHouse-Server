import { useEffect, useState } from "react"
import { ApiError, buildApiQuery } from "@/api/client/requests"
import { useSubtitleLoadStore } from "./subtitle-load-store"
import {
    describeWindowError,
    describeWindowUnsupported,
    DRIVE_SUBTITLES_ENDPOINTS,
    isDrivePath,
    needsSubtitleRefresh,
    nextWindowPollMs,
    type DriveWindowResponse,
    type HeldCoverage,
} from "./drive-subtitles"

interface Options {
    videoRef: React.RefObject<HTMLVideoElement | null>
    /** Ruta gdrive:// del episodio (props.streamUrl). */
    path: string | undefined
    /** La pista de subtítulos activa es progresiva (el servidor la lee por franjas). */
    active: boolean
}

/**
 * Subtítulos embebidos de un archivo de Google Drive, leídos por franjas de tiempo.
 *
 * El servidor no baja el archivo entero: lee los subtítulos de la zona que se está
 * viendo (60 s antes y 90 s después de la posición). Este hook le dice en qué segundo
 * está el reproductor (cada pocos segundos y al saltar) y devuelve una clave que sube
 * cuando conviene volver a pedir la pista, porque lo cargado ya no alcanza.
 */
export function useDriveSubtitleWindow({ videoRef, path, active }: Options): number {
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        if (!active || !isDrivePath(path)) return
        const video = videoRef.current
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | null = null
        let inflight = false
        let again = false
        let held: HeldCoverage | null = null
        const ctrl = new AbortController()

        const tick = async () => {
            if (cancelled) return
            if (inflight) {
                again = true
                return
            }
            inflight = true
            let delay: number | null = 5000
            try {
                const position = videoRef.current?.currentTime ?? 0
                const res = await buildApiQuery<DriveWindowResponse, { path: string; position: number }>({
                    endpoint: DRIVE_SUBTITLES_ENDPOINTS.window,
                    method: "POST",
                    data: { path: path as string, position },
                    signal: ctrl.signal,
                })
                if (cancelled || !res) return
                useSubtitleLoadStore.getState().setWindowInfo({
                    error: res.state === "error" ? describeWindowError(res) : null,
                    unsupported: false,
                    diag: res.diag ?? null,
                    state: res.state,
                    version: res.version,
                    coveredFrom: res.coveredFrom,
                    coveredUntil: res.coveredUntil,
                })
                if (needsSubtitleRefresh(held, res, position)) {
                    held = { from: res.coveredFrom, until: res.coveredUntil, version: res.version }
                    setRefreshKey((k) => k + 1)
                }
                delay = nextWindowPollMs(res, held)
            } catch (err) {
                // Sin red o con Drive caído: se reintenta; la pista ya cargada sigue sirviendo.
                // Lo que no se hace es callar: el panel dice qué pasa.
                if (err instanceof ApiError && err.status === 501) {
                    useSubtitleLoadStore.getState().setWindowInfo({
                        error: describeWindowUnsupported(err.message), unsupported: true, diag: null,
                        state: "unsupported", version: 0, coveredFrom: -1, coveredUntil: -1,
                    })
                    inflight = false
                    return // definitivo: no se sigue preguntando
                }
                if (!cancelled) {
                    const prev = useSubtitleLoadStore.getState().windowInfo
                    useSubtitleLoadStore.getState().setWindowInfo({
                        error: "No se pudo consultar al servidor: reintentando…", unsupported: false, diag: prev?.diag ?? null,
                        state: "error", version: prev?.version ?? 0, coveredFrom: -1, coveredUntil: -1,
                    })
                }
            } finally {
                inflight = false
            }
            if (cancelled) return
            if (again) {
                again = false
                delay = 0
            }
            if (delay !== null) timer = setTimeout(() => void tick(), delay)
        }

        // Tras un salto, la posición nueva se informa enseguida.
        const onSeeked = () => {
            if (timer) clearTimeout(timer)
            timer = null
            held = held && { ...held, version: -1 } // lo cargado ya no tiene por qué cubrir el destino
            void tick()
        }
        video?.addEventListener("seeked", onSeeked)
        void tick()

        return () => {
            useSubtitleLoadStore.getState().setWindowInfo(null)
            cancelled = true
            if (timer) clearTimeout(timer)
            ctrl.abort()
            video?.removeEventListener("seeked", onSeeked)
        }
    }, [active, path, videoRef])

    return refreshKey
}
