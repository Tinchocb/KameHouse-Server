import React, { useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useScannerEvents } from "@/hooks/use-scanner-events"
import { useScanLocalFiles, useGetScanSummaries } from "@/api/hooks/scan.hooks"
import {
    LucideActivity, LucideCheck,
    LucideFlame, LucideHistory,
    LucideRadar, LucideRefreshCw,
    LucideFilter, LucideZap, LucideSparkles,
} from "lucide-react"

import { cn } from "@/components/ui/core/styling"
import { PIPELINE_STAGES, PipelineStageCard, ProgressRing } from "./scanner-progress"
import { SectionHeader, ScanActionCard, EventFeed, ScanHistory } from "./scanner-results"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function ScannerDashboard() {
    const { isScanning, scanProgress, scanningFile, events, activeStageIdx, lastFinish, pruneCount } = useScannerEvents()
    const { mutate: scan, isPending: scanPending } = useScanLocalFiles()
    const { data: summaries } = useGetScanSummaries()

    const startMetadataImprovement = useCallback(() => {
        scan({ mode: "metadata", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const startFastScan = useCallback(() => {
        scan({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const startDeepScan = useCallback(() => {
        scan({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const recentSummaries = useMemo(() => (summaries ?? []).slice().reverse().slice(0, 8), [summaries])

    const chartData = useMemo(() => {
        return (summaries ?? []).slice(-10).map((s) => {
            const groups = s.scanSummary?.groups ?? []
            const unmatched = s.scanSummary?.unmatchedFiles ?? []
            const matchedCount = groups.reduce((acc, g) => acc + (g.files?.length ?? 0), 0)
            const totalCount = matchedCount + unmatched.length
            const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }) : ""

            return {
                name: dateStr,
                Archivos: totalCount,
                Coincidentes: matchedCount,
            }
        })
    }, [summaries])

    const averageMatchingRate = useMemo(() => {
        if (!summaries || summaries.length === 0) return 0
        let total = 0
        let matched = 0
        summaries.forEach((s) => {
            const groups = s.scanSummary?.groups ?? []
            const unmatched = s.scanSummary?.unmatchedFiles ?? []
            const mCount = groups.reduce((acc, g) => acc + (g.files?.length ?? 0), 0)
            const tCount = mCount + unmatched.length
            if (tCount > 0) {
                total += tCount
                matched += mCount
            }
        })
        if (total === 0) return 0
        return Math.round((matched / total) * 100)
    }, [summaries])

    return (
        <div className="max-w-[1600px] mx-auto space-y-12 pb-20 text-zinc-300">
            {/* --- BENTO GRID --- */}
            <div className="grid grid-cols-12 gap-6 px-4">

                {/* 1. PROGRESS WIDGET (Large) - Bento Grid 2.0 style */}
                <motion.div
                    layout
                    className={cn(
                        "col-span-12 lg:col-span-8 overflow-hidden relative group rounded-3xl",
                        "border border-white/5 bg-white/[0.01] backdrop-blur-[64px] p-8 lg:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.6)]",
                        isScanning ? "ring-1 ring-[#ff6e3a]/20" : ""
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                    <div className="relative z-10 h-full flex flex-col justify-between min-h-[480px]">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 w-full">

                            {/* Circular Progress Ring Reactor */}
                            <div className="flex items-center gap-8 shrink-0">
                                <div className="relative shrink-0 flex items-center justify-center p-1 bg-white/[0.02] border border-white/5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                                    <ProgressRing progress={isScanning ? scanProgress : 0} size={110} stroke={6} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <LucideFlame className={cn("w-6 h-6", isScanning ? "text-[#ff6e3a] animate-pulse" : "text-zinc-600")} />
                                        <span className="font-black text-white text-3xl tracking-tight uppercase">
                                            {isScanning ? "PROCESSING PIPELINE" : "STANDBY DEL SISTEMA"}
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono text-zinc-500 max-w-sm truncate lg:max-w-md">
                                        {isScanning ? (scanningFile || "Calibrando motor...") : "El sistema de indexación está listo para escaneo."}
                                    </p>
                                    {isScanning && scanningFile && (
                                        <div className="bg-black/40 border border-white/5 px-3 py-1.5 rounded-lg max-w-sm truncate font-mono text-[10px] text-[#ff6e3a] flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-[#ff6e3a] rounded-full animate-ping shrink-0" />
                                            <span className="truncate">{scanningFile}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Trigger actions block */}
                            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                                <button
                                    onClick={startFastScan}
                                    disabled={isScanning || scanPending}
                                    className={cn(
                                        "bg-gradient-to-r text-zinc-950 font-black px-6 py-3.5 rounded-xl text-xs tracking-widest uppercase transition-all shadow-lg transform active:scale-95 w-full lg:w-auto",
                                        isScanning
                                            ? "from-zinc-800 to-zinc-900 text-zinc-500 cursor-not-allowed border border-white/5 shadow-none"
                                            : "from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 hover:shadow-[#ff6e3a]/15"
                                    )}
                                >
                                    {isScanning ? "ESCANEANDO..." : "INICIAR DELTA SCAN"}
                                </button>
                            </div>
                        </div>

                        {/* Interactive Radar Visual in the center when idle */}
                        {!isScanning && (
                            <div className="flex-1 flex flex-col items-center justify-center py-6 relative my-4 min-h-[160px]">
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {/* Pulse rings */}
                                    <div className="absolute w-40 h-40 border border-[#ff6e3a]/10 rounded-full animate-ping [animation-duration:4s]" />
                                    <div className="absolute w-28 h-28 border border-[#ff6e3a]/25 rounded-full animate-ping [animation-duration:2.5s]" />
                                    <div className="absolute w-16 h-16 border border-[#ff6e3a]/30 rounded-full animate-ping [animation-duration:1.5s]" />
                                    {/* Concentric static rings */}
                                    <div className="absolute w-48 h-48 border border-white/5 rounded-full" />
                                    <div className="absolute w-36 h-36 border border-white/5 rounded-full" />
                                    <div className="absolute w-24 h-24 border border-white/5 rounded-full" />
                                    <div className="absolute w-12 h-12 border border-white/5 rounded-full flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 bg-[#ff6e3a] rounded-full shadow-[0_0_8px_rgb(255,110,58)] animate-pulse" />
                                    </div>
                                    {/* Rotating radar line */}
                                    <div className="absolute w-48 h-48 rounded-full border border-white/5 overflow-hidden">
                                        <div
                                            className="w-1/2 h-1/2 absolute top-0 left-0 origin-bottom-right bg-gradient-to-br from-[#ff6e3a]/10 via-transparent to-transparent animate-[spin_6s_linear_infinite]"
                                            style={{ transformOrigin: "bottom right" }}
                                        />
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-600 mt-28 relative z-10 select-none">
                                    SISTEMA EN ESPERA
                                </span>
                            </div>
                        )}

                        <div className="space-y-8">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {PIPELINE_STAGES.map((stage, idx) => (
                                    <PipelineStageCard
                                        key={stage.id}
                                        stage={stage}
                                        isActive={activeStageIdx === idx && isScanning}
                                        isDone={activeStageIdx > idx || (!isScanning && lastFinish !== null)}
                                    />
                                ))}
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden group/bar">
                                <motion.div
                                    className="absolute inset-y-0 left-0 bg-[#ff6e3a] shadow-[0_0_20px_rgba(255,110,58,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${scanProgress}%` }}
                                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                />
                                {isScanning && (
                                    <motion.div
                                        className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                                        animate={{ x: ["-100%", "500%"] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. ACTIONS (Sidebar) */}
                <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
                    <ScanActionCard
                        label="Mejorar Metadatos"
                        desc="Enriquecer sinopsis y portadas."
                        icon={<LucideSparkles size={28} className="text-white" />}
                        onClick={startMetadataImprovement}
                        disabled={isScanning || scanPending}
                        loading={isScanning && activeStageIdx < 5}
                        accentColor="white"
                    />
                    <ScanActionCard
                        label="Delta Scan"
                        desc="Incremental update for new files."
                        icon={<LucideZap size={28} className="text-white" />}
                        onClick={startFastScan}
                        disabled={isScanning || scanPending}
                        loading={isScanning && activeStageIdx < 5}
                        accentColor="white"
                    />
                    <ScanActionCard
                        label="Deep Sync"
                        desc="Full metadata reconstruction."
                        icon={<LucideRefreshCw size={28} className="text-white" />}
                        onClick={startDeepScan}
                        disabled={isScanning || scanPending}
                        loading={isScanning && activeStageIdx >= 5}
                        accentColor="white"
                    />
                </div>

                {/* --- 2.5 ANALYTICS CHART & KPI --- */}
                {chartData.length > 0 && (
                    <>
                        <div className="col-span-12 lg:col-span-8 overflow-hidden relative border border-white/5 bg-white/[0.01] backdrop-blur-[64px] p-8 rounded-3xl flex flex-col justify-between space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#ff6e3a]/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="flex items-center justify-between z-10">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-white tracking-tight uppercase">Métricas de Ejecución</h3>
                                    <p className="text-xs text-zinc-500">Historial de cantidad de archivos descubiertos por escaneo</p>
                                </div>
                            </div>
                            <div className="h-64 w-full z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff6e3a" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#ff6e3a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" />
                                        <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                                        <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-[#050506]/95 border border-white/10 p-4 backdrop-blur-xl shadow-2xl space-y-2 rounded-xl">
                                                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
                                                            <div className="space-y-1">
                                                                {payload.map((p: any) => (
                                                                    <div key={p.name} className="flex items-center gap-6 justify-between text-xs font-mono">
                                                                        <span className="flex items-center gap-1.5 text-zinc-400">
                                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }} />
                                                                            {p.name}:
                                                                        </span>
                                                                        <span className="font-bold text-white">{p.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            }}
                                        />
                                        <Area type="monotone" name="Archivos" dataKey="Archivos" stroke="#ff6e3a" strokeWidth={2} fillOpacity={1} fill="url(#colorFiles)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="col-span-12 lg:col-span-4 border border-white/5 bg-white/[0.01] p-8 rounded-3xl backdrop-blur-[64px] flex flex-col justify-between relative overflow-hidden group shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
                            {/* Glowing radial backdrop */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#ff6e3a]/10 rounded-full blur-[60px] group-hover:scale-110 transition-transform duration-1000" />

                            <div className="space-y-2 z-10">
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 block">Eficiencia General</span>
                                <h3 className="text-3xl font-bebas tracking-wide text-white uppercase">Éxito de Coincidencia</h3>
                            </div>

                            <div className="my-8 relative z-10 flex items-center justify-between">
                                <div>
                                    <span className="text-8xl font-black text-white leading-none block font-bebas select-none">
                                        {averageMatchingRate}
                                        <span className="text-3xl text-zinc-500 ml-1">%</span>
                                    </span>
                                    <span className="text-xs text-zinc-500 mt-2 block font-medium max-w-[200px] font-mono leading-relaxed">
                                        Asociados automáticamente por el motor bayesiano.
                                    </span>
                                </div>
                                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                                    {/* Circular Progress Ring Visual */}
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="48" cy="48" r="38" stroke="rgba(255,255,255,0.02)" strokeWidth="6" fill="none" />
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="38"
                                            stroke="#ff6e3a"
                                            strokeWidth="6"
                                            fill="none"
                                            strokeDasharray={2 * Math.PI * 38}
                                            strokeDashoffset={2 * Math.PI * 38 * (1 - averageMatchingRate / 100)}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                            style={{ filter: "drop-shadow(0 0 6px rgba(255,110,58,0.4))" }}
                                        />
                                    </svg>
                                    <span className="absolute font-bebas text-2xl text-white">{averageMatchingRate}%</span>
                                </div>
                            </div>

                            <div className="h-1 bg-white/5 rounded-full overflow-hidden z-10 relative">
                                <div
                                    className="h-full bg-[#ff6e3a] shadow-[0_0_10px_rgba(255,110,58,0.8)] transition-all duration-1000 ease-out"
                                    style={{ width: `${averageMatchingRate}%` }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* 3. FEED */}
                <div className="col-span-12 lg:col-span-7 space-y-6">
                    <SectionHeader label="Realtime Logs" icon={<LucideActivity size={16} />} />
                    <EventFeed events={events} />
                </div>

                {/* 4. RECENT FINISH / SUMMARY */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                    <SectionHeader label="System Report" icon={<LucideCheck size={16} />} />
                    <AnimatePresence mode="wait">
                        {lastFinish ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full border border-white/5 bg-white/[0.01] backdrop-blur-[64px] p-8 space-y-8 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                        <LucideCheck className="text-emerald-400" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-white uppercase tracking-tighter">Cycle Complete</p>
                                        <p className="text-sm text-zinc-500 font-mono">Last run: {new Date().toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/[0.02] p-6 border border-white/5 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Processed</p>
                                        <p className="text-4xl font-bebas text-white leading-none">{lastFinish.total_processed || 0}</p>
                                    </div>
                                    <div className="bg-white/[0.02] p-6 border border-white/5 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Duration</p>
                                        <p className="text-4xl font-bebas text-white leading-none">{(lastFinish.duration_seconds || 0).toFixed(1)}s</p>
                                    </div>
                                    {pruneCount > 0 && (
                                        <div className="col-span-2 bg-rose-500/5 p-6 border border-rose-500/10 rounded-2xl">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-2">Pruned Entries</p>
                                            <p className="text-4xl font-bebas text-white leading-none">{pruneCount}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full border border-dashed border-white/10 flex items-center justify-center p-12 text-zinc-600 uppercase font-black tracking-widest text-xs rounded-3xl min-h-[220px]">
                                No recent execution data
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 5. HISTORY (Full Width Bottom) */}
                <div className="col-span-12 space-y-8 mt-12">
                    <SectionHeader label="Execution History" icon={<LucideHistory size={16} />} />
                    <ScanHistory summaries={recentSummaries} />
                </div>
            </div>
        </div>
    )
}
