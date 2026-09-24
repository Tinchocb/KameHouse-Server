import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { buildSeaQuery } from "@/api/client/requests"
import type { DriveScanProgress } from "@/lib/server/ws-events"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

/** Excluida del persister (ver query-persister.ts): es estado efímero. */
export const DRIVE_STATUS_QUERY_KEY = ["google-drive-status"] as const

export interface DriveStatusResponse {
    connected: boolean
    userEmail?: string
    displayName?: string
    folderId?: string
    folderName?: string
    indexedEpisodes: number
    isScanning?: boolean
    error?: string
    /** Snapshot del escaneo en curso (o del último) desde que arrancó el servidor. */
    progress?: DriveScanProgress
}

async function fetchDriveStatus(): Promise<DriveStatusResponse> {
    const res = await buildSeaQuery<DriveStatusResponse | { data?: DriveStatusResponse }>({
        endpoint: API_ENDPOINTS.DRIVE.DriveStatus.endpoint,
        method: API_ENDPOINTS.DRIVE.DriveStatus.methods[0],
    })
    if (!res) return { connected: false, indexedEpisodes: 0 }
    if ("data" in res && res.data) return res.data
    return res as DriveStatusResponse
}

export function useDriveStatus() {
    return useQuery({
        queryKey: DRIVE_STATUS_QUERY_KEY,
        queryFn: fetchDriveStatus,
        // El progreso llega por WS (drive_scan_progress); el poll de 5s durante el
        // escaneo es solo red de seguridad si el socket se cae.
        refetchInterval: (query) => (query.state.data?.isScanning ? 5000 : 30000),
    })
}

/** Lanza un escaneo de Drive con la carpeta ya guardada en ajustes. */
export function useTriggerDriveScan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => buildSeaQuery({ endpoint: API_ENDPOINTS.DRIVE.DriveScan.endpoint, method: API_ENDPOINTS.DRIVE.DriveScan.methods[0] }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY }),
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : "No se pudo iniciar el escaneo de Drive")
        },
    })
}
