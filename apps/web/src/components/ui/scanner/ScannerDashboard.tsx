import React, { useCallback } from "react"
import { motion } from "framer-motion"
import { useScannerEvents } from "@/hooks/use-scanner-events"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import {
    LucideFlame, LucideRefreshCw,
    LucideZap, LucideSparkles,
} from "lucide-react"

import { cn } from "@/components/ui/core/styling"
import { PIPELINE_STAGES, PipelineStageCard, ProgressRing } from "./scanner-progress"
import { ScanActionCard } from "./scanner-results"

export function ScannerDashboard() {
    const { isScanning, scanProgress, scanningFile, activeStageIdx, lastFinish } = useScannerEvents()
    const { mutate: scan, isPending: scanPending } = useScanLocalFiles()

    const startMetadataImprovement = useCallback(() => {
        scan({ mode: "metadata", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const startFastScan = useCallback(() => {
        scan({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const startDeepScan = useCallback(() => {
        scan({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    return (
        <div className="max-w-[1600px] mx-auto space-y-12 pb-20 text-zinc-300">
            {/* --- BENTO GRID --- */}
            <div className="grid grid-cols-12 gap-6 px-4">

                {/* 1. PROGRESS WIDGET (Large) - Bento Grid 2.0 style */}
                <motion.div
                    layout
                    className={cn(
                        "col-span-12 lg:col-span-8 rounded-3xl",
                        "bg-[var(--glass-bg)] backdrop-blur-[var(--blur-card)] border border-[var(--glass-border)] rounded-2xl p-8 lg:p-10",
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
                                        "text-zinc-950 font-black px-6 py-3.5 rounded-xl text-xs tracking-widest uppercase transition-all duration-300 shadow-lg transform active:scale-95 w-full lg:w-auto",
                                        isScanning
                                            ? "bg-zinc-900 text-zinc-500 cursor-not-allowed border border-white/5 shadow-none"
                                            : "bg-[#ff6e3a] hover:bg-[#ff7d4b] hover:shadow-[#ff6e3a]/15"
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
            </div>
        </div>
    )
}
