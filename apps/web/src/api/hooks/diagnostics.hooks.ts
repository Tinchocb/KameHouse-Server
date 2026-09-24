import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { EXTRA_ENDPOINTS } from "@/api/client/endpoints.extra"
import { getServerBaseUrl } from "@/api/client/server-url"
import { toast } from "sonner"

export function useGetLogFilenames(enabled = true) {
    return useServerQuery<string[]>({
        endpoint: EXTRA_ENDPOINTS.LOGS.Filenames.endpoint,
        method: "GET",
        queryKey: [EXTRA_ENDPOINTS.LOGS.Filenames.key],
        enabled,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        muteError: true,
    })
}

export function useGetLogContent(filename: string | null) {
    return useServerQuery<string>({
        endpoint: filename
            ? `${EXTRA_ENDPOINTS.LOGS.ByName.endpoint}/${encodeURIComponent(filename)}`
            : EXTRA_ENDPOINTS.LOGS.Latest.endpoint,
        method: "GET",
        queryKey: filename
            ? [EXTRA_ENDPOINTS.LOGS.ByName.key, filename]
            : [EXTRA_ENDPOINTS.LOGS.Latest.key],
        enabled: true,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        muteError: true,
    })
}

export function useDeleteLogs() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, { filenames: string[] }>({
        endpoint: EXTRA_ENDPOINTS.LOGS.Delete.endpoint,
        method: "DELETE",
        mutationKey: [EXTRA_ENDPOINTS.LOGS.Delete.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [EXTRA_ENDPOINTS.LOGS.Filenames.key] })
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
            const url = new URL(EXTRA_ENDPOINTS.DIAGNOSTICS.Report.endpoint, base || window.location.origin)
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
