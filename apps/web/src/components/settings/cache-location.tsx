import React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { buildApiQuery } from "@/api/client/requests"
import { errorText } from "@/api/client/error-messages"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { INTERNAL_CacheLocation as CacheLocation } from "@/api/generated/types"
import { DirectorySelector } from "@/components/shared/directory-selector"
import { Button } from "@/components/ui/button"

const endpoint = API_ENDPOINTS.CACHE_LOCATION.GetCacheLocation.endpoint

export function CacheLocationField() {
    const queryClient = useQueryClient()
    const [draft, setDraft] = React.useState<string | null>(null)
    const query = useQuery({
        queryKey: ["cache-location"],
        queryFn: async () => {
            const result = await buildApiQuery<CacheLocation>({ endpoint, method: "GET" })
            if (!result) throw new Error("No se pudo consultar la carpeta de caché")
            return result
        },
    })
    const save = useMutation({
        mutationFn: async (directory: string) => {
            const result = await buildApiQuery<CacheLocation, { directory: string }>({
                endpoint, method: "PATCH", data: { directory },
            })
            if (!result) throw new Error("No se pudo guardar la carpeta de caché")
            return result
        },
        onSuccess: (result) => {
            // The field is disabled while saving, so this cannot discard a newer edit.
            queryClient.setQueryData(["cache-location"], result)
            setDraft(null)
            toast.success(result.restartRequired ? "Carpeta guardada. Reinicia KameHouse para usarla." : "Carpeta de caché guardada")
        },
        onError: (err) => toast.error(errorText(err, "No se pudo guardar la carpeta de caché")),
    })
    const location = query.data
    const value = draft ?? location?.directory ?? ""
    const disabled = save.isPending || !location || location.managedByEnvironment

    return (
        <div className="space-y-3 py-3">
            <div className="space-y-1">
                <label htmlFor="cache-directory" className="text-xs font-bold text-on-surface">Carpeta de caché</label>
                <p id="cache-directory-help" className="text-xs text-on-surface-variant">
                    Elige una carpeta dedicada, por ejemplo D:\KameHouse-cache, para guardar bloques de Drive, miniaturas y archivos temporales de video.
                </p>
            </div>
            {query.isError ? (
                <div role="alert" className="space-y-2 text-xs text-on-surface-variant">
                    <p>No se pudo consultar la ubicación de caché.</p>
                    <Button type="button" intent="secondary" size="sm" onClick={() => query.refetch()}>Reintentar</Button>
                </div>
            ) : (
                <>
                    <DirectorySelector
                        id="cache-directory"
                        aria-describedby="cache-directory-help cache-directory-status"
                        value={value}
                        onSelect={(path) => { if (!save.isPending) setDraft(path) }}
                        aria-label="Carpeta de caché"
                        onChange={(event) => setDraft(event.target.value)}
                        disabled={disabled}
                        placeholder={query.isPending ? "Cargando ubicación…" : "D:\\KameHouse-cache"}
                    />
                    <p id="cache-directory-status" role="status" className="text-xs text-on-surface-variant break-words">
                        {location?.managedByEnvironment
                            ? "Esta ubicación está definida por variables de entorno del servidor."
                            : location?.restartRequired
                                ? `Cambio pendiente. Carpeta en uso: ${location.activeDirectory}. Reinicia KameHouse para usar la nueva ubicación.`
                                : "Se aplica al reiniciar. La caché anterior permanece en su carpeta; no se mueve ni se borra automáticamente."}
                    </p>
                    <Button
                        type="button"
                        intent="secondary"
                        size="sm"
                        loading={save.isPending}
                        disabled={disabled || !value.trim() || value === location?.directory}
                        onClick={() => save.mutate(value.trim())}
                    >
                        {save.isPending ? "Guardando…" : "Guardar carpeta"}
                    </Button>
                </>
            )}
        </div>
    )
}
