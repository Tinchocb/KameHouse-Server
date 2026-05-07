import React, { useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { type ScannerMessage } from "@/lib/server/ws-events"
import { useScanLocalFiles, useGetScanSummaries } from "@/api/hooks/scan.hooks"
import { cn } from "@/components/ui/core/styling"
import {
    LucideActivity, LucideCheck, LucideChevronRight,
    LucideClipboardList, LucideDatabase, LucideFilter,
    LucideFlame, LucideHistory, LucideInfo, LucidePlay,
    LucideRadar, LucideRefreshCw, LucideScissors,
    LucideSearch, LucideShield, LucideZap,
} from "lucide-react"
import { useRef } from "react"

// ─── Pipeline stages ─────────────────────────────────────────────────────────

interface PipelineStage {
    id: string
    label: string
    shortLabel: string
    description: string
    icon: React.ReactNode
    color: string
    glowColor: string
}

const PIPELINE_STAGES: PipelineStage[] = [
    {
        id: "walk",
        label: "Descubrimiento",
        shortLabel: "Walk",
        description: "Recorre el sistema de archivos buscando videos",
        icon: <LucideSearch size={18} />,
        color: "text-blue-400",
        glowColor: "rgba(59,130,246,0.4)",
    },
    {
        id: "parse",
        label: "Parseo",
        shortLabel: "Parse",
        description: "Extrae metadata de nombre de archivo y carpetas",
        icon: <LucideClipboardList size={18} />,
        color: "text-violet-400",
        glowColor: "rgba(139,92,246,0.4)",
    },
    {
        id: "resolve",
        label: "Identificación",
        shortLabel: "Bayesian",
        description: "Motor Bayesiano con scoring Dice-coefficient",
        icon: <LucideShield size={18} />,
        color: "text-white",
        glowColor: "rgba(255,255,255,0.1)",
    },
    {
        id: "probe",
        label: "Análisis Técnico",
        shortLabel: "FFprobe",
        description: "FFprobe + detección de subtítulos externos",
        icon: <LucideActivity size={18} />,
        color: "text-emerald-400",
        glowColor: "rgba(16,185,129,0.4)",
    },
    {
        id: "persist",
        label: "Persistencia",
        shortLabel: "Persist",
        description: "Guarda snapshot JSON en la base de datos",
        icon: <LucideDatabase size={18} />,
        color: "text-sky-400",
        glowColor: "rgba(14,165,233,0.4)",
    },
    {
        id: "prune",
        label: "Limpieza",
        shortLabel: "Prune",
        description: "Elimina archivos borrados del disco de la DB",
        icon: <LucideScissors size={18} />,
        color: "text-rose-400",
        glowColor: "rgba(244,63,94,0.4)",
    },
]

import { useScannerEvents, type ScanEvent } from "@/hooks/use-scanner-events"

// ─── Component ────────────────────────────────────────────────────────────────

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
            {/* ── Header ── */}
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

            {/* ── Live Scan Banner ── */}
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

            {/* ── Last Scan Result ── */}
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

            {/* ── Pipeline Visualization ── */}
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

            {/* ── Actions ── */}
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
                        href="/scan-log-viewer"
                        accentColor="zinc"
                    />
                </div>
            </section>

            {/* ── Live Event Feed ── */}
            {events.length > 0 && (
                <section className="space-y-8">
                    <SectionHeader label="Feed en Vivo" icon={<LucideActivity size={16} />} />
                    <EventFeed events={events} />
                </section>
            )}

            {/* ── Scan History ── */}
            {recentSummaries.length > 0 && (
                <section className="space-y-8">
                    <SectionHeader label="Historial" icon={<LucideHistory size={16} />} />
                    <ScanHistory summaries={recentSummaries} />
                </section>
            )}
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-white/20" />
            <span className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                {icon}
                {label}
            </span>
            <div className="h-px flex-1 bg-white/5" />
        </div>
    )
}

function PipelineStageCard({ stage, isActive, isDone }: {
    stage: PipelineStage
    isActive: boolean
    isDone: boolean
}) {
    return (
        <motion.div
            animate={isActive ? {
                boxShadow: [`0 0 0 rgba(249,115,22,0)`, `0 0 40px ${stage.glowColor}`, `0 0 0 rgba(249,115,22,0)`],
            } : {}}
            transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
            className={cn(
                "relative p-7 rounded-none border transition-all duration-700 overflow-hidden group",
                isActive
                    ? "border-white/40 bg-white/10"
                    : isDone
                        ? "border-white/20 bg-white/5"
                        : "border-white/5 bg-black/20"
            )}
        >
            {(isActive || isDone) && (
                <div
                    className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full blur-[50px] transition-opacity duration-700"
                    style={{ backgroundColor: stage.glowColor, opacity: isDone ? 0.2 : 0.5 }}
                />
            )}

            <div className="relative space-y-4">
                <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                    isActive
                        ? `${stage.color} border-white/20 bg-white/10 scale-110`
                        : isDone
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            : `${stage.color} border-white/10 bg-white/5 opacity-40 group-hover:opacity-70`
                )}>
                    {isDone && !isActive ? <LucideCheck size={20} /> : stage.icon}
                </div>

                <div>
                    <p className={cn(
                        "text-xs font-black uppercase tracking-widest transition-colors duration-500",
                        isActive ? stage.color : isDone ? "text-zinc-400" : "text-zinc-600"
                    )}>
                        {stage.shortLabel}
                    </p>
                    <p className="text-sm font-semibold text-white/70 mt-1 leading-tight">{stage.label}</p>
                </div>

                {isActive && (
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                        initial={{ scaleX: 0, transformOrigin: "left" }}
                        animate={{ scaleX: [0, 1, 0], transition: { duration: 2, repeat: Infinity } }}
                    />
                )}
            </div>
        </motion.div>
    )
}

