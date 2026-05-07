import useReactUseWebSocket from 'react-use-websocket'

export function useWebSocket(url: string, onMessage: (data: any) => void) {
    useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        onMessage: (event) => {
            try {
                const parsed = JSON.parse(event.data)
                onMessage(parsed)
            } catch {
                // Ignore parsing errors
            }
        }
    })
}
