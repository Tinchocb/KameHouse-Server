import { useEffect, useRef } from 'react'
import useReactUseWebSocket from 'react-use-websocket'

import { WebSocketMessage } from '@/lib/server/ws-events'

export interface UseWebSocketReturn {
    sendJsonMessage: (message: WebSocketMessage | { type: string; payload: unknown }) => void
    lastMessage: WebSocketEventMap['message'] | null
    readyState: number
}

export function useWebSocket(url: string, onMessage?: (data: WebSocketMessage) => void): UseWebSocketReturn {
    const onMessageRef = useRef(onMessage)
    
    useEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])

    const { sendJsonMessage, lastMessage, readyState } = useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        retryOnError: true,
        reconnectAttempts: 20,
        reconnectInterval: 3000,
        onMessage: (event) => {
            try {
                const parsed = JSON.parse(event.data) as WebSocketMessage
                onMessageRef.current?.(parsed)
            } catch {
                // Ignore parsing errors
            }
        },
    })

    return { sendJsonMessage, lastMessage, readyState }
}
