'use no memo'
import { useCallback, useRef, useState } from "react"

/**
 * Estado de React con un ref espejo que se actualiza en el mismo paso. Los
 * callbacks calientes (timeupdate, timers) leen el ref y no se quedan con un
 * valor viejo por cierre; la interfaz se renderiza con el estado.
 * El setter es estable: no cambia entre renders.
 */
export function useMirroredState<T>(initial: T) {
    const [value, setValueState] = useState<T>(initial)
    const ref = useRef<T>(initial)
    const setValue = useCallback((next: T) => {
        ref.current = next
        setValueState(next)
    }, [])
    return [value, setValue, ref] as const
}
