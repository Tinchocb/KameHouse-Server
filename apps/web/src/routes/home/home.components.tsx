import * as React from "react"
import { AlertTriangle, FolderOpen, RefreshCcw } from "lucide-react"
import { EmptyState as SharedEmptyState } from "@/components/shared/empty-state"
export { ErrorBoundary } from "@/components/shared/app-error-boundary"

/**
 * Banner shown when a library error occurs.
 */
export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex min-h-[100dvh] items-center justify-center -mt-20">
            <SharedEmptyState
                title="CONEXIÓN INTERRUMPIDA"
                message={message}
                illustration={<AlertTriangle className="w-16 h-16 text-rose-500/40" />}
                action={
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-3 px-8 py-3 rounded-full bg-primary text-white font-bebas tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
                        aria-label="Reintentar conexión"
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
        <div className="flex min-h-[100dvh] items-center justify-center -mt-20">
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
export function SectionLabel({ 
    icon: Icon, 
    label, 
    index 
}: { 
    icon: React.ElementType; 
    label: string;
    index?: number | string;
}) {
    return (
        <div className="px-6 md:px-12 lg:px-20 mb-2">
            <div className="flex items-end gap-6 group/label cursor-default">
                {index && (
                    <span className="font-bebas text-5xl md:text-6xl text-white/5 transition-colors group-hover/label:text-primary/10 leading-[0.8] -mb-1">
                        {typeof index === 'number' ? index.toString().padStart(2, '0') : index}
                    </span>
                )}
                
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-primary opacity-80" strokeWidth={2.5} />
                        <span className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-zinc-500">
                            DESCUBRE
                        </span>
                    </div>
                    <div className="flex items-end gap-4">
                        <h2 className="text-3xl md:text-4xl font-bebas tracking-wide text-white/90 leading-[0.9]">
                            {label}
                        </h2>
                    </div>
                </div>
            </div>
        </div>
    )
}

