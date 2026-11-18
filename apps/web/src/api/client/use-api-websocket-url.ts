import { useSyncExternalStore } from "react"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { AUTH_CHANGED_EVENT, getServerSession } from "./auth"

const PORT_RESOLVED_EVENT = "kamehouse-port-resolved"

function subscribe(onChange: () => void) {
    window.addEventListener(PORT_RESOLVED_EVENT, onChange)
    window.addEventListener(AUTH_CHANGED_EVENT, onChange)
    return () => {
        window.removeEventListener(PORT_RESOLVED_EVENT, onChange)
        window.removeEventListener(AUTH_CHANGED_EVENT, onChange)
    }
}

function snapshot() { return `${getApiWebSocketUrl()}&session=${getServerSession()?.expiresAt ?? 0}` }

/**
 * URL del WebSocket del API que se recalcula cuando el runtime desktop resuelve
 * el puerto del sidecar (evento `kamehouse-port-resolved`, ver main.tsx).
 * Un `useMemo(getApiWebSocketUrl, [])` montado antes de ese evento quedaba
 * apuntando al puerto por defecto toda la sesión.
 */
export function useApiWebSocketUrl(): string {
    return useSyncExternalStore(subscribe, snapshot, snapshot)
}
