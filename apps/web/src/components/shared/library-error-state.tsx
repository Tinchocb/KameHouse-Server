import { Link } from "@tanstack/react-router"
import { ApiError } from "@/api/client/requests"
import { Button, ButtonAnatomy } from "@/components/ui/button"
import { IconStatusGhost } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { EmptyState } from "./empty-state"

interface LibraryErrorStateProps {
    onRetry: () => void
    title?: string
    /** Mensaje fijo; si se omite se elige según el error. */
    message?: string
    /** Error de la consulta: distingue "el servidor no respondió" de "el servidor falló" (5xx). */
    error?: unknown
}

const NETWORK_MESSAGE = "No pudimos conectar con el servidor. Revisa que KameHouse esté en marcha e inténtalo de nuevo."
const SERVER_MESSAGE = "El servidor tuvo un problema al responder. Inténtalo de nuevo; si sigue pasando, revisa los registros en Administración."

/** Un 5xx real (no 502/503/504 transitorios de arranque): el servidor sí respondió, pero falló. */
function isServerFault(error: unknown): boolean {
    return error instanceof ApiError && error.status >= 500
}

/**
 * Error de carga de la biblioteca (red/servidor caído). Distinto del "vacío": la colección
 * no llegó, no es que no tenga contenido. Reintenta sin recargar toda la app.
 */
export function LibraryErrorState({
    onRetry,
    title = "No pudimos cargar tu biblioteca",
    message,
    error,
}: LibraryErrorStateProps) {
    const serverFault = isServerFault(error)
    const text = message ?? (serverFault ? SERVER_MESSAGE : NETWORK_MESSAGE)
    return (
        <div role="alert" className="min-h-[60vh] flex items-center justify-center px-4 pt-nav">
            <EmptyState
                title={title}
                headingLevel="h1"
                message={text}
                icon={<IconStatusGhost className="h-10 w-10 text-status-error" />}
                action={
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button intent="primary" size="lg" onClick={onRetry}>
                            Reintentar
                        </Button>
                        {serverFault && (
                            <Link
                                to="/admin"
                                data-intent="outline"
                                data-size="lg"
                                className={cn(
                                    ButtonAnatomy.root({ intent: "outline", size: "lg" }),
                                    "transition-[transform,background-color,border-color,color,box-shadow,filter] duration-fast ease-out-strong motion-safe:active:scale-[0.97]"
                                )}
                            >
                                Ver registros
                            </Link>
                        )}
                    </div>
                }
            />
        </div>
    )
}
