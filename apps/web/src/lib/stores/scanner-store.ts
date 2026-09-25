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
    activeStageIdx: number
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
    setScanning: (isScanning: boolean) => void
    setScanProgress: (progress: number) => void
    setScanningFile: (file: string) => void
    setEvents: (events: ScanEvent[] | ((prev: ScanEvent[]) => ScanEvent[])) => void
    setScannerState: (state: Partial<ScannerState>) => void
    resetScanner: () => void
}

export const useScannerStore = create<ScannerState>()(
    devtools(
        subscribeWithSelector((set) => ({
            isScanning: false,
            scanProgress: 0,
            currentScanningFile: "",
            events: [],
            activeStageIdx: -1,
            lastFinish: null,
            pruneCount: 0,
            startedAt: null,
            finishedAt: null,
            filesCurrent: 0,
            filesTotal: 0,
            statusMessage: "",
            error: null,
            setScanning: (isScanning) => set({ isScanning }),
            setScanProgress: (scanProgress) => set({ scanProgress }),
            setScanningFile: (currentScanningFile) => set({ currentScanningFile }),
            setEvents: (events) => set((state) => ({
                events: typeof events === "function" ? events(state.events) : events,
            })),
            setScannerState: (state) => set((s) => ({ ...s, ...state })),
            resetScanner: () => set({
                isScanning: false,
                scanProgress: 0,
                currentScanningFile: "",
                events: [],
                activeStageIdx: -1,
                lastFinish: null,
                pruneCount: 0,
                startedAt: null,
                finishedAt: null,
                filesCurrent: 0,
                filesTotal: 0,
                statusMessage: "",
                error: null,
            }),
        }))
    )
)
