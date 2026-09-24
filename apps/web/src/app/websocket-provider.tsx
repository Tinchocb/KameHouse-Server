
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { WebSocketMessage, WSEvents, ScannerMessage } from "@/lib/server/ws-events"
import { isScanCompletedStatus, translateScanStatus } from "@/lib/server/scan-status"
import { DRIVE_STATUS_QUERY_KEY, type DriveStatusResponse } from "@/lib/drive-status"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useScannerStore, type ScanEvent, type ScannerState } from "@/lib/stores/scanner-store"
import React, { useCallback, useEffect, useRef } from "react"
import useWebSocket from "react-use-websocket"
import { buildSeaQuery } from "@/api/client/requests"

function safeId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        return [...crypto.getRandomValues(new Uint8Array(16))]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient()
    const setEvents = useScannerStore(state => state.setEvents)
    const setScannerState = useScannerStore(state => state.setScannerState)

    // Batching queues for throttling updates to at most once per 500ms
    const eventQueue = useRef<ScanEvent[]>([])
    const stateUpdateRef = useRef<Partial<ScannerState>>({})
    const flushTimeout = useRef<NodeJS.Timeout | null>(null)
    const invalidationTimeout = useRef<NodeJS.Timeout | null>(null)

    const debouncedInvalidateLibrary = useCallback(() => {
        if (invalidationTimeout.current) clearTimeout(invalidationTimeout.current)
        invalidationTimeout.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
            invalidationTimeout.current = null
        }, 1200)
    }, [queryClient])

    // Dynamically resolve WebSocket URL from the base URL and update if Tauri resolves port
    const [wsUrl, setWsUrl] = React.useState(() => getApiWebSocketUrl())

    useEffect(() => {
        const handlePortResolved = () => {
            setWsUrl(getApiWebSocketUrl())
        }
        window.addEventListener("kamehouse-port-resolved", handlePortResolved)
        return () => window.removeEventListener("kamehouse-port-resolved", handlePortResolved)
    }, [])

    // Exponential backoff with cap and jitter for WS reconnection
    // Base: 3s, max: 30s, with ±25% jitter to avoid thundering herd
    const reconnectInterval = React.useCallback((attempt: number) => {
        const base = 3000
        const max = 30000
        const exponential = Math.min(base * Math.pow(1.5, attempt), max)
        const jitter = exponential * 0.25 * (Math.random() * 2 - 1) // ±25%
        return Math.floor(exponential + jitter)
    }, [])

    // No abrir el socket hasta que el backend responda a /status: evita la
    // ráfaga de "connection refused" mientras el sidecar arranca. Se sondea en
    // vivo (no con useGetStatus) porque esa query se restaura desde IndexedDB
    // y daría "listo" con datos de la sesión anterior.
    const [isBackendReady, setIsBackendReady] = React.useState(false)
    useEffect(() => {
        let cancelled = false
        const probe = async () => {
            while (!cancelled) {
                try {
                    await buildSeaQuery({ endpoint: API_ENDPOINTS.STATUS.GetStatus.endpoint, method: "GET" })
                    if (!cancelled) setIsBackendReady(true)
                    return
                } catch {
                    await new Promise(resolve => setTimeout(resolve, 1500))
                }
            }
        }
        void probe()
        return () => { cancelled = true }
    }, [])

    const { lastJsonMessage, sendJsonMessage } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: Infinity,
        reconnectInterval,
        share: true, // Allow multiple hooks to share this connection
        onOpen: () => {
        },
        onError: () => {
            // Silencioso: ERR_CONNECTION_REFUSED es esperado mientras el servidor arranca.
            // react-use-websocket ya maneja el reconectar automáticamente.
        },
    }, isBackendReady)

    const flushUpdates = useCallback(() => {
        // Flush events array
        if (eventQueue.current.length > 0) {
            const newEvents = [...eventQueue.current]
            eventQueue.current = []
            setEvents(prev => [...newEvents, ...prev].slice(0, 5000))
        }
        
        // Flush simple states
        const updates = stateUpdateRef.current
        stateUpdateRef.current = {}
        
        if (Object.keys(updates).length > 0) {
            setScannerState(updates)
        }
        
        flushTimeout.current = null
    }, [setEvents, setScannerState])

    /** Acumula cambios del store del escáner; se aplican en lote cada 500ms. */
    const queueState = useCallback((updates: Partial<ScannerState>) => {
        stateUpdateRef.current = { ...stateUpdateRef.current, ...updates }
        if (!flushTimeout.current) flushTimeout.current = setTimeout(flushUpdates, 500)
    }, [flushUpdates])

    /**
     * Marca el inicio de un escaneo local. START no siempre llega (p. ej. si la
     * pestaña se abrió a mitad de escaneo), así que cualquier evento de progreso
     * con el escáner inactivo también abre una sesión nueva.
     */
    const beginLocalScan = useCallback((force = false) => {
        const pendingScanning = stateUpdateRef.current.isScanning
        const running = pendingScanning ?? useScannerStore.getState().isScanning
        if (running && !force) return
        queueState({
            isScanning: true,
            scanProgress: 0,
            currentScanningFile: "",
            statusMessage: "",
            pruneCount: 0,
            lastFinish: null,
            startedAt: Date.now(),
            finishedAt: null,
            filesCurrent: 0,
            filesTotal: 0,
            error: null,
        })
        if (!running) setEvents([])
    }, [queueState, setEvents])

    // Heartbeat loop
    useEffect(() => {
        const interval = setInterval(() => {
            sendJsonMessage({ type: "ping", payload: { timestamp: Date.now() } })
        }, 25000)
        return () => {
            clearInterval(interval)
            if (flushTimeout.current) clearTimeout(flushTimeout.current)
            if (invalidationTimeout.current) clearTimeout(invalidationTimeout.current)
        }
    }, [sendJsonMessage])

    useEffect(() => {
        if (!lastJsonMessage || typeof lastJsonMessage !== "object") return

        const msg = lastJsonMessage as WebSocketMessage

        // Respeta los toggles de Sistema > Notificaciones para avisos flotantes.
        // La invalidación de queries/campana sigue siempre (sincroniza estado, no flota).
        const isToastMuted = (scannerOnly: boolean) => {
            const settings = queryClient.getQueryData<{
                notifications?: {
                    disableNotifications?: boolean
                    disableAutoScannerNotifications?: boolean
                }
            }>([API_ENDPOINTS.SETTINGS.GetSettings.key])
            const notif = settings?.notifications
            if (notif?.disableNotifications) return true
            if (scannerOnly && notif?.disableAutoScannerNotifications) return true
            return false
        }

        switch (msg.type) {
            case WSEvents.AUTO_SCAN_COMPLETED:
            case WSEvents.LIBRARY_WATCHER_FILE_ADDED:
            case WSEvents.LIBRARY_WATCHER_FILE_REMOVED:
            case WSEvents.REFRESHED_ANIME_COLLECTION:
                debouncedInvalidateLibrary()
                break
                
            case WSEvents.LIBRARY_SCAN: {
                const data = msg.payload as ScannerMessage
                const evt: ScanEvent = {
                    ...data,
                    kind: data.status === "PROCESSING" ? "file" : "status",
                    timestamp: Date.now(),
                    id: safeId()
                }
                eventQueue.current.unshift(evt)

                switch (data.status) {
                    case "START":
                        beginLocalScan(true)
                        break
                    case "PROCESSING":
                        beginLocalScan()
                        queueState({
                            isScanning: true,
                            currentScanningFile: data.file || "",
                            ...(data.total ? { filesCurrent: data.current ?? 0, filesTotal: data.total } : {}),
                        })
                        break
                    case "PRUNED":
                        queueState({ pruneCount: data.removed ?? 0 })
                        break
                    case "FINISH":
                        queueState({
                            isScanning: false,
                            scanProgress: 100,
                            lastFinish: evt,
                            finishedAt: Date.now(),
                        })
                        debouncedInvalidateLibrary()
                        break
                }
                break
            }

            case WSEvents.SCAN_PROGRESS: {
                const pct = msg.payload as number
                if (pct < 100) beginLocalScan()
                queueState({ isScanning: true, scanProgress: pct })
                break
            }

            case WSEvents.SCAN_PROGRESS_DETAILED: {
                const payload = msg.payload
                eventQueue.current.unshift({
                    status: "PROCESSING",
                    kind: "detail",
                    file: payload.message || "",
                    timestamp: Date.now(),
                    id: `detail-${safeId()}`
                })
                queueState({ isScanning: true })
                break
            }

            case WSEvents.SCAN_STATUS: {
                const statusStr = msg.payload as string
                const done = isScanCompletedStatus(statusStr)
                const message = translateScanStatus(statusStr)
                eventQueue.current.unshift({
                    status: done ? "FINISH" : "PROCESSING",
                    kind: "status",
                    file: message,
                    timestamp: Date.now(),
                    id: `status-${safeId()}`
                })

                if (done) {
                    queueState({
                        isScanning: false,
                        scanProgress: 100,
                        statusMessage: message,
                        finishedAt: Date.now(),
                    })
                    debouncedInvalidateLibrary()
                } else {
                    beginLocalScan()
                    queueState({ isScanning: true, statusMessage: message })
                }
                break
            }

            // Progreso en vivo del escaneo de Drive: se escribe directo en la query de
            // status para que cualquier vista suscripta lo pinte sin polling.
            case WSEvents.DRIVE_SCAN_PROGRESS: {
                const progress = msg.payload
                const running = progress.phase !== "done" && progress.phase !== "error"
                queryClient.setQueryData<DriveStatusResponse>(DRIVE_STATUS_QUERY_KEY, (prev) =>
                    prev ? { ...prev, isScanning: running, progress } : prev
                )
                break
            }

            case WSEvents.DRIVE_SCAN_COMPLETED: {
                queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY })
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
                debouncedInvalidateLibrary()
                const payload = msg.payload
                if (payload?.error) {
                    if (!isToastMuted(true)) toast.error("Error al escanear Google Drive", { description: payload.error })
                } else if (!isToastMuted(true)) {
                    const pruned = payload?.pruned ? ` · ${payload.pruned} eliminados` : ""
                    toast.success("Google Drive escaneado", { description: `${payload?.count ?? 0} episodios indexados${pruned}` })
                }
                break
            }

            case WSEvents.LIBRARY_UPDATED:
                debouncedInvalidateLibrary()
                break

            case WSEvents.NOTIFICATION_RECEIVED: {
                const n = msg.payload
                queryClient.invalidateQueries({
                    queryKey: [API_ENDPOINTS.NOTIFICATIONS.GetNotifications.key]
                })
                if (n?.title) {
                    const settings = queryClient.getQueryData<{
                        notifications?: {
                            disableNotifications?: boolean
                            disableAutoScannerNotifications?: boolean
                        }
                    }>([API_ENDPOINTS.SETTINGS.GetSettings.key])
                    const notif = settings?.notifications
                    if (notif?.disableNotifications) break
                    if (n?.type === "scanner" && notif?.disableAutoScannerNotifications) break
                    toast(n.title, { description: n.message })
                }
                break
            }

            case WSEvents.SCAN_ERROR: {
                const message = typeof msg.payload === "string" ? msg.payload : "Error en el escaneo"
                queueState({
                    isScanning: false,
                    currentScanningFile: message,
                    error: message,
                    finishedAt: Date.now(),
                })
                if (!isToastMuted(true)) toast.error(message)
                break
            }

            case WSEvents.INVALIDATE_QUERIES: {
                const payload = msg.payload as { queryKeys?: string[] } | null
                const keys = payload?.queryKeys ?? []
                if (keys.some((k) => k.toLowerCase().includes("skip"))) {
                    queryClient.invalidateQueries({
                        predicate: (q) =>
                            q.queryKey.some(
                                (k) => typeof k === "string" && k.toLowerCase().includes("aniskip")
                            ),
                    })
                } else {
                    debouncedInvalidateLibrary()
                }
                break
            }

            case WSEvents.SETTINGS: {
                queryClient.invalidateQueries({
                    queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key],
                })
                queryClient.invalidateQueries({
                    queryKey: [API_ENDPOINTS.STATUS.GetStatus.key],
                })
                break
            }

            case WSEvents.ERROR_TOAST: {
                const message = typeof msg.payload === "string" ? msg.payload : "Error del servidor"
                if (!isToastMuted(false)) toast.error(message)
                break
            }

            case WSEvents.SUCCESS_TOAST: {
                const message = typeof msg.payload === "string" ? msg.payload : ""
                if (message && !isToastMuted(false)) toast.success(message)
                break
            }

            case WSEvents.VIDEOCORE: {
                const inner = msg.payload as { type?: string; payload?: unknown }
                if (inner?.type === "show-message") {
                    const p = inner.payload as { message?: string } | undefined
                    if (p?.message && !isToastMuted(false)) toast(p.message)
                } else if (inner?.type === "terminate") {
                    if (!isToastMuted(false)) toast.error("Reproducción terminada por el servidor")
                    queryClient.invalidateQueries({
                        queryKey: [API_ENDPOINTS.ADMIN.GetTranscodeStats.key],
                    })
                }
                break
            }

            case WSEvents.MEDIASHUTDOWN: {
                const payload = msg.payload as string | null
                if (typeof payload === "string" && payload && !isToastMuted(false)) {
                    toast.error(payload)
                }
                queryClient.invalidateQueries({
                    queryKey: [API_ENDPOINTS.ADMIN.GetTranscodeStats.key],
                })
                break
            }

            default:
                break
        }
    }, [lastJsonMessage, queryClient, debouncedInvalidateLibrary, queueState, beginLocalScan])

    return <>{children}</>
}
