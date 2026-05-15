import * as React from "react"
import { AlertTriangle, FolderOpen, RefreshCcw } from "lucide-react"
import { EmptyState as SharedEmptyState } from "@/components/shared/empty-state"

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
export function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
            <div className="flex items-center gap-6 group/label cursor-default">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/5 bg-zinc-950/40 backdrop-blur-2xl text-zinc-500 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/label:border-primary/20 group-hover/label:text-primary group-hover/label:bg-zinc-900/60 group-hover/label:scale-110">
                    <Icon className="h-6 w-6 stroke-[1.5px]" />
                    {/* Subtle accent glow behind icon */}
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl opacity-0 group-hover/label:opacity-40 transition-opacity duration-700" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[0.65rem] font-black uppercase tracking-[0.4em] text-zinc-600 mb-1 transition-colors group-hover/label:text-zinc-500">
                        EXPLORAR
                    </span>
                    <h2 className="text-3xl font-bebas tracking-widest text-zinc-300 group-hover/label:text-white transition-all duration-500">
                        {label}
                    </h2>
                </div>
            </div>
        </div>
    )
}
