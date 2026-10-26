import { useQueryClient } from "@tanstack/react-query"
import { useLocation, useRouter } from "@tanstack/react-router"
import React from "react"
import { isBackendUnavailableError } from "@/api/client/requests"
import { Button } from "@/components/ui/button"

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
                <h2 className="type-title text-on-surface mb-2 text-balance">
                    Iniciando el servidor
                </h2>
                <p className="text-on-surface-variant text-sm">
                    KameHouse todavía está arrancando. Volverá a intentarlo solo.
                </p>
            </div>
        )
    }

    return (
        <div className="sectionbar flex flex-col items-center justify-center min-h-[400px] p-8 text-center max-w-lg mx-auto my-8">
            <h2 className="type-title text-on-surface mb-4 text-balance">
                {isChunkLoadError ? "Actualización disponible" : "Algo salió mal"}
            </h2>
            <p className="text-on-surface-variant mb-6 leading-relaxed text-sm max-w-md text-pretty">
                {isChunkLoadError 
                    ? "KameHouse se actualizó. Recarga la página para usar la última versión." 
                    : "Ocurrió un error inesperado y no se pudo mostrar esta pantalla. Puedes reintentar; si sigue pasando, revisa los registros en Administración."}
            </p>
            {!isChunkLoadError && (
                <details className="mb-8 w-full text-left group/details">
                    <summary className="cursor-pointer text-xs text-on-surface-variant select-none mb-2">
                        Detalles técnicos
                    </summary>
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
                        <p className="text-status-error font-mono text-xs break-all">
                            {(error as Error)?.message || "Error desconocido"}
                        </p>
                    </div>
                </details>
            )}
            <Button intent="primary" size="lg" onClick={handleReset}>
                {isChunkLoadError ? "Recargar" : "Reintentar"}
            </Button>
        </div>
    )
}
