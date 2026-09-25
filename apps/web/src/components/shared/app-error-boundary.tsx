import { useQueryClient } from "@tanstack/react-query"
import { useLocation, useRouter } from "@tanstack/react-router"
import React from "react"
import { isBackendUnavailableError } from "@/api/client/requests"

interface AppErrorBoundaryProps {
    error: unknown
    resetErrorBoundary?: () => void
    reset?: () => void
}

export function AppErrorBoundary({ error, resetErrorBoundary, reset }: AppErrorBoundaryProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const location = useLocation()

    const initialPathname = React.useRef(location.pathname)
    const doReset = resetErrorBoundary || reset

    const isBackendStarting = isBackendUnavailableError(error)

    React.useEffect(() => {
        // Backend arrancando: no es un error real, no ensuciar la consola.
        if (!isBackendStarting) console.error("AppErrorBoundary caught error:", error);
    }, [error, isBackendStarting])

    React.useEffect(() => {
        if (location.pathname !== initialPathname.current && doReset) {
            doReset()
        }
    }, [location.pathname, doReset])

    const handleReset = () => {
        if (doReset) {
            doReset()
        }
        
        // Detect chunk loading errors (Failed to fetch dynamically imported module)
        const err = error as Error | undefined;
        const isChunkLoadError = err?.name === "ChunkLoadError" ||
                                 err?.message?.toLowerCase().includes("failed to fetch dynamically imported module") ||
                                 err?.message?.toLowerCase().includes("dynamically imported module");
        
        if (isChunkLoadError) {
            window.location.reload();
            return;
        }

        router.invalidate()
        queryClient.invalidateQueries()
    }

    const err = error as Error | undefined;
    const isChunkLoadError = err?.name === "ChunkLoadError" ||
                             err?.message?.toLowerCase().includes("failed to fetch dynamically imported module") ||
                             err?.message?.toLowerCase().includes("dynamically imported module");

    // Backend arrancando: reintentar solo cada 2s hasta que responda.
    React.useEffect(() => {
        if (!isBackendStarting) return
        const id = setTimeout(() => {
            doReset?.()
            router.invalidate()
        }, 2000)
        return () => clearTimeout(id)
    }, [isBackendStarting, error, doReset, router])

    if (isBackendStarting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center max-w-lg mx-auto my-8">
                <div className="w-8 h-8 mb-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <h2 className="text-lg font-display tracking-widest text-white mb-2 uppercase">
                    Iniciando servidor
                </h2>
                <p className="text-on-surface-variant text-sm">
                    El servidor todavía está arrancando. Se reintentará automáticamente.
                </p>
            </div>
        )
    }

    return (
        <div className="sectionbar flex flex-col items-center justify-center min-h-[400px] p-8 text-center max-w-lg mx-auto my-8">
            <h2 className="text-2xl font-display tracking-widest text-white mb-4 uppercase">
                {isChunkLoadError ? "Actualización disponible" : "Error en el cliente"}
            </h2>
            <p className="text-on-surface-variant mb-6 leading-relaxed text-sm max-w-md">
                {isChunkLoadError 
                    ? "La aplicación ha sido actualizada. Haz click para recargar y obtener la última versión." 
                    : "Ha ocurrido un error inesperado en la interfaz que impidió cargar el módulo."}
            </p>
            {!isChunkLoadError && (
                <div className="mb-8 p-4 bg-white/[0.03] border border-white/5 rounded-xl text-left overflow-hidden w-full">
                    <p className="text-status-error font-mono text-xs break-all">
                        {(error as Error)?.message || "Unknown Error"}
                    </p>
                </div>
            )}
            <button
                onClick={handleReset}
                className="px-8 py-3 bg-white text-black font-black text-xs uppercase tracking-ultra rounded-full hover:bg-zinc-200 active:scale-95 transition shadow-elevation-2"
            >
                {isChunkLoadError ? "RECARGAR AHORA" : "REINTENTAR ACCESO"}
            </button>
        </div>
    )
}
