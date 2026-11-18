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
        // Nadie lee lastMessage: sin esto, cada mensaje del socket compartido re-renderizaba el componente
        // que usa el hook. onMessage corre antes del filtro, así que sigue recibiendo todos los mensajes.
        filter: () => false,
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
