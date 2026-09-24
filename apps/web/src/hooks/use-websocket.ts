import { useLayoutEffect, useRef } from 'react'
import useReactUseWebSocket from 'react-use-websocket'

import { WebSocketMessage, WSEvents } from '@/lib/server/ws-events'

const KNOWN_WS_TYPES = new Set<string>(Object.values(WSEvents))

function isWebSocketMessage(value: unknown): value is WebSocketMessage {
    if (typeof value !== "object" || value === null) return false
    const v = value as Record<string, unknown>
    return typeof v.type === "string" && KNOWN_WS_TYPES.has(v.type) && "payload" in v
}

interface UseWebSocketReturn {
    sendJsonMessage: (message: WebSocketMessage | { type: string; payload: unknown }) => void
}

export function useWebSocket(url: string, onMessage?: (data: WebSocketMessage) => void): UseWebSocketReturn {
    const onMessageRef = useRef(onMessage)
    
    useLayoutEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])

    const { sendJsonMessage } = useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        retryOnError: true,
        reconnectAttempts: 20,
        reconnectInterval: 3000,
        onMessage: (event) => {
            try {
                const parsed: unknown = JSON.parse(event.data)
                if (!isWebSocketMessage(parsed)) return
                onMessageRef.current?.(parsed)
            } catch {
                // Ignore parsing errors
            }
        },
    })

    return { sendJsonMessage }
}