function ScanActionCard({
    label, desc, icon, onClick, disabled, loading, href, accentColor
}: {
    label: string
    desc: string
    icon: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    loading?: boolean
    href?: string
    accentColor: "white" | "zinc"
}) {
    const colors: Record<string, { border: string; bg: string; glow: string; text: string }> = {
        white: { border: "border-white/20", bg: "hover:bg-white/10", glow: "", text: "text-white" },
        zinc: { border: "border-white/10", bg: "hover:bg-white/5", glow: "", text: "text-zinc-400" },
    }
    const c = colors[accentColor]

    const Wrapper = href ? "a" : "button"
    const wrapperProps = href ? { href } : { onClick, disabled, type: "button" as const }

    return (
        <Wrapper
            {...(wrapperProps as any)}
            className={cn(
                "group relative block p-8 rounded-none border bg-white/[0.02] transition-all duration-500 text-left",
                c.border, c.bg,
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/10 active:scale-[0.98]"
            )}
        >
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 group-hover:border-white/20 transition-all">
                        {loading ? <LucideRefreshCw size={24} className={cn("animate-spin", c.text)} /> : icon}
                    </div>
                    <LucideChevronRight size={20} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
                </div>
                <div>
                    <p className="font-black text-white text-lg tracking-tight">{label}</p>
                    <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{desc}</p>
                </div>
            </div>
        </Wrapper>
    )
}

function EventFeed({ events }: { events: ScanEvent[] }) {
    const listRef = useRef<HTMLDivElement>(null)

    const getEventColor = (status: ScannerMessage["status"]) => {
        switch (status) {
            case "START": return "text-blue-400"
            case "PROCESSING": return "text-zinc-400"
            case "PRUNED": return "text-rose-400"
            case "FINISH": return "text-emerald-400"
            default: return "text-zinc-500"
        }
    }

    const getEventLabel = (evt: ScanEvent) => {
        switch (evt.status) {
            case "START": return "Escaneo iniciado"
            case "PROCESSING":
                return evt.file
                    ? `Procesando: ${evt.file}`
                    : `Archivo ${evt.current ?? "?"} de ${evt.total ?? "?"}`
            case "PRUNED":
                return `Purgados ${evt.removed ?? 0} archivos de la DB`
            case "FINISH":
                return evt.total_processed
                    ? `Completado — ${evt.total_processed} archivos en ${(evt.duration_seconds ?? 0).toFixed(1)}s`
                    : "Completado sin cambios"
            default: return evt.status
        }
    }

    const visibleEvents = events.filter(e => e.status !== "PROCESSING" || events.indexOf(e) < 3)
        .slice(0, 50)

    return (
        <div className="rounded-none overflow-hidden border border-white/5 bg-black/20">
            <div
                ref={listRef}
                className="max-h-80 overflow-y-auto divide-y divide-white/[0.03]"
            >
                {visibleEvents.map((evt: ScanEvent & { id?: string; timestamp: number }) => (
                    <motion.div
                        key={evt.id || `${evt.timestamp}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-5 px-8 py-4"
                    >
                        <div className={cn("w-2 h-2 rounded-none shrink-0", {
                            "bg-white": evt.status === "START" || evt.status === "FINISH",
                            "bg-zinc-600": evt.status === "PROCESSING",
                            "bg-zinc-400": evt.status === "PRUNED",
                        })} />
                        <span className={cn("text-sm font-mono truncate flex-1", getEventColor(evt.status))}>
                            {getEventLabel(evt)}
                        </span>
                        <span className="text-xs text-zinc-600 shrink-0">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

function ScanHistory({ summaries }: { summaries: Record<string, any>[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {summaries.map((s, idx) => {
                // The backend stores a dto.ScanSummary with Groups[] and UnmatchedFiles[]
                // Unwrap if wrapped in a { scanSummary: ... } envelope
                const summary = s.scanSummary ?? s

                const groups: any[] = summary?.groups ?? []
                const unmatched: any[] = summary?.unmatchedFiles ?? []
                const matchedCount = groups.reduce((acc: number, g: any) => acc + (g.files?.length ?? 0), 0)
                const totalCount = matchedCount + unmatched.length

                const files = totalCount > 0 ? totalCount : "?"
                const matched = matchedCount > 0 || totalCount > 0 ? matchedCount : "?"

                const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                }) : "—"

                return (
                    <div key={idx} className="p-7 rounded-none border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all space-y-4 group">
                        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-zinc-500">
                            <LucideHistory size={14} />
                            {createdAt}
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="font-bebas text-5xl text-white">{files}</span>
                            <span className="text-sm text-zinc-600">archivos</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                            <span className="text-white font-bold">{matched} match</span>
                            {unmatched.length > 0 && <span className="text-zinc-400 border border-white/10 px-2 py-0.5 text-[10px]">· {unmatched.length} sin match</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function ProgressRing({ progress, size, stroke }: { progress: number; size: number; stroke: number }) {
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (progress / 100) * circumference
    const center = size / 2

    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={center} cy={center} r={radius}
                stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} fill="none" />
            <motion.circle
                cx={center} cy={center} r={radius}
                stroke="white"
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="square"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset: offset }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
            <text
                x={center} y={center}
                className="fill-white font-bold"
                textAnchor="middle" dominantBaseline="central"
                fontSize="14" fontWeight="900"
                transform={`rotate(90, ${center}, ${center})`}
                style={{ fontFamily: "inherit" }}
            >
                {Math.round(progress)}%
            </text>
        </svg>
    )
}
