"use client"

import { getServerBaseUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { queryClient } from "@/app/client-providers"
import React, { useEffect, useMemo } from "react"
import useWebSocket from "react-use-websocket"

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    // Dynamically resolve WebSocket URL from the base URL
    const wsUrl = useMemo(() => {
        const base = getServerBaseUrl()
        if (base.startsWith("http://")) return base.replace("http://", "ws://") + "/api/v1/ws"
        if (base.startsWith("https://")) return base.replace("https://", "wss://") + "/api/v1/ws"
        return "ws://127.0.0.1:43211/api/v1/ws"
    }, [])

    const { lastJsonMessage } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
        share: true, // Allow multiple hooks to share this connection if needed later
    })

    useEffect(() => {
        if (!lastJsonMessage || typeof lastJsonMessage !== 'object') return

        const msg = lastJsonMessage as { type?: string }
        const eventType = msg.type

        if (
            eventType === "auto-scan-completed" ||
            eventType === "library-watcher-file-added" ||
            eventType === "library-watcher-file-removed"
        ) {
            queryClient.invalidateQueries({
                queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key]
            })
        }
    }, [lastJsonMessage])

    return <>{children}</>
}
