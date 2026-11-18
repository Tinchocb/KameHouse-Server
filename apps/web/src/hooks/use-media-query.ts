import { useMemo, useSyncExternalStore } from "react"

interface MediaStore {
    subscribe: (notify: () => void) => () => void
    snapshot: () => boolean
}
// These queries come from application breakpoints/preferences. Share the native
// listener across cards, navigation and theme consumers instead of per render.
const stores = new Map<string, MediaStore>()

function storeFor(query: string): MediaStore {
    const existing = stores.get(query)
    if (existing) return existing
    let media: MediaQueryList | undefined
    const listeners = new Set<() => void>()
    const getMedia = () => media ??= window.matchMedia(query)
    const notify = () => { for (const listener of listeners) listener() }
    const store: MediaStore = {
        subscribe(listener) {
            const mql = getMedia()
            if (!listeners.size) mql.addEventListener("change", notify)
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
                if (!listeners.size) {
                    mql.removeEventListener("change", notify)
                    media = undefined
                }
            }
        },
        snapshot: () => getMedia().matches,
    }
    stores.set(query, store)
    return store
}

export function useMediaQuery(query: string, fallback = false): boolean {
    const available = typeof window !== "undefined" && typeof window.matchMedia === "function"
    const store = useMemo(() => available ? storeFor(query) : undefined, [query, available])
    return useSyncExternalStore(
        store?.subscribe ?? emptySubscribe,
        store?.snapshot ?? (() => fallback),
        () => fallback,
    )
}

const emptySubscribe = () => () => {}
