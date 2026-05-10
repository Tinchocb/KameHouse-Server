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
            <div className="group/label inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5 pr-6 text-[0.75rem] font-black uppercase tracking-[0.2em] text-zinc-100 backdrop-blur-3xl transition-all hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover/label:bg-primary group-hover/label:text-white group-hover/label:rotate-6 group-hover/label:shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="relative">
                    {label}
                    <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-primary transition-all duration-500 group-hover/label:w-full" />
                </span>
            </div>
        </div>
    )
}
