import { useCallback, useEffect, useRef, useState } from "react"
import { buildApiQuery } from "@/api/client/requests"
import {
    DRIVE_SUBTITLES_ENDPOINTS,
    isDrivePath,
    statusFromApiError,
    toDriveStatus,
    type DriveSubtitlesResponse,
} from "./drive-subtitles"
import { useSubtitleLoadStore } from "./subtitle-load-store"

const POLL_MS = 1500

interface Options {
    /** Ruta gdrive:// del episodio (props.streamUrl). */
    path: string | undefined
    /** El servidor listó pistas embebidas pendientes de extraer. */
    hasPending: boolean
}

/**
 * Extracción bajo demanda de los subtítulos embebidos de un archivo de Google Drive.
 *
 * Sacar las pistas obliga a leer el archivo entero una vez, así que nunca arranca sola:
 * la dispara el botón del panel. El progreso y las acciones se publican en
 * useSubtitleLoadStore para el panel; acá se devuelve lo que necesita el orquestador
 * para habilitar las pistas y las fuentes cuando termina.
 */
export function useDriveSubtitleExtraction({ path, hasPending }: Options) {
    const [fonts, setFonts] = useState<string[]>([])
    const [done, setDone] = useState(false)
    const activePath = isDrivePath(path) ? path : undefined

    // Cambió el episodio: lo extraído del anterior no aplica.
    const [prevPath, setPrevPath] = useState(activePath)
    if (prevPath !== activePath) {
        setPrevPath(activePath)
        setDone(false)
        setFonts([])
    }

    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const aborter = useRef<AbortController | null>(null)

    const stopPolling = useCallback(() => {
        if (pollTimer.current) clearTimeout(pollTimer.current)
        pollTimer.current = null
        aborter.current?.abort()
        aborter.current = null
    }, [])

    const apply = useCallback((res: DriveSubtitlesResponse | undefined) => {
        const status = toDriveStatus(res)
        useSubtitleLoadStore.getState().setDrive(status)
        if (status.state === "done") {
            setFonts(res?.fonts ?? [])
            setDone(true)
        }
        return status.state
    }, [])

    const poll = useCallback((target: string) => {
        stopPolling()
        const ctrl = new AbortController()
        aborter.current = ctrl
        const tick = async () => {
            try {
                const res = await buildApiQuery<DriveSubtitlesResponse, { path: string }>({
                    endpoint: DRIVE_SUBTITLES_ENDPOINTS.status,
                    method: "GET",
                    params: { path: target },
                    signal: ctrl.signal,
                })
                if (ctrl.signal.aborted) return
                const state = apply(res)
                if (state === "queued" || state === "running") {
                    pollTimer.current = setTimeout(tick, POLL_MS)
                }
            } catch (err) {
                if (ctrl.signal.aborted) return
                useSubtitleLoadStore.getState().setDrive(statusFromApiError(err))
            }
        }
        void tick()
    }, [apply, stopPolling])

    const extract = useCallback(async () => {
        if (!activePath) return
        useSubtitleLoadStore.getState().setDrive({ state: "queued", percent: 0 })
        try {
            const res = await buildApiQuery<DriveSubtitlesResponse, { path: string }>({
                endpoint: DRIVE_SUBTITLES_ENDPOINTS.extract,
                method: "POST",
                data: { path: activePath },
            })
            const state = apply(res)
            if (state === "queued" || state === "running") poll(activePath)
            else if (state === "done") poll(activePath) // un GET más trae las fuentes
        } catch (err) {
            useSubtitleLoadStore.getState().setDrive(statusFromApiError(err))
        }
    }, [activePath, apply, poll])

    const cancel = useCallback(async () => {
        if (!activePath) return
        stopPolling()
        try {
            await buildApiQuery<boolean, { path: string }>({
                endpoint: DRIVE_SUBTITLES_ENDPOINTS.cancel,
                method: "POST",
                data: { path: activePath },
            })
        } catch {
            // Si falla, el siguiente estado del servidor corrige la interfaz.
        }
        useSubtitleLoadStore.getState().setDrive({ state: "none", percent: 0 })
    }, [activePath, stopPolling])

    // Publica el origen y las acciones para el panel.
    useEffect(() => {
        const store = useSubtitleLoadStore.getState()
        store.setSource(activePath ? "drive" : "local")
        store.setDriveActions(activePath ? { extract: () => void extract(), cancel: () => void cancel() } : null)
        return () => {
            useSubtitleLoadStore.getState().setDriveActions(null)
        }
    }, [activePath, extract, cancel])

    // Hay pistas pendientes: si ya hay una extracción en curso (otra pestaña, o se
    // salió y volvió al episodio), retomar el seguimiento.
    useEffect(() => {
        if (!activePath || !hasPending) return
        poll(activePath)
        return stopPolling
    }, [activePath, hasPending, poll, stopPolling])

    // Episodio nuevo: estado limpio del panel.
    useEffect(() => {
        useSubtitleLoadStore.getState().setDrive({ state: "none", percent: 0 })
        return () => {
            stopPolling()
        }
    }, [activePath, stopPolling])

    return { driveSubtitlesReady: done, driveFonts: fonts }
}
