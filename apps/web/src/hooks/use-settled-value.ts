import { useEffect, useState } from "react"

/**
 * Devuelve `value` recién cuando lleva `delayMs` sin cambiar (el valor inicial, al instante).
 * Sirve para reaccionar al final de un gesto continuo, como el scroll, y no a cada paso.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
    const [settled, setSettled] = useState(value)

    useEffect(() => {
        if (Object.is(value, settled)) return
        const timer = setTimeout(() => setSettled(value), delayMs)
        return () => clearTimeout(timer)
    }, [value, settled, delayMs])

    return settled
}
