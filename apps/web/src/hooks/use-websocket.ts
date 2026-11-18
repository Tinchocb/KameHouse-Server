import { useLayoutEffect, useRef } from 'react'
import useReactUseWebSocket from 'react-use-websocket'
import { getWebSocketProtocols } from '@/api/client/auth'

import { isWebSocketMessage, WebSocketMessage } from '@/lib/server/ws-events'

interface UseWebSocketReturn {
    sendJsonMessage: (message: WebSocketMessage | { type: string; payload: unknown }) => void
}

export function useWebSocket(url: string, onMessage?: (data: WebSocketMessage) => void): UseWebSocketReturn {
    const onMessageRef = useRef(onMessage)
    
    useLayoutEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])

    const { sendJsonMessage } = useReactUseWebSocket(url, {
        protocols: getWebSocketProtocols(),
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
