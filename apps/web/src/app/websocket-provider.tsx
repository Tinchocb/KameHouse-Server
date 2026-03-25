"use client"

import { getServerBaseUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { WebSocketMessage, WSEvents } from "@/lib/server/ws-events"
import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useMemo } from "react"
import useWebSocket from "react-use-websocket"

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient()

    // Dynamically resolve WebSocket URL from the base URL
    const wsUrl = useMemo(() => {
        const base = getServerBaseUrl()
        if (base.startsWith("http://")) return base.replace("http://", "ws://") + "/api/v1/ws"
        if (base.startsWith("https://")) return base.replace("https://", "wss://") + "/api/v1/ws"
        if (base === "" && typeof window !== "undefined") {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
            return `${protocol}//${window.location.host}/api/v1/ws`
        }
        return "ws://127.0.0.1:43211/api/v1/ws"
    }, [])

    const { lastJsonMessage, sendJsonMessage } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
        share: true, // Allow multiple hooks to share this connection
    })

    // Heartbeat loop to keep the WebSocket goroutine on the server alive
    useEffect(() => {
        const interval = setInterval(() => {
            sendJsonMessage({ type: "ping", payload: { timestamp: Date.now() } })
        }, 25000)
        return () => clearInterval(interval)
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
                
            case WSEvents.SCAN_PROGRESS:
            case WSEvents.SCAN_PROGRESS_DETAILED:
            case WSEvents.SCAN_STATUS:
                // Intentionally ignored for react-query. 
                // These high-frequency ephemeral updates are to be handled by Zustand directly (to be implemented)
                break
                
            // Declarative mapping to allow easy addition of future WS event listeners
            default:
                break
        }
    }, [lastJsonMessage, queryClient])

    return <>{children}</>
}
