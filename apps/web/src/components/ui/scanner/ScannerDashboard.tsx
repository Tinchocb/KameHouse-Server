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
import { PIPELINE_STAGES, PipelineStageCard } from "./scanner-progress"
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
        <div className="max-w-[1600px] mx-auto space-y-12 pb-20">
            {/* --- IMMERSIVE HEADER --- */}
            <header className="relative overflow-hidden pt-12 pb-16 px-4">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-orange/10 rounded-full blur-[120px] -translate-y-1/2 -z-10" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -z-10" />

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-6">
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-brand-orange/20 rounded-full blur-xl group-hover:bg-brand-orange/40 transition-all duration-500" />
                                <LucideRadar className={cn(
                                    "w-16 h-16 relative z-10 transition-colors duration-500",
                                    isScanning ? "text-brand-orange animate-pulse" : "text-white/40"
                                )} />
                                {isScanning && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 z-20">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75" />
                                        <span className="relative inline-flex rounded-full h-5 w-5 bg-brand-orange shadow-[0_0_15px_rgba(235,94,40,0.5)]" />
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-8xl font-black tracking-tighter text-white uppercase italic leading-none">
                                    Scanner<span className="text-brand-orange">.</span>
                                </h1>
                                <div className="flex items-center gap-3">
                                    <span className="h-px w-8 bg-white/20" />
                                    <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.5em]">
                                        Library Intel Engine
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-1">Status</p>
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                <div className={cn("w-2 h-2 rounded-full", isScanning ? "bg-primary animate-pulse" : "bg-emerald-500")} />
                                <span className="text-sm font-bold text-white uppercase tracking-tighter">
                                    {isScanning ? "System Active" : "Standby"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- BENTO GRID --- */}
            <div className="grid grid-cols-12 gap-6 px-4">
                
                {/* 1. PROGRESS WIDGET (Large) */}
                <motion.div 
                    layout
                    className={cn(
                        "col-span-12 lg:col-span-8 overflow-hidden relative group rounded-2xl",
                        "border border-white/5 bg-white/[0.03] backdrop-blur-xl p-1 shadow-[0_30px_60px_rgba(0,0,0,0.4)]",
                        isScanning ? "ring-1 ring-brand-orange/20" : ""
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 p-10 h-full flex flex-col justify-between min-h-[480px]">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <LucideFlame className={cn("w-6 h-6", isScanning ? "text-brand-orange animate-pulse" : "text-zinc-600")} />
                                    <span className="font-black text-white text-3xl tracking-tight uppercase">
                                        {isScanning ? "Processing Pipeline" : "Scan Overview"}
                                    </span>
                                </div>
                                <p className="text-sm font-mono text-zinc-500 truncate max-w-xl">
                                    {isScanning ? (scanningFile || "Calibrating engine...") : "Pipeline ready for next execution cycle."}
                                </p>
                            </div>

                            {isScanning && (
                                <div className="text-right">
                                    <span className="font-bebas text-8xl text-white leading-none block">
                                        {Math.round(scanProgress)}
                                        <span className="text-2xl text-zinc-600 ml-2">%</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Interactive Radar Visual in the center when idle */}
                        {!isScanning && (
                            <div className="flex-1 flex flex-col items-center justify-center py-6 relative my-4 min-h-[160px]">
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {/* Pulse rings */}
                                    <div className="absolute w-40 h-40 border border-brand-orange/10 rounded-full animate-ping [animation-duration:4s]" />
                                    <div className="absolute w-28 h-28 border border-brand-orange/20 rounded-full animate-ping [animation-duration:2.5s]" />
                                    <div className="absolute w-16 h-16 border border-brand-orange/30 rounded-full animate-ping [animation-duration:1.5s]" />
                                    {/* Concentric static rings */}
                                    <div className="absolute w-48 h-48 border border-white/5 rounded-full" />
                                    <div className="absolute w-36 h-36 border border-white/5 rounded-full" />
                                    <div className="absolute w-24 h-24 border border-white/5 rounded-full" />
                                    <div className="absolute w-12 h-12 border border-white/5 rounded-full flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 bg-brand-orange rounded-full shadow-[0_0_8px_rgb(255,110,58)] animate-pulse" />
                                    </div>
                                    {/* Rotating radar line */}
                                    <div className="absolute w-48 h-48 rounded-full border border-white/5 overflow-hidden">
                                        <div 
                                            className="w-1/2 h-1/2 absolute top-0 left-0 origin-bottom-right bg-gradient-to-br from-brand-orange/10 via-transparent to-transparent animate-[spin_6s_linear_infinite]"
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
                                    className="absolute inset-y-0 left-0 bg-brand-orange shadow-[0_0_20px_rgba(235,94,40,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${scanProgress}%` }}
                                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                />
                                {isScanning && (
                                    <motion.div 
                                        className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/40 to-transparent"
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
                    <ScanActionCard
                        label="Diagnostics"
                        desc="Engine logs and trace analysis."
                        icon={<LucideFilter size={28} className="text-zinc-500" />}
                        to="/scan-log-viewer"
                        accentColor="zinc"
                    />
                </div>

                {/* --- 2.5 ANALYTICS CHART & KPI --- */}
                {chartData.length > 0 && (
                    <>
                        <div className="col-span-12 lg:col-span-8 overflow-hidden relative border border-white/5 bg-white/[0.02] backdrop-blur-xl p-8 rounded-2xl flex flex-col justify-between space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-orange/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="flex items-center justify-between z-10">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-white tracking-tight uppercase">Métricas de Ejecución</h3>
                                    <p className="text-xs text-zinc-500">Historial de cantidad de archivos descubiertos e indexados por escaneo</p>
                                </div>
                            </div>
                            <div className="h-64 w-full z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="rgb(255,110,58)" stopOpacity={0.25}/>
                                                <stop offset="95%" stopColor="rgb(255,110,58)" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorMatched" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                                        <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                                        <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-zinc-950/95 border border-white/10 p-4 backdrop-blur-xl shadow-2xl space-y-2 rounded-xl">
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
                                        <Area type="monotone" name="Archivos" dataKey="Archivos" stroke="rgb(255,110,58)" strokeWidth={2} fillOpacity={1} fill="url(#colorFiles)" />
                                        <Area type="monotone" name="Coincidentes" dataKey="Coincidentes" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorMatched)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="col-span-12 lg:col-span-4 border border-white/5 bg-white/[0.02] p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden group shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                            {/* Glowing radial backdrop */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-brand-orange/10 rounded-full blur-[60px] group-hover:scale-110 transition-transform duration-1000" />
                            
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
                                    <span className="text-xs text-zinc-500 mt-2 block font-medium max-w-[200px]">
                                        Asociados automáticamente con bases de datos públicas.
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
                                            stroke="rgb(255,110,58)" 
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
                                    className="h-full bg-brand-orange shadow-[0_0_10px_rgba(255,110,58,0.8)] transition-all duration-1000 ease-out" 
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
                                className="h-full border border-white/10 bg-white/[0.02] p-8 space-y-8"
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
                                    <div className="bg-white/5 p-6 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Processed</p>
                                        <p className="text-4xl font-bebas text-white leading-none">{lastFinish.total_processed || 0}</p>
                                    </div>
                                    <div className="bg-white/5 p-6 border border-white/5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Duration</p>
                                        <p className="text-4xl font-bebas text-white leading-none">{(lastFinish.duration_seconds || 0).toFixed(1)}s</p>
                                    </div>
                                    {pruneCount > 0 && (
                                        <div className="col-span-2 bg-rose-500/5 p-6 border border-rose-500/10">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-2">Pruned Entries</p>
                                            <p className="text-4xl font-bebas text-white leading-none">{pruneCount}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full border border-dashed border-white/10 flex items-center justify-center p-12 text-zinc-600 uppercase font-black tracking-widest text-xs">
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
