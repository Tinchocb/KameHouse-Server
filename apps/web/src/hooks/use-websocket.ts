import { useEffect, useRef, useCallback } from "react";

/**
 * useWebSocket - A robust, auto-reconnecting hook to listen for real-time server events via WebSockets.
 * 
 * @param url The WebSocket endpoint to connect to (e.g. `ws://localhost:43213/api/ws`)
 * @param onEventReceived Optional callback triggered when a JSON message is received and successfully parsed
 */
export function useWebSocket(
  url: string, 
  onEventReceived?: (eventData: any) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  // Use a stable reference to onEventReceived to avoid dependency hell
  const onEventReceivedRef = useRef(onEventReceived);
  onEventReceivedRef.current = onEventReceived;

  const connect = useCallback(() => {
    // Prevent duplicate connections or connecting if unmounted
    if (wsRef.current || !isComponentMounted.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug(`[WebSocket] Connected to ${url}`);
        // Clear any pending reconnections once successfully connected
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          if (onEventReceivedRef.current) {
            onEventReceivedRef.current(parsedData);
          }
        } catch (err) {
          console.warn(`[WebSocket] Failed to parse incoming message as JSON:`, event.data);
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        
        // 1000 = Normal closure. Anything else usually indicates a drop or server restart.
        if (event.code !== 1000 && isComponentMounted.current) {
          console.debug(`[WebSocket] Connection closed abruptly. Reconnecting in 3s...`);
          if (!reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              connect();
            }, 3000); // Fixed 3s backoff for simplicity and responsiveness
          }
        } else {
          console.debug(`[WebSocket] Connection closed cleanly.`);
        }
      };

      ws.onerror = (error) => {
        // WebSocket onerror doesn't provide much detail, but we log it anyway
        console.debug(`[WebSocket] Error occurred.`);
        // Note: The onclose event will immediately fire after onerror, managing the reconnect
      };

    } catch (err) {
      console.error(`[WebSocket] Error instantiating WebSocket:`, err);
    }
  }, [url]);

  useEffect(() => {
    isComponentMounted.current = true;
    connect();

    // Strict cleanup function 
    // Triggers on component unmount (or during dev Strict Mode double-invocations)
    return () => {
      isComponentMounted.current = false;
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Optionally expose a manual reconnect method if needed by the consumer
  const triggerReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(); // Triggers onclose which handles the reconnection logic
    } else {
      connect();
    }
  }, [connect]);

  return { triggerReconnect };
}
