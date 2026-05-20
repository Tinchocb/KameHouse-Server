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
            <div className="flex items-end gap-6 group/label cursor-default w-fit">
                {index && (
                    <span className="font-bebas text-5xl md:text-6xl text-white/[0.03] transition-all duration-500 group-hover/label:text-brand-orange/10 group-hover/label:scale-105 leading-[0.8] -mb-1 select-none">
                        {typeof index === 'number' ? index.toString().padStart(2, '0') : index}
                    </span>
                )}
                
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15 shadow-sm shadow-brand-orange/5">
                            <Icon className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                        </div>
                        <span className="text-[0.6rem] font-black uppercase tracking-[0.35em] text-zinc-500 group-hover/label:text-zinc-400 transition-colors duration-300">
                            DESCUBRE
                        </span>
                        <span className="relative flex h-1.5 w-1.5 -ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                        </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <h2 className="text-3xl md:text-4xl font-bebas tracking-wide text-white/95 leading-[0.9] group-hover/label:text-white transition-colors duration-300 uppercase">
                            {label}
                        </h2>
                        {/* Dynamic gradient underlining micro-animation */}
                        <div className="h-[2px] w-8 bg-gradient-to-r from-brand-orange/30 to-transparent rounded-full group-hover/label:w-full group-hover/label:from-brand-orange/70 transition-all duration-500 ease-out" />
                    </div>
                </div>
            </div>
        </div>
    )
}

