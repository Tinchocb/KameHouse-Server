import * as React from "react"
import { AlertTriangle, FolderOpen } from "lucide-react"

/**
 * Banner shown when a library error occurs.
 */
export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="max-w-md text-center">
                <AlertTriangle className="mx-auto mb-5 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-3 text-2xl font-semibold uppercase tracking-[0.18em] text-foreground">
                    No se pudo cargar la biblioteca
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{message}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-6 rounded-full border border-border bg-secondary/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-secondary"
                >
                    Reintentar
                </button>
            </div>
        </div>
    )
}

/**
 * Shown when the library is empty.
 */
export function EmptyState() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="max-w-md text-center">
                <FolderOpen className="mx-auto mb-5 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-3 text-2xl font-semibold uppercase tracking-[0.18em] text-foreground">
                    Biblioteca vacía
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                    Aún no hay contenido listo para mostrar. Escanea tus rutas desde configuración.
                </p>
            </div>
        </div>
    )
}

/**
 * A styled label for home sections.
 */
export function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="px-6 md:px-10 lg:px-14">
            <div className="inline-flex items-center gap-3 rounded-full border border-border bg-secondary/50 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-foreground backdrop-blur-xl">
                <Icon className="h-3.5 w-3.5 text-orange-500" />
                {label}
            </div>
        </div>
    )
}
