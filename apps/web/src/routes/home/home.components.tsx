import * as React from "react"
import { AlertTriangle, FolderOpen, RefreshCcw, Database, Settings } from "lucide-react"
import { EmptyState as SharedEmptyState } from "@/components/shared/empty-state"
import { useNavigate } from "@tanstack/react-router"
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
    const navigate = useNavigate()
    return (
        <div className="flex min-h-[100dvh] items-center justify-center -mt-20 px-4">
            <SharedEmptyState
                title="BÓVEDA VACÍA"
                message="Aún no hay contenido listo para mostrar. Escanea tus rutas desde configuración para iniciar la sincronización."
                illustration={
                    <div className="relative flex justify-center items-center w-24 h-24 mx-auto mb-2">
                        {/* Outer pulsing ring */}
                        <div className="absolute inset-0 rounded-full border border-brand-orange/10 bg-brand-orange/5 animate-ping opacity-35" />
                        {/* Middle glow */}
                        <div className="absolute w-16 h-16 rounded-full bg-brand-orange/20 blur-md animate-pulse" />
                        {/* Database icon */}
                        <Database className="relative w-12 h-12 text-brand-orange drop-shadow-[0_0_15px_rgba(232,93,46,0.5)]" />
                    </div>
                }
                action={
                    <button
                        type="button"
                        onClick={() => navigate({ to: "/settings" })}
                        className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-brand-orange to-red-600 text-white font-bebas tracking-widest text-sm hover:scale-105 hover:shadow-[0_0_25px_rgba(232,93,46,0.35)] active:scale-95 transition-all"
                        aria-label="Ir a Configuración"
                    >
                        <Settings className="w-4 h-4" />
                        CONFIGURAR RUTAS
                    </button>
                }
            />
        </div>
    )
}
