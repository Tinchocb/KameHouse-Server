import { useCallback, useRef } from 'react'
import useReactUseWebSocket, { SendMessage } from 'react-use-websocket'
import { logger } from '@/lib/helpers/debug'

export interface UseWebSocketReturn {
    sendJsonMessage: SendMessage
    lastMessage: WebSocketEventMap['message'] | null
    readyState: number
}

export function useWebSocket(url: string, onMessage?: (data: any) => void): UseWebSocketReturn {
    const onMessageRef = useRef(onMessage)
    onMessageRef.current = onMessage

    const { sendJsonMessage, lastMessage, readyState } = useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        retryOnError: true,
        reconnectAttempts: 20,
        reconnectInterval: 3000,
        onMessage: (event) => {
            try {
                const parsed = JSON.parse(event.data)
                onMessageRef.current?.(parsed)
            } catch {
                // Ignore parsing errors
            }
        },
    })

    return { sendJsonMessage, lastMessage, readyState }
}
