import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { DeleteLogs_Variables } from "@/api/generated/endpoint.types"
import { getServerBaseUrl } from "@/api/client/server-url"
import { toast } from "sonner"

export function useGetLogFilenames(enabled = true) {
    return useServerQuery<string[]>({
        endpoint: API_ENDPOINTS.STATUS.GetLogFilenames.endpoint,
        method: API_ENDPOINTS.STATUS.GetLogFilenames.methods[0],
        queryKey: [API_ENDPOINTS.STATUS.GetLogFilenames.key],
        enabled,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        muteError: true,
    })
}

export function useGetLogContent(filename: string | null) {
    return useServerQuery<string>({
        endpoint: filename
            ? API_ENDPOINTS.STATUS.GetLogContent.endpoint.replace("{filename}", encodeURIComponent(filename))
            : API_ENDPOINTS.STATUS.GetLatestLogContent.endpoint,
        method: "GET",
        queryKey: filename
            ? [API_ENDPOINTS.STATUS.GetLogContent.key, filename]
            : [API_ENDPOINTS.STATUS.GetLatestLogContent.key],
        enabled: true,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        muteError: true,
    })
}

export function useDeleteLogs() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, DeleteLogs_Variables>({
        endpoint: API_ENDPOINTS.STATUS.DeleteLogs.endpoint,
        method: API_ENDPOINTS.STATUS.DeleteLogs.methods[0],
        mutationKey: [API_ENDPOINTS.STATUS.DeleteLogs.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetLogFilenames.key] })
            toast.success("Logs eliminados")
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "No se pudieron eliminar los logs")
        },
    })
}

export function useDownloadDiagnosticsReport() {
    const [isDownloading, setIsDownloading] = useState(false)

    const download = async () => {
        if (isDownloading) return
        setIsDownloading(true)
        try {
            const base = getServerBaseUrl()
            const url = new URL(API_ENDPOINTS.SYSTEM.GetDiagnosticsReport.endpoint, base || window.location.origin)
            const res = await fetch(url.toString(), { method: "GET", credentials: "include" })
            if (!res.ok) throw new Error(`Report falló con ${res.status}`)
            const blob = await res.blob()
            const disposition = res.headers.get("Content-Disposition") ?? ""
            const match = /filename="([^"]+)"/.exec(disposition)
            const name = match?.[1] ?? `kamehouse-diagnostics-${Date.now()}.zip`
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = objectUrl
            a.download = name
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
            toast.success("Reporte descargado")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo descargar el reporte")
        } finally {
            setIsDownloading(false)
        }
    }

    return { download, isDownloading }
}
