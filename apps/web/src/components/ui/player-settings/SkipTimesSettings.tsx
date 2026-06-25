import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useSkipTimesStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { Play, Save, Trash2 } from "lucide-react"
import { buildSeaQuery } from "@/api/client/requests"
import { useQueryClient } from "@tanstack/react-query"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { WSEvents } from "@/lib/server/ws-events"

interface SkipTimesSettingsProps {
    videoRef?: React.RefObject<HTMLVideoElement | null>
    malId?: number | null
    duration?: number
    mediaId?: number
    episodeNumber?: number
    onClose: () => void
}


export function SkipTimesSettings({
    videoRef,
    malId,
    duration,
    mediaId,
    episodeNumber,
    onClose,
}: SkipTimesSettingsProps) {
    const queryClient = useQueryClient()
    const { seriesSkipTimes, saveSeriesSkipTimes } = useSkipTimesStore(
        useShallow((state) => ({
            seriesSkipTimes: state.seriesSkipTimes,
            saveSeriesSkipTimes: state.saveSeriesSkipTimes,
        }))
    )

    const storeKey = malId || mediaId
    const seriesData = storeKey ? seriesSkipTimes[String(storeKey)] : null

    // Initial state setup from stored series data
    const [opStart, setOpStart] = React.useState<number | null>(seriesData?.opStart && seriesData.opStart > 0 ? seriesData.opStart : null)
    const [opEnd, setOpEnd] = React.useState<number | null>(seriesData?.opEnd && seriesData.opEnd > 0 ? seriesData.opEnd : null)
    
    // In store, edOffset is duration - edStart. We reconstruct edStart and edEnd.
    const [edStart, setEdStart] = React.useState<number | null>(
        seriesData?.edOffset && duration ? duration - seriesData.edOffset : null
    )
    const [edEnd, setEdEnd] = React.useState<number | null>(
        seriesData?.edEnd && seriesData.edEnd > 0 ? seriesData.edEnd : null
    )
    const [edEndIsEpisodeEnd, setEdEndIsEpisodeEnd] = React.useState<boolean>(
        !(seriesData?.edEnd && seriesData.edEnd > 0)
    )

    const handleMinChange = (
        value: string,
        currentVal: number | null,
        setter: (val: number | null) => void
    ) => {
        const cleanVal = value.replace(/\D/g, "")
        if (cleanVal === "") {
            const currentSec = currentVal !== null ? currentVal % 60 : null
            if (currentSec === null || currentSec === 0) {
                setter(null)
            } else {
                setter(currentSec)
            }
        } else {
            const min = Math.max(0, parseInt(cleanVal) || 0)
            const currentSec = currentVal !== null ? currentVal % 60 : 0
            setter(min * 60 + currentSec)
        }
    }

    const handleSecChange = (
        value: string,
        currentVal: number | null,
        setter: (val: number | null) => void
    ) => {
        const cleanVal = value.replace(/\D/g, "")
        if (cleanVal === "") {
            const currentMin = currentVal !== null ? Math.floor(currentVal / 60) : null
            if (currentMin === null || currentMin === 0) {
                setter(null)
            } else {
                setter(currentMin * 60)
            }
        } else {
            let sec = Math.max(0, parseInt(cleanVal) || 0)
            if (sec > 59) sec = 59
            const currentMin = currentVal !== null ? Math.floor(currentVal / 60) : 0
            setter(currentMin * 60 + sec)
        }
    }

    const [activeTab, setActiveTab] = React.useState<"intro" | "outro">("intro")
    const [applyToSeason, setApplyToSeason] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)

    const [scanStatus, setScanStatus] = React.useState<{
        status: "idle" | "initializing" | "fingerprinting" | "matching" | "done" | "error"
        percent?: number
        message?: string
    }>({ status: "idle" })

    const wsUrl = React.useMemo(() => getApiWebSocketUrl(), [])
    useWebSocket(wsUrl, (msg) => {
        if (msg.type === WSEvents.SKIP_SCAN_STATUS && msg.payload) {
            const payload = msg.payload
            if (payload.mediaId === mediaId) {
                setScanStatus({
                    status: payload.status,
                    percent: payload.percent,
                    message: payload.message,
                })
                if (payload.status === "done") {
                    queryClient.invalidateQueries({ queryKey: ["aniskip"] })
                    // Reset back to idle after a few seconds
                    setTimeout(() => {
                        setScanStatus({ status: "idle" })
                    }, 4000)
                }
            }
        }
    })

    const handleAutoScan = async () => {
        if (!mediaId) return
        try {
            setScanStatus({ status: "initializing", message: "Iniciando..." })
            await buildSeaQuery({
                endpoint: "/api/v1/mediastream/skip-times/scan",
                method: "POST",
                data: {
                    mediaId,
                }
            })
        } catch (err) {
            console.error("Failed to trigger skip times scan:", err)
            setScanStatus({ status: "error", message: "Error al iniciar escaneo" })
        }
    }

    const handleMarkOpStart = () => {
        if (videoRef?.current) {
            setOpStart(Math.round(videoRef.current.currentTime * 100) / 100)
        }
    }

    const handleMarkOpEnd = () => {
        if (videoRef?.current) {
            setOpEnd(Math.round(videoRef.current.currentTime * 100) / 100)
        }
    }

    const handleMarkEdStart = () => {
        if (videoRef?.current) {
            setEdStart(Math.round(videoRef.current.currentTime * 100) / 100)
        }
    }

    const handleMarkEdEnd = () => {
        if (videoRef?.current) {
            const time = Math.round(videoRef.current.currentTime * 100) / 100
            setEdEnd(time)
            setEdEndIsEpisodeEnd(false)
        }
    }

    const handleSave = async () => {
        if ((!malId && !mediaId) || !episodeNumber) return
        setIsSaving(true)

        const resolvedOpStart = opStart ?? 0
        const resolvedOpEnd = opEnd ?? 0
        
        let resolvedEdOffset = 0
        let resolvedEdEnd = 0
        if (edStart !== null && duration && duration > 0) {
            resolvedEdOffset = Math.max(0, duration - edStart)
            if (edEndIsEpisodeEnd) {
                resolvedEdEnd = duration
            } else if (edEnd !== null && edEnd > 0) {
                resolvedEdEnd = edEnd
            }
        }

        try {
            // 1. Save to local Zustand store
            const storeKey = malId || mediaId
            if (storeKey) {
                saveSeriesSkipTimes(storeKey, resolvedOpStart, resolvedOpEnd, resolvedEdOffset, resolvedEdEnd)
            }

            // 2. Save to KameHouse server database
            await buildSeaQuery({
                endpoint: "/api/v1/mediastream/skip-times",
                method: "POST",
                data: {
                    mediaId: mediaId || undefined,
                    malId: malId || undefined,
                    episodeNumber,
                    opStart: resolvedOpStart,
                    opEnd: resolvedOpEnd,
                    edOffset: resolvedEdOffset,
                    edEnd: resolvedEdEnd,
                    applyToSeason,
                }
            })

            // 3. Invalidate React Query cache to instantly redraw timeline and skip-flags
            queryClient.invalidateQueries({ queryKey: ["aniskip"] })
            
            onClose()
        } catch (err) {
            console.error("Failed to save skip times to server:", err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleClear = async () => {
        if ((!malId && !mediaId) || !episodeNumber) return
        setIsSaving(true)

        setOpStart(null)
        setOpEnd(null)
        setEdStart(null)
        setEdEnd(null)
        setEdEndIsEpisodeEnd(true)

        try {
            // 1. Clear local Zustand store
            const storeKey = malId || mediaId
            if (storeKey) {
                saveSeriesSkipTimes(storeKey, 0, 0, 0, 0)
            }

            // 2. Clear on KameHouse server database
            await buildSeaQuery({
                endpoint: "/api/v1/mediastream/skip-times",
                method: "POST",
                data: {
                    mediaId: mediaId || undefined,
                    malId: malId || undefined,
                    episodeNumber,
                    opStart: 0,
                    opEnd: 0,
                    edOffset: 0,
                    edEnd: 0,
                    applyToSeason: false,
                }
            })

            // 3. Invalidate query cache
            queryClient.invalidateQueries({ queryKey: ["aniskip"] })
        } catch (err) {
            console.error("Failed to clear skip times on server:", err)
        } finally {
            setIsSaving(false)
        }
    }

    if (!malId && !mediaId) {
        return (
            <div className="px-6 py-8 text-center text-zinc-500 text-[11px] font-black uppercase tracking-widest">
                No disponible para este video
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 px-4 py-2">
            {/* Automatic Scan Button */}
            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Detección Automática</span>
                        <span className="text-[8px] text-zinc-500">Escanea la serie con huellas de audio localmente</span>
                    </div>
                    <button
                        onClick={handleAutoScan}
                        disabled={isSaving || (scanStatus.status !== "idle" && scanStatus.status !== "done" && scanStatus.status !== "error")}
                        className={cn(
                            "py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1",
                            scanStatus.status === "idle" || scanStatus.status === "done" || scanStatus.status === "error"
                                ? "bg-white/5 hover:bg-brand-orange hover:text-white border border-white/5 text-zinc-300"
                                : "bg-brand-orange/20 text-brand-orange cursor-default"
                        )}
                    >
                        {scanStatus.status === "idle" || scanStatus.status === "done" || scanStatus.status === "error"
                            ? "Escanear"
                            : "Escaneando..."}
                    </button>
                </div>
                {scanStatus.status !== "idle" && (
                    <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex justify-between text-[8px] font-bold text-zinc-400 font-mono">
                            <span className="truncate max-w-[180px]">{scanStatus.message}</span>
                            {scanStatus.percent !== undefined && <span>{scanStatus.percent}%</span>}
                        </div>
                        {scanStatus.percent !== undefined && (
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div
                                    className="bg-brand-orange h-full transition-all duration-300"
                                    style={{ width: `${scanStatus.percent}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                <button
                    onClick={() => setActiveTab("intro")}
                    className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95",
                        activeTab === "intro" ? "bg-brand-orange text-white" : "text-zinc-400 hover:text-white"
                    )}
                >
                    Intro (OP)
                </button>
                <button
                    onClick={() => setActiveTab("outro")}
                    className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95",
                        activeTab === "outro" ? "bg-purple-500 text-white" : "text-zinc-400 hover:text-white"
                    )}
                >
                    Outro (ED)
                </button>
            </div>

            {/* Config Panel */}
            <div className="flex flex-col gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                {activeTab === "intro" ? (
                    <>
                        <div className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Marcas de la Intro</span>
                            <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                                        <span>Inicio:</span>
                                        {opStart === null && <span className="text-[9px] text-zinc-600 font-bold uppercase">No asignado</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="MM"
                                            value={opStart !== null ? Math.floor(opStart / 60) : ""}
                                            onChange={(e) => handleMinChange(e.target.value, opStart, setOpStart)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-brand-orange font-bold focus:outline-none focus:border-brand-orange/50 focus:bg-white/10 transition-colors"
                                        />
                                        <span className="text-zinc-600 font-bold">:</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="SS"
                                            value={opStart !== null ? Math.floor(opStart % 60) : ""}
                                            onChange={(e) => handleSecChange(e.target.value, opStart, setOpStart)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-brand-orange font-bold focus:outline-none focus:border-brand-orange/50 focus:bg-white/10 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                                        <span>Fin:</span>
                                        {opEnd === null && <span className="text-[9px] text-zinc-600 font-bold uppercase">No asignado</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="MM"
                                            value={opEnd !== null ? Math.floor(opEnd / 60) : ""}
                                            onChange={(e) => handleMinChange(e.target.value, opEnd, setOpEnd)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-brand-orange font-bold focus:outline-none focus:border-brand-orange/50 focus:bg-white/10 transition-colors"
                                        />
                                        <span className="text-zinc-600 font-bold">:</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="SS"
                                            value={opEnd !== null ? Math.floor(opEnd % 60) : ""}
                                            onChange={(e) => handleSecChange(e.target.value, opEnd, setOpEnd)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-brand-orange font-bold focus:outline-none focus:border-brand-orange/50 focus:bg-white/10 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleMarkOpStart}
                                className="flex-1 py-3 px-2 bg-white/5 border border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/10 hover:text-brand-orange text-zinc-300 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <Play className="w-3 h-3 fill-current rotate-90" />
                                Fijar Inicio
                            </button>
                            <button
                                onClick={handleMarkOpEnd}
                                className="flex-1 py-3 px-2 bg-white/5 border border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/10 hover:text-brand-orange text-zinc-300 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <Play className="w-3 h-3 fill-current" />
                                Fijar Fin
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Marcas de la Outro / Ending</span>
                            <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                                        <span>Inicio:</span>
                                        {edStart === null && <span className="text-[9px] text-zinc-600 font-bold uppercase">No asignado</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="MM"
                                            value={edStart !== null ? Math.floor(edStart / 60) : ""}
                                            onChange={(e) => handleMinChange(e.target.value, edStart, setEdStart)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-purple-400 font-bold focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
                                        />
                                        <span className="text-zinc-600 font-bold">:</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="SS"
                                            value={edStart !== null ? Math.floor(edStart % 60) : ""}
                                            onChange={(e) => handleSecChange(e.target.value, edStart, setEdStart)}
                                            className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-purple-400 font-bold focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                                        <span>Fin:</span>
                                        {edEndIsEpisodeEnd
                                            ? <span className="text-[9px] text-purple-400 font-bold uppercase">Final del episodio</span>
                                            : edEnd === null && <span className="text-[9px] text-zinc-600 font-bold uppercase">No asignado</span>}
                                    </div>
                                    {edEndIsEpisodeEnd ? (
                                        <button
                                            onClick={() => setEdEndIsEpisodeEnd(false)}
                                            className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-purple-400 transition-colors"
                                        >
                                            <span className="text-[9px] text-zinc-400 font-bold">Final del episodio</span>
                                            <span className="text-zinc-600 mx-1">—</span>
                                            <span className="underline decoration-dotted">Fijar hora específica</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                placeholder="MM"
                                                value={edEnd !== null ? Math.floor(edEnd / 60) : ""}
                                                onChange={(e) => handleMinChange(e.target.value, edEnd, setEdEnd)}
                                                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-purple-400 font-bold focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
                                            />
                                            <span className="text-zinc-600 font-bold">:</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                placeholder="SS"
                                                value={edEnd !== null ? Math.floor(edEnd % 60) : ""}
                                                onChange={(e) => handleSecChange(e.target.value, edEnd, setEdEnd)}
                                                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center font-mono text-xs text-purple-400 font-bold focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors"
                                            />
                                            <button
                                                onClick={() => setEdEndIsEpisodeEnd(true)}
                                                className="ml-1 text-[9px] text-zinc-500 hover:text-purple-400 underline decoration-dotted transition-colors"
                                                title="Saltar al final del episodio"
                                            >
                                                Final
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleMarkEdStart}
                                className="flex-1 py-3 px-2 bg-white/5 border border-white/5 hover:border-purple-400/30 hover:bg-purple-500/10 hover:text-purple-400 text-zinc-300 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <Play className="w-3 h-3 fill-current rotate-90" />
                                Fijar Inicio
                            </button>
                            <button
                                onClick={handleMarkEdEnd}
                                className="flex-1 py-3 px-2 bg-white/5 border border-white/5 hover:border-purple-400/30 hover:bg-purple-500/10 hover:text-purple-400 text-zinc-300 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <Play className="w-3 h-3 fill-current" />
                                Fijar Fin
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Propagate to season checkbox toggle */}
            <button
                onClick={() => setApplyToSeason(!applyToSeason)}
                className="flex items-center justify-between w-full px-2 py-1 text-left active:scale-[0.98] transition-transform"
            >
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">
                        Aplicar a toda la temporada
                    </span>
                    <span className="text-[8px] text-zinc-500">
                        Propaga marcas a otros episodios
                    </span>
                </div>
                <div className={cn(
                    "w-8 h-4 rounded-full relative transition-all duration-300 border border-white/5",
                    applyToSeason ? "bg-brand-orange border-brand-orange/30 shadow-[0_0_8px_rgba(255,110,58,0.3)]" : "bg-white/10"
                )}>
                    <div className={cn(
                        "absolute top-[2px] w-2.5 h-2.5 rounded-full transition-all duration-300",
                        applyToSeason ? "left-[17px] bg-white" : "left-[3px] bg-zinc-400"
                    )} />
                </div>
            </button>

            {/* Bottom Actions */}
            <div className="flex gap-2 mt-2 border-t border-white/5 pt-4">
                <button
                    onClick={handleClear}
                    disabled={isSaving}
                    title="Restablecer marcas"
                    className="p-3 bg-white/5 border border-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-all rounded-xl active:scale-95 disabled:opacity-40"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-brand-orange hover:bg-brand-orange-hover text-white text-[10px] font-black uppercase tracking-widest transition-all rounded-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Guardando..." : "Guardar y Aplicar"}
                </button>
            </div>
        </div>
    )
}
