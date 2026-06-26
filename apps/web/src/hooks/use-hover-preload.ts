import { useCallback, useEffect, useRef } from "react"

interface UseHoverPreloadOptions {
    delay?: number
    onPreload: (id: string) => void
}

export function useHoverPreload({ delay = 300, onPreload }: UseHoverPreloadOptions) {
    const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach(t => clearTimeout(t))
            timeoutsRef.current.clear()
        }
    }, [])

    const onMouseEnter = useCallback((id: string) => {
        const existing = timeoutsRef.current.get(id)
        if (existing) clearTimeout(existing)

        const timeout = setTimeout(() => {
            onPreload(id)
            timeoutsRef.current.delete(id)
        }, delay)

        timeoutsRef.current.set(id, timeout)
    }, [delay, onPreload])

    const onMouseLeave = useCallback((id: string) => {
        const existing = timeoutsRef.current.get(id)
        if (existing) {
            clearTimeout(existing)
            timeoutsRef.current.delete(id)
        }
    }, [])

    return { onMouseEnter, onMouseLeave }
}
