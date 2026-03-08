import { SeaWebsocketEvent, SeaWebsocketPluginEvent } from "./queries.types"

type WsCallback<TData> = (data: TData, extensionId?: string) => void

class WSEventDispatcher {
    private listeners = new Map<string, Set<WsCallback<any>>>()

    subscribe<TData>(type: string, callback: WsCallback<TData>) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set())
        }
        this.listeners.get(type)!.add(callback)

        return () => {
            const typeListeners = this.listeners.get(type)
            if (typeListeners) {
                typeListeners.delete(callback)
                if (typeListeners.size === 0) {
                    this.listeners.delete(type)
                }
            }
        }
    }

    dispatch(rawEvent: MessageEvent) {
        try {
            const parsed = JSON.parse(rawEvent.data) as SeaWebsocketEvent<any>
            if (!parsed.type) return

            if (parsed.type === "plugin") {
                const pluginMsg = parsed.payload as SeaWebsocketPluginEvent<any>
                
                // Handle batch events
                if (pluginMsg.type === "plugin:batch-events" && pluginMsg.payload?.events) {
                    for (const event of pluginMsg.payload.events) {
                        this.triggerListeners(event.type, event.payload, event.extensionId)
                    }
                    return
                }

                // Handle regular plugin events
                this.triggerListeners(pluginMsg.type, pluginMsg.payload, pluginMsg.extensionId)
                return
            }

            // Normal events
            this.triggerListeners(parsed.type, parsed.payload)
        } catch (e) {
            // Unparseable or non-JSON message, ignore
        }
    }

    private triggerListeners(type: string, payload: any, extensionId?: string) {
        const typeListeners = this.listeners.get(type)
        if (typeListeners) {
            typeListeners.forEach(cb => cb(payload, extensionId))
        }
    }
}

export const wsDispatcher = new WSEventDispatcher()
