import React, { useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useScannerEvents } from "@/hooks/use-scanner-events"
import { useScanLocalFiles, useGetScanSummaries } from "@/api/hooks/scan.hooks"
import {
    LucideActivity, LucideCheck,
    LucideFlame, LucideHistory, LucidePlay,
    LucideRadar, LucideRefreshCw,
    LucideFilter, LucideZap, LucideSparkles,
} from "lucide-react"

import { cn } from "@/components/ui/core/styling"
import { PIPELINE_STAGES, PipelineStageCard, ProgressRing } from "./scanner-progress"
import { SectionHeader, ScanActionCard, EventFeed, ScanHistory } from "./scanner-results"

export function ScannerDashboard() {
    const { isScanning, scanProgress, scanningFile, events, activeStageIdx, lastFinish, pruneCount } = useScannerEvents()
    const { mutate: scan, isPending: scanPending } = useScanLocalFiles()
    const { data: summaries } = useGetScanSummaries()

    const startMetadataImprovement = useCallback(() => {
        scan({ enhanced: true, enhanceWithOfflineDatabase: true, skipLockedFiles: false, skipIgnoredFiles: false, fullScan: false, mode: "metadata" })
    }, [scan])

    const startFastScan = useCallback(() => {
        scan({ enhanced: false, enhanceWithOfflineDatabase: false, skipLockedFiles: false, skipIgnoredFiles: false, fullScan: false, mode: "fast" })
    }, [scan])

    const startDeepScan = useCallback(() => {
        scan({ enhanced: true, enhanceWithOfflineDatabase: true, skipLockedFiles: false, skipIgnoredFiles: false, fullScan: true, mode: "deep" })
    }, [scan])

    const recentSummaries = useMemo(() => (summaries ?? []).slice().reverse().slice(0, 8), [summaries])

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
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/40 transition-all duration-500" />
                                <LucideRadar className={cn(
                                    "w-16 h-16 relative z-10 transition-colors duration-500",
                                    isScanning ? "text-primary animate-pulse" : "text-white/40"
                                )} />
                                {isScanning && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 z-20">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                        <span className="relative inline-flex rounded-full h-5 w-5 bg-primary shadow-[0_0_15px_rgba(255,110,58,0.5)]" />
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-8xl font-black tracking-tighter text-white uppercase italic leading-none">
                                    Scanner<span className="text-primary">.</span>
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
                        "col-span-12 lg:col-span-8 overflow-hidden relative group",
                        "border border-white/10 bg-white/[0.03] backdrop-blur-xl p-1",
                        isScanning ? "ring-1 ring-primary/20" : ""
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 p-10 h-full flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-12">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <LucideFlame className={cn("w-6 h-6", isScanning ? "text-primary animate-pulse" : "text-zinc-600")} />
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
                            <div className="relative h-2 w-full bg-white/5 overflow-hidden group/bar">
                                <motion.div
                                    className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_20px_rgba(255,110,58,0.5)]"
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

                {/* 3. FEED (Full Width or Split) */}
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
