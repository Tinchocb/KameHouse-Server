import * as React from "react"
import { AlertTriangle, FolderOpen, RefreshCcw } from "lucide-react"
import { EmptyState as SharedEmptyState } from "@/components/shared/empty-state"

/**
 * Banner shown when a library error occurs.
 */
export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center -mt-20">
            <SharedEmptyState
                title="CONEXIÓN INTERRUMPIDA"
                message={message}
                illustration={<AlertTriangle className="w-16 h-16 text-rose-500/40" />}
                action={
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-3 px-8 py-3 rounded-full bg-primary text-white font-bebas tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        REINTENTAR ACCESO
                    </button>
                }
            />
        </div>
    )
}

/**
 * Shown when the library is empty.
 */
export function EmptyState() {
    return (
        <div className="flex min-h-screen items-center justify-center -mt-20">
            <SharedEmptyState
                title="BÓVEDA VACÍA"
                message="Aún no hay contenido listo para mostrar. Escanea tus rutas desde configuración para iniciar la sincronización."
                illustration={<FolderOpen className="w-16 h-16 text-zinc-800" />}
            />
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
