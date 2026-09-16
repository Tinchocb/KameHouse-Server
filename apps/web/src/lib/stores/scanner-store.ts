import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

export interface ScanEvent {
    type: "start" | "progress" | "complete" | "error"
    message: string
    timestamp: number
    progress?: number
    total?: number
    filePath?: string
}

export interface ScannerState {
    isScanning: boolean
    scanProgress: number
    scanTotal: number
    scanMessage: string
    scanEvents: ScanEvent[]
    events: ScanEvent[]
    lastScanAt: number | null
    currentScanningFile: string | null
    setIsScanning: (scanning: boolean) => void
    setScanProgress: (progress: number, total: number) => void
    setScanMessage: (message: string) => void
    addScanEvent: (event: ScanEvent) => void
    clearScanEvents: () => void
    setLastScanAt: (timestamp: number) => void
    setCurrentScanningFile: (file: string | null) => void
}

export const useScannerStore = create<ScannerState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    isScanning: false,
                    scanProgress: 0,
                    scanTotal: 0,
                    scanMessage: "",
                    scanEvents: [],
                    events: [],
                    lastScanAt: null,
                    currentScanningFile: null,
                    setIsScanning: (scanning) => set({ isScanning: scanning }),
                    setScanProgress: (progress, total) => set({ scanProgress: progress, scanTotal: total }),
                    setScanMessage: (message) => set({ scanMessage: message }),
                    addScanEvent: (event) => set((state) => {
                        const newEvents = [...state.scanEvents.slice(-99), event]
                        return { scanEvents: newEvents, events: newEvents }
                    }),
                    clearScanEvents: () => set({ scanEvents: [], events: [] }),
                    setLastScanAt: (timestamp) => set({ lastScanAt: timestamp }),
                    setCurrentScanningFile: (file) => set({ currentScanningFile: file }),
                }),
                {
                    name: "kamehouse-scanner-settings",
                    partialize: (state) => ({
                        isScanning: state.isScanning,
                        lastScanAt: state.lastScanAt,
                    }),
                }
            )
        )
    )
)