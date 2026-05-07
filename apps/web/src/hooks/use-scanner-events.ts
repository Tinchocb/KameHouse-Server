import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { useAppStore } from "@/lib/store"
import { useQueryClient } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { WSEvents, type ScannerMessage } from "@/lib/server/ws-events"

export interface ScanEvent {
    status: ScannerMessage["status"]
    current?: number
    total?: number
    file?: string
    removed?: number
    total_processed?: number
    duration_seconds?: number
    timestamp: number
}

export function useScannerEvents() {
    const queryClient = useQueryClient()
    const { isScanning, scanProgress, currentScanningFile, setScanning, setScanProgress, setScanningFile } = useAppStore()
    
    const [events, setEvents] = useState<(ScanEvent & { id: string })[]>([])
    const [activeStageIdx, setActiveStageIdx] = useState<number>(-1)
    const [lastFinish, setLastFinish] = useState<ScanEvent | null>(null)
    const [pruneCount, setPruneCount] = useState<number>(0)

    const wsUrl = useMemo(() => getApiWebSocketUrl(), [])
    
    // Batching queues for throttling updates to at most once per 500ms
    const eventQueue = useRef<(ScanEvent & { id: string })[]>([])
    const stateUpdateRef = useRef<{
        activeStageIdx?: number
        lastFinish?: ScanEvent | null
        pruneCount?: number
        isScanning?: boolean
        scanProgress?: number
        scanningFile?: string
    }>({})
    const flushTimeout = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        return () => {
            if (flushTimeout.current) {
                clearTimeout(flushTimeout.current)
            }
        }
    }, [])
    
    const flushUpdates = useCallback(() => {
        // Flush events array
        if (eventQueue.current.length > 0) {
            const newEvents = [...eventQueue.current]
            eventQueue.current = []
            setEvents(prev => [...newEvents, ...prev].slice(0, 200))
        }
        
        // Flush simple states
        const updates = stateUpdateRef.current
        stateUpdateRef.current = {}
        
        if (updates.activeStageIdx !== undefined) setActiveStageIdx(updates.activeStageIdx)
        if (updates.lastFinish !== undefined) setLastFinish(updates.lastFinish)
        if (updates.pruneCount !== undefined) setPruneCount(updates.pruneCount)
        if (updates.isScanning !== undefined) setScanning(updates.isScanning)
        if (updates.scanProgress !== undefined) setScanProgress(updates.scanProgress)
        if (updates.scanningFile !== undefined) setScanningFile(updates.scanningFile)
        
        flushTimeout.current = null
    }, [setScanning, setScanProgress, setScanningFile])

    useWebSocket(wsUrl, (eventData: any) => {
        if (!eventData || typeof eventData !== "object" || eventData.type !== WSEvents.LIBRARY_SCAN) return
        
        const data = eventData.payload as ScannerMessage
        const evt: ScanEvent & { id: string } = {
            ...data,
            timestamp: Date.now(),
            id: Math.random().toString(36).substring(2, 9) + Date.now()
        }
        
        // Add to batch queue
        eventQueue.current.unshift(evt)
        
        // Accumulate state updates
        switch (data.status) {
            case "START":
                stateUpdateRef.current.activeStageIdx = 0
                stateUpdateRef.current.pruneCount = 0
                stateUpdateRef.current.lastFinish = null
                stateUpdateRef.current.isScanning = true
                stateUpdateRef.current.scanProgress = 0
                break
            case "PROCESSING":
                stateUpdateRef.current.activeStageIdx = 2
                stateUpdateRef.current.scanningFile = data.file || ""
                if (data.total && data.current) {
                    stateUpdateRef.current.scanProgress = (data.current / data.total) * 100
                }
                break
            case "PRUNED":
                stateUpdateRef.current.activeStageIdx = 5
                stateUpdateRef.current.pruneCount = data.removed ?? 0
                break
            case "FINISH":
                stateUpdateRef.current.activeStageIdx = -1
                stateUpdateRef.current.lastFinish = evt
                stateUpdateRef.current.isScanning = false
                stateUpdateRef.current.scanProgress = 100
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key] })
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
                break
        }
        
        // Schedule flush every 500ms
        if (!flushTimeout.current) {
            flushTimeout.current = setTimeout(flushUpdates, 500)
        }
    })

    return { isScanning, scanProgress, scanningFile: currentScanningFile, events, activeStageIdx, lastFinish, pruneCount }
}
