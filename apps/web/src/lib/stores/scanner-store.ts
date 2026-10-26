import { create } from "zustand"
import { subscribeWithSelector, devtools } from "zustand/middleware"
import { type ScannerMessage } from "@/lib/server/ws-events"

export interface ScanEvent extends ScannerMessage {
    /** file: archivo analizado · status: cambio de etapa · detail: mensaje técnico. */
    kind?: "file" | "status" | "detail"
    id: string
    timestamp: number
}

export interface ScannerState {
    isScanning: boolean
    scanProgress: number
    currentScanningFile: string
    events: ScanEvent[]
    lastFinish: ScanEvent | null
    pruneCount: number
    /** Epoch ms del START del escaneo local en curso (o del último). */
    startedAt: number | null
    finishedAt: number | null
    /** Archivo actual / total durante la fase de análisis (eventos PROCESSING). */
    filesCurrent: number
    filesTotal: number
    /** Último SCAN_STATUS del servidor, ya traducido. */
    statusMessage: string
    error: string | null
    setEvents: (events: ScanEvent[] | ((prev: ScanEvent[]) => ScanEvent[])) => void
    setScannerState: (state: Partial<ScannerState>) => void
}

export const useScannerStore = create<ScannerState>()(
    devtools(
        subscribeWithSelector((set) => ({
            isScanning: false,
            scanProgress: 0,
            currentScanningFile: "",
            events: [],
            lastFinish: null,
            pruneCount: 0,
            startedAt: null,
            finishedAt: null,
            filesCurrent: 0,
            filesTotal: 0,
            statusMessage: "",
            error: null,
            setEvents: (events) => set((state) => ({
                events: typeof events === "function" ? events(state.events) : events,
            })),
            setScannerState: (state) => set((s) => ({ ...s, ...state })),
        }))
    )
)
