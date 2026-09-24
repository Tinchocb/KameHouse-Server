/**
 * Catálogo de eventos websocket manejados por el frontend.
 * Solo incluye los eventos con handler real (websocket-provider,
 * playback-tab, PlaybackSettings). El servidor puede emitir más
 * eventos (playback-manager-*, sync-*, toasts, etc.) pero el cliente
 * los ignora en el `default` del switch.
 */
export const WSEvents = {
    SCAN_PROGRESS: "scan-progress",
    SCAN_PROGRESS_DETAILED: "scan-progress-detailed",
    SCAN_STATUS: "scan-status",
    REFRESHED_ANIME_COLLECTION: "refreshed-anime-collection",

    LIBRARY_WATCHER_FILE_ADDED: "library-watcher-file-added",
    LIBRARY_WATCHER_FILE_REMOVED: "library-watcher-file-removed",
    AUTO_SCAN_COMPLETED: "auto-scan-completed",
    NOTIFICATION_RECEIVED: "notification-received",

    LIBRARY_SCAN: "library.scan",
    SKIP_SCAN_STATUS: "SKIP_SCAN_STATUS",
    SCAN_ERROR: "SCAN_ERROR",
    INVALIDATE_QUERIES: "invalidate-queries",
    SETTINGS: "settings",
    ERROR_TOAST: "error-toast",
    SUCCESS_TOAST: "success-toast",
    VIDEOCORE: "videocore",
    MEDIASHUTDOWN: "mediastream-shutdown-stream",
    DRIVE_SCAN_PROGRESS: "drive_scan_progress",
    DRIVE_SCAN_COMPLETED: "drive_scan_completed",
    LIBRARY_UPDATED: "library_updated",
} as const
export type WSEvents = (typeof WSEvents)[keyof typeof WSEvents]

export interface ScanProgressDetailedPayload {
    stage: string
    fileCount?: number
    skipped?: number
    matched?: number
    unmatched?: number
    totalFiles?: number
    message: string
}

export interface ScannerMessage {
    status: "START" | "PROCESSING" | "FINISH" | "PRUNED"
    current?: number
    total?: number
    file?: string
    // PRUNED event fields
    removed?: number
    // FINISH event fields
    total_processed?: number
    duration_seconds?: number
}

/** Espejo de drive.ScanProgress (apps/server/internal/drive/types.go). */
export type DriveScanPhase = "listing" | "indexing" | "saving" | "pruning" | "done" | "error"

export interface DriveScanItem {
    name: string
    folder: string
    series: string
    episode?: number
    isMovie?: boolean
}

export interface DriveScanProgress {
    phase: DriveScanPhase
    startedAt: string
    finishedAt?: string
    currentFolder: string
    foldersScanned: number
    foldersPending: number
    filesFound: number
    indexed: number
    total: number
    pruned: number
    // Go puede serializar slices nil como null.
    series: { title: string; count: number }[] | null
    /** Todo lo detectado en el escaneo, en orden de detección. */
    items: DriveScanItem[] | null
    error?: string
}

export interface SkipScanStatusPayload {
    mediaId: number
    status: "idle" | "initializing" | "fingerprinting" | "matching" | "done" | "error"
    percent?: number
    message?: string
}

export interface NotificationPayload {
    id: number
    type: string
    title: string
    message: string
    read: boolean
    createdAt?: string
}

export type WebSocketMessage =
    | { type: typeof WSEvents.NOTIFICATION_RECEIVED; payload: NotificationPayload }
    | { type: typeof WSEvents.SCAN_PROGRESS; payload: number }
    | { type: typeof WSEvents.SCAN_PROGRESS_DETAILED; payload: ScanProgressDetailedPayload }
    | { type: typeof WSEvents.SCAN_STATUS; payload: string }
    | { type: typeof WSEvents.SCAN_ERROR; payload: string }
    | { type: typeof WSEvents.INVALIDATE_QUERIES; payload: { queryKeys?: string[] } | null }
    | { type: typeof WSEvents.SETTINGS; payload: unknown }
    | { type: typeof WSEvents.ERROR_TOAST; payload: string }
    | { type: typeof WSEvents.SUCCESS_TOAST; payload: string }
    | { type: typeof WSEvents.VIDEOCORE; payload: { type: string; payload?: unknown; clientID?: string } }
    | { type: typeof WSEvents.MEDIASHUTDOWN; payload: string | null }
    | { type: typeof WSEvents.LIBRARY_WATCHER_FILE_ADDED; payload: string }
    | { type: typeof WSEvents.LIBRARY_WATCHER_FILE_REMOVED; payload: string }
    | { type: typeof WSEvents.AUTO_SCAN_COMPLETED; payload: null }
    | { type: typeof WSEvents.LIBRARY_SCAN; payload: ScannerMessage }
    | { type: typeof WSEvents.REFRESHED_ANIME_COLLECTION; payload: null }
    | { type: typeof WSEvents.SKIP_SCAN_STATUS; payload: SkipScanStatusPayload }
    | { type: typeof WSEvents.DRIVE_SCAN_PROGRESS; payload: DriveScanProgress }
    | { type: typeof WSEvents.DRIVE_SCAN_COMPLETED; payload?: { count?: number; pruned?: number; error?: string } }
    | { type: typeof WSEvents.LIBRARY_UPDATED; payload?: { source?: string; count?: number } }
