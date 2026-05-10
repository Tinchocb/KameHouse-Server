"use client"

import { getApiWebSocketUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { WebSocketMessage, WSEvents, ScannerMessage } from "@/lib/server/ws-events"
import { useQueryClient } from "@tanstack/react-query"
import { useAppStore, type ScanEvent, type ScannerState } from "@/lib/store"
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import useWebSocket from "react-use-websocket"

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient()
    const { setEvents, setScannerState } = useAppStore()

    // Batching queues for throttling updates to at most once per 500ms
    const eventQueue = useRef<ScanEvent[]>([])
    const stateUpdateRef = useRef<Partial<ScannerState>>({})
    const flushTimeout = useRef<NodeJS.Timeout | null>(null)

    // Dynamically resolve WebSocket URL from the base URL
    const wsUrl = useMemo(() => getApiWebSocketUrl(), [])

    useEffect(() => {
        // #region agent log
        fetch("http://127.0.0.1:7388/ingest/59444eed-3244-4eff-9af9-1a415cd6fe6d", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "72d13e" },
            body: JSON.stringify({
                sessionId: "72d13e",
                runId: "pre-fix",
                hypothesisId: "H5",
                location: "websocket-provider.tsx:wsUrl",
                message: "WebSocket URL resolved",
                data: {
                    wsUrl,
                    pageOrigin: typeof window !== "undefined" ? window.location.origin : "",
                    pageHost: typeof window !== "undefined" ? window.location.host : "",
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
    }, [wsUrl])

    const { lastJsonMessage, sendJsonMessage } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
        share: true, // Allow multiple hooks to share this connection
        onOpen: () => {
            // #region agent log
            fetch("http://127.0.0.1:7388/ingest/59444eed-3244-4eff-9af9-1a415cd6fe6d", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "72d13e" },
                body: JSON.stringify({
                    sessionId: "72d13e",
                    runId: "pre-fix",
                    hypothesisId: "H5",
                    location: "websocket-provider.tsx:onOpen",
                    message: "WebSocket opened",
                    data: { wsUrl },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        },
        onError: (event) => {
            // #region agent log
            const t = event?.target
            const readyState =
                t && typeof WebSocket !== "undefined" && t instanceof WebSocket ? t.readyState : -1
            fetch("http://127.0.0.1:7388/ingest/59444eed-3244-4eff-9af9-1a415cd6fe6d", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "72d13e" },
                body: JSON.stringify({
                    sessionId: "72d13e",
                    runId: "pre-fix",
                    hypothesisId: "H5",
                    location: "websocket-provider.tsx:onError",
                    message: "WebSocket error event",
                    data: { wsUrl, readyState, eventType: event?.type ?? "unknown" },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        },
    })

    const flushUpdates = useCallback(() => {
        // Flush events array
        if (eventQueue.current.length > 0) {
            const newEvents = [...eventQueue.current]
            eventQueue.current = []
            setEvents(prev => [...newEvents, ...prev].slice(0, 200))
        }
        
        // Flush simple states
        const updates = stateUpdateRef.current
        stateUpdateRef.current = {}
        
        if (Object.keys(updates).length > 0) {
            setScannerState(updates)
        }
        
        flushTimeout.current = null
    }, [setEvents, setScannerState])

    // Heartbeat loop
    useEffect(() => {
        const interval = setInterval(() => {
            sendJsonMessage({ type: "ping", payload: { timestamp: Date.now() } })
        }, 25000)
        return () => {
            clearInterval(interval)
            if (flushTimeout.current) clearTimeout(flushTimeout.current)
        }
    }, [sendJsonMessage])

    useEffect(() => {
        if (!lastJsonMessage || typeof lastJsonMessage !== "object") return

        const msg = lastJsonMessage as WebSocketMessage

        switch (msg.type) {
            case WSEvents.AUTO_SCAN_COMPLETED:
            case WSEvents.LIBRARY_WATCHER_FILE_ADDED:
            case WSEvents.LIBRARY_WATCHER_FILE_REMOVED:
                queryClient.invalidateQueries({
                    queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key]
                })
                break
                
            case WSEvents.LIBRARY_SCAN: {
                const data = msg.payload as ScannerMessage
                const evt: ScanEvent = {
                    ...data,
                    timestamp: Date.now(),
                    id: Math.random().toString(36).substring(2, 9) + Date.now()
                }
                
                // Add to batch queue
                eventQueue.current.unshift(evt)
                
                // Accumulate state updates
                switch (data.status) {
                    case "START":
                        stateUpdateRef.current = {
                            ...stateUpdateRef.current,
                            isScanning: true,
                            scanProgress: 0,
                            currentScanningFile: "",
                            activeStageIdx: 0,
                            pruneCount: 0,
                            lastFinish: null
                        }
                        break
                    case "PROCESSING":
                        stateUpdateRef.current = {
                            ...stateUpdateRef.current,
                            isScanning: true,
                            currentScanningFile: data.file || "",
                            activeStageIdx: 2
                        }
                        if (data.total && data.current) {
                            stateUpdateRef.current.scanProgress = (data.current / data.total) * 100
                        }
                        break
                    case "PRUNED":
                        stateUpdateRef.current = {
                            ...stateUpdateRef.current,
                            activeStageIdx: 5,
                            pruneCount: data.removed ?? 0
                        }
                        break
                    case "FINISH":
                        stateUpdateRef.current = {
                            ...stateUpdateRef.current,
                            isScanning: false,
                            scanProgress: 100,
                            activeStageIdx: -1,
                            lastFinish: evt
                        }
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key] })
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
                        break
                }
                
                // Schedule flush every 500ms
                if (!flushTimeout.current) {
                    flushTimeout.current = setTimeout(flushUpdates, 500)
                }
                break
            }
                
            case WSEvents.SCAN_PROGRESS:
                stateUpdateRef.current = {
                    ...stateUpdateRef.current,
                    isScanning: true,
                    scanProgress: msg.payload as number
                }
                if (!flushTimeout.current) flushTimeout.current = setTimeout(flushUpdates, 500)
                break

            case WSEvents.SCAN_PROGRESS_DETAILED: {
                const payload = msg.payload
                const evt: ScanEvent = {
                    status: "PROCESSING",
                    file: payload.message || "",
                    timestamp: Date.now(),
                    id: `legacy-${Math.random().toString(36).substring(2, 9)}`
                }
                eventQueue.current.unshift(evt)
                stateUpdateRef.current = {
                    ...stateUpdateRef.current,
                    isScanning: true,
                    currentScanningFile: payload.message || ""
                }
                if (!flushTimeout.current) flushTimeout.current = setTimeout(flushUpdates, 500)
                break
            }

            case WSEvents.SCAN_STATUS:
                if (msg.payload === "finished") {
                    stateUpdateRef.current = {
                        ...stateUpdateRef.current,
                        isScanning: false,
                        scanProgress: 100
                    }
                    if (!flushTimeout.current) flushTimeout.current = setTimeout(flushUpdates, 500)
                }
                break
                
            default:
                break
        }
    }, [lastJsonMessage, queryClient, flushUpdates])

    return <>{children}</>
}
