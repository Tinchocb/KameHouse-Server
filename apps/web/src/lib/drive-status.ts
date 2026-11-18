import { errorText } from "@/api/client/error-messages"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { buildApiQuery } from "@/api/client/requests"
import type { DriveScanProgress } from "@/lib/server/ws-events"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

/** Excluida del persister (ver query-persister.ts): es estado efímero. */
export const DRIVE_STATUS_QUERY_KEY = ["google-drive-status"] as const

export interface DriveStatusResponse {
    /** OAuth application is provisioned; no credentials need to be entered. */
    oauthConfigured?: boolean
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
    /** Escaneo automático: si está encendido, cada cuántos minutos y cuándo es el próximo. */
    autoSync?: boolean
    scanIntervalMinutes?: number
    nextScanAt?: string
}

/** Carpeta de Drive tal como la devuelve el selector. */
export interface DriveFolderEntry {
    id: string
    name: string
}

export interface DriveFoldersResponse {
    parentId: string
    /** Migas de pan desde Mi unidad hasta parentId (incluida). */
    path: DriveFolderEntry[]
    folders: DriveFolderEntry[]
}

export interface DriveSelectFolderResult {
    folderId: string
    folderName: string
    scanStarted: boolean
}

export interface DriveSyncPatch {
    disableAutoSync?: boolean
    scanIntervalMinutes?: number
}

/** "root" es el alias de Mi unidad en la API de Drive. */
export const DRIVE_ROOT_FOLDER_ID = "root"

async function fetchDriveStatus(): Promise<DriveStatusResponse> {
    const res = await buildApiQuery<DriveStatusResponse | { data?: DriveStatusResponse }>({
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
        staleTime: 30 * 1000,
        // El progreso llega por WS (drive_scan_progress); el poll de 5s durante el
        // escaneo es solo red de seguridad si el socket se cae.
        refetchInterval: (query) => (query.state.data?.isScanning ? 5000 : 30000),
    })
}

/** Lanza un escaneo de Drive con la carpeta ya guardada en ajustes. */
export function useTriggerDriveScan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () =>
            buildApiQuery({ endpoint: API_ENDPOINTS.DRIVE.DriveScan.endpoint, method: API_ENDPOINTS.DRIVE.DriveScan.methods[0] }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY }),
        onError: (err: unknown) => {
            toast.error(errorText(err, "No se pudo iniciar el escaneo de Drive"))
        },
    })
}

async function fetchDriveFolders(parentId: string): Promise<DriveFoldersResponse> {
    const res = await buildApiQuery<DriveFoldersResponse | { data?: DriveFoldersResponse }, { parentId: string }>({
        endpoint: API_ENDPOINTS.DRIVE_FOLDERS.DriveFolders.endpoint,
        method: API_ENDPOINTS.DRIVE_FOLDERS.DriveFolders.methods[0],
        params: { parentId },
    })
    if (!res) throw new Error("Google Drive no devolvió las carpetas")
    if ("data" in res && res.data) return res.data
    return res as DriveFoldersResponse
}

/** Subcarpetas de una carpeta de Drive para el selector. Solo se pide con el selector abierto. */
export function useDriveFolders(parentId: string) {
    return useQuery({
        queryKey: ["google-drive-folders", parentId],
        queryFn: () => fetchDriveFolders(parentId),
        enabled: Boolean(parentId),
        staleTime: 60 * 1000,
    })
}

/** Guarda la carpeta de la biblioteca (ID o enlace) y arranca un escaneo. */
export function useSelectDriveFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (folderId: string) => {
            const res = await buildApiQuery<DriveSelectFolderResult | { data?: DriveSelectFolderResult }, { folderId: string }>({
                endpoint: API_ENDPOINTS.DRIVE_FOLDERS.DriveSelectFolder.endpoint,
                method: API_ENDPOINTS.DRIVE_FOLDERS.DriveSelectFolder.methods[0] as "PUT",
                data: { folderId },
            })
            if (!res) throw new Error("Google Drive no confirmó la carpeta")
            if ("data" in res && res.data) return res.data
            return res as DriveSelectFolderResult
        },
        onSuccess: (result) => {
            toast.success("Carpeta guardada", {
                description: result.scanStarted
                    ? `Escaneando «${result.folderName}»…`
                    : `«${result.folderName}» se escaneará en breve.`,
            })
            queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
        onError: (err: unknown) => {
            toast.error(errorText(err, "No se pudo guardar la carpeta de Drive"))
        },
    })
}

/** Cambia la sincronización automática (PATCH parcial de los ajustes de Drive). */
export function useUpdateDriveSync() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (patch: DriveSyncPatch) =>
            buildApiQuery<unknown, { googleDrive: DriveSyncPatch }>({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: { googleDrive: patch },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
        onError: (err: unknown) => {
            toast.error(errorText(err, "No se pudo guardar la sincronización de Drive"))
        },
    })
}

const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

/** Hora relativa en español: "hace 5 minutos", "dentro de 2 horas". */
export function formatRelativeEs(at: Date, now: number = Date.now()): string {
    const seconds = Math.round((at.getTime() - now) / 1000)
    const abs = Math.abs(seconds)
    if (abs < 60) return relativeTime.format(seconds, "second")
    if (abs < 3600) return relativeTime.format(Math.round(seconds / 60), "minute")
    if (abs < 86400) return relativeTime.format(Math.round(seconds / 3600), "hour")
    return relativeTime.format(Math.round(seconds / 86400), "day")
}
