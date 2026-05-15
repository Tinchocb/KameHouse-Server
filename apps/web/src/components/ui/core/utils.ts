import type * as React from "react"

export function mergeRefs<T>(
    refs: Array<React.MutableRefObject<T> | React.LegacyRef<T> | undefined | null>,
): React.RefCallback<T> {
    return (value) => {
        refs.forEach((ref) => {
            if (typeof ref === "function") {
                ref(value)
            } else if (ref != null) {
                (ref as React.MutableRefObject<T | null>).current = value
            }
        })
    }
}

export const isEmpty = (obj: unknown): boolean => {
    if (obj === null || obj === undefined) return true
    if (Array.isArray(obj)) return obj.length === 0
    if (typeof obj === 'object') return Object.keys(obj).length === 0
    return false
}

