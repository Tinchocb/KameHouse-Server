import React, { useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useScannerEvents } from "@/hooks/use-scanner-events"
import { useScanLocalFiles, useGetScanSummaries } from "@/api/hooks/scan.hooks"
import {
    LucideActivity, LucideCheck,
    LucideFlame, LucideHistory, LucidePlay,
    LucideRadar, LucideRefreshCw,
    LucideFilter, LucideZap,
} from "lucide-react"

import { PIPELINE_STAGES, PipelineStageCard, ProgressRing } from "./scanner-progress"
import { SectionHeader, ScanActionCard, EventFeed, ScanHistory } from "./scanner-results"

export function ScannerDashboard() {
    const { isScanning, scanProgress, scanningFile, events, activeStageIdx, lastFinish, pruneCount } = useScannerEvents()
    const { mutate: scan, isPending: scanPending } = useScanLocalFiles()
    const { data: summaries } = useGetScanSummaries()

    const startFastScan = useCallback(() => {
        scan({ enhanced: false, enhanceWithOfflineDatabase: false, skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const startDeepScan = useCallback(() => {
        scan({ enhanced: true, enhanceWithOfflineDatabase: true, skipLockedFiles: false, skipIgnoredFiles: false })
    }, [scan])

    const recentSummaries = useMemo(() => (summaries ?? []).slice().reverse().slice(0, 8), [summaries])

    return (
        <div className="space-y-16">
            <header className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <LucideRadar className="w-12 h-12 text-primary" />
                        {isScanning && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
                            </span>
                        )}
                    </div>
                    <h1 className="text-7xl font-black tracking-tighter text-white">
                        Scanner
                    </h1>
                    {isScanning && (
                        <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xs font-black uppercase tracking-[0.3em] text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-full"
                        >
                            En progreso
                        </motion.span>
                    )}
                </div>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed">
                    Centro de control del escáner de biblioteca. Visualizá el pipeline en tiempo real, iniciá escaneos y revisá el historial.
                </p>
            </header>

            <AnimatePresence>
                {isScanning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="relative overflow-hidden rounded-none border border-white/20 bg-white/5 p-10"
                    >
                        <div className="absolute inset-0 rounded-none overflow-hidden">
                            <div className="absolute inset-0 animate-[spin_4s_linear_infinite] opacity-10"
                                style={{ background: "conic-gradient(from 0deg, transparent 60%, rgba(255,255,255,0.5) 80%, transparent 100%)" }} />
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
                            <ProgressRing progress={scanProgress} size={100} stroke={7} />

                            <div className="flex-1 min-w-0 space-y-3">
                                <div className="flex items-center gap-4">
                                    <LucideFlame className="w-6 h-6 text-white animate-pulse" />
                                    <span className="font-black text-white text-2xl tracking-tight">Escaneando Biblioteca</span>
                                </div>
                                <p className="text-sm font-mono text-zinc-400 truncate" title={scanningFile}>
                                    {scanningFile || "Preparando pipeline..."}
                                </p>
                                <div className="w-full bg-white/10 rounded-none h-1 overflow-hidden mt-3">
                                    <motion.div
                                        className="h-full bg-white rounded-none"
                                        style={{ width: `${scanProgress}%` }}
                                        transition={{ type: "spring", stiffness: 80 }}
                                    />
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <span className="font-bebas text-7xl text-white leading-none">{Math.round(scanProgress)}</span>
                                <span className="font-bebas text-3xl text-zinc-500">%</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {lastFinish && !isScanning && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-6 px-8 py-6 rounded-none border border-white/20 bg-white/5"
                    >
                        <LucideCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-white">Último escaneo completado</p>
                            <p className="text-sm text-zinc-500 mt-1">
                                {lastFinish.total_processed
                                    ? `${lastFinish.total_processed} archivos procesados`
                                    : "Sin cambios detectados"}
                                {lastFinish.duration_seconds
                                    ? ` · ${lastFinish.duration_seconds.toFixed(1)}s`
                                    : ""}
                                {pruneCount > 0 ? ` · ${pruneCount} archivos purgados de DB` : ""}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <section className="space-y-8">
                <SectionHeader label="Pipeline" icon={<LucideActivity size={16} />} />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {PIPELINE_STAGES.map((stage, idx) => (
                        <PipelineStageCard
                            key={stage.id}
                            stage={stage}
                            isActive={activeStageIdx === idx}
                            isDone={activeStageIdx > idx || (!isScanning && lastFinish !== null)}
                        />
                    ))}
                </div>
            </section>

            <section className="space-y-8">
                <SectionHeader label="Acciones" icon={<LucidePlay size={16} />} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ScanActionCard
                        label="FastScan"
                        desc="Detecta solo archivos nuevos o modificados (CRC32). Ideal para uso diario."
                        icon={<LucideZap size={24} className="text-white" />}
                        onClick={startFastScan}
                        disabled={isScanning || scanPending}
                        loading={isScanning}
                        accentColor="white"
                    />
                    <ScanActionCard
                        label="DeepScan"
                        desc="Vuelve a procesar todos los archivos. Fuerza re-identificación completa."
                        icon={<LucideRefreshCw size={24} className="text-zinc-400" />}
                        onClick={startDeepScan}
                        disabled={isScanning || scanPending}
                        loading={false}
                        accentColor="zinc"
                    />
                    <ScanActionCard
                        label="Analizador de Logs"
                        desc="Sube un log de escaneo y analiza el resultado con el visor de trazas."
                        icon={<LucideFilter size={24} className="text-zinc-500" />}
                        to="/scan-log-viewer"
                        accentColor="zinc"
                    />
                </div>
            </section>

            {events.length > 0 && (
                <section className="space-y-8">
                    <SectionHeader label="Feed en Vivo" icon={<LucideActivity size={16} />} />
                    <EventFeed events={events} />
                </section>
            )}

            {recentSummaries.length > 0 && (
                <section className="space-y-8">
                    <SectionHeader label="Historial" icon={<LucideHistory size={16} />} />
                    <ScanHistory summaries={recentSummaries} />
                </section>
            )}
        </div>
    )
}
