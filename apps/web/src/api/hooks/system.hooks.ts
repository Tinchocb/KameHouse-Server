import { useState } from "react"
import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { EXTRA_ENDPOINTS } from "@/api/client/endpoints.extra"
import { getServerBaseUrl } from "@/api/client/server-url"
import { toast } from "sonner"

export interface DatabaseBackupResult {
    path: string
    sizeBytes: number
    createdAt: string
}

export function useBackupDatabase() {
    return useServerMutation<DatabaseBackupResult, void>({
        endpoint: API_ENDPOINTS.SYSTEM.BackupDatabase.endpoint,
        method: API_ENDPOINTS.SYSTEM.BackupDatabase.methods[0],
        mutationKey: [API_ENDPOINTS.SYSTEM.BackupDatabase.key],
    })
}

/** Descarga el último backup (flujo: POST backup → GET download). */
export function useDownloadDatabaseBackup() {
    const [isDownloading, setIsDownloading] = useState(false)

    const download = async () => {
        if (isDownloading) return
        setIsDownloading(true)
        try {
            const base = getServerBaseUrl()
            const url = new URL(EXTRA_ENDPOINTS.BACKUP.Download.endpoint, base || window.location.origin)
            const res = await fetch(url.toString(), { method: "GET", credentials: "include" })
            if (!res.ok) throw new Error(`Backup falló con ${res.status}`)
            const blob = await res.blob()
            const disposition = res.headers.get("Content-Disposition") ?? ""
            const match = /filename="([^"]+)"/.exec(disposition)
            const name = match?.[1] ?? `kamehouse-backup-${Date.now()}.db`
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = objectUrl
            a.download = name
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
            toast.success("Respaldo descargado")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo descargar el respaldo")
        } finally {
            setIsDownloading(false)
        }
    }

    return { download, isDownloading }
}
