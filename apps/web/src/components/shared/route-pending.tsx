import { LoadingSpinner } from "@/components/ui/loading-spinner"

/**
 * Pending por defecto del router: solo aparece si la navegación supera
 * defaultPendingMs (800ms), por ejemplo con un chunk lento o el prefetch
 * bloqueante de la ficha de serie. Indicador neutro a propósito: un skeleton
 * con forma de grid no coincidiría con la ruta destino y, en las fichas,
 * se sumaría al skeleton propio de la vista.
 */
export function RoutePending() {
    return (
        <div role="status" aria-label="Cargando" className="min-h-[60vh] flex items-center justify-center animate-fade-in">
            <LoadingSpinner iconClass="w-7 h-7 mr-0 text-on-surface-variant/60" />
        </div>
    )
}
