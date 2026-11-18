import { useMediaQuery } from "./use-media-query"

/** Preferencia reactiva, compartida y actualizable sin recargar la aplicación. */
export function useReducedMotion(): boolean {
    return useMediaQuery("(prefers-reduced-motion: reduce)")
}
