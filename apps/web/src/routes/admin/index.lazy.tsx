import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { m } from "framer-motion"
import * as React from "react"
import { useState } from "react"
import { cn } from "@/components/ui/core/styling"
import { IconUiDownload, IconNavigationTv, IconNavigationFilm, IconStatusActivity, IconStatusHdd, IconStatusPulse, IconNavigationSearch, IconUiRefresh, IconUiLink, IconUiDelete, IconStatusDatabase, IconStatusImage, IconArrowRight, IconStatusCloud, IconNavigationLibrary, IconStatusZap, IconMediaWand, IconStatusMusic, IconUiCheckCircle, IconUiXCircle, IconUiAlertCircle, IconUiHelpCircle, IconStatusFile, IconUiSliders, IconNavigationUsers } from "@/components/ui/icons";
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useGetLibraryStats, useGetTranscodeStats } from "@/api/hooks/admin.hooks"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useGetNotifications } from "@/api/hooks/notifications.hooks"
import { useGetFFmpegStatus } from "@/api/hooks/mediastream.hooks"
import { useCancelPreTranscode, useGetPreTranscodeJobs } from "@/api/hooks/pretranscode.hooks"
import {
    useDeleteLogs,
    useDownloadDiagnosticsReport,
    useGetLogContent,
    useGetLogFilenames,
} from "@/api/hooks/diagnostics.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { toast } from "sonner"
import { SectionBar } from "@/components/ui/sectionbar"
import { ElasticCounter } from "@/components/ui/kinetics"
import { Skeleton } from "@/components/ui/skeleton/skeleton"

export const Route = createLazyFileRoute("/admin/")({
    component: AdminPage,
})

function AdminPage() {
    const { data: trStats } = useGetTranscodeStats()

    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen text-on-surface bg-bg-primary font-sans antialiased selection:bg-brand-accent/30 selection:text-white"
        >
            <div className="max-w-content-desktop mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                <AdminHeader />

                <main className="mt-8 md:mt-12 space-y-6 md:space-y-8">
                    <AdminStatsGrid trStats={trStats} />

                    <AdminSection title="Gestión de Biblioteca" subtitle="Escaneo y sincronización" icon={IconNavigationLibrary}>
                        <AdminActionsGrid />
                    </AdminSection>

                    <AdminSection title="Transcodificación" subtitle="Motor de streaming, CPU, RAM y GPU en tiempo real" icon={IconStatusZap}>
                        <AdminTranscodePanel trStats={trStats} />
                    </AdminSection>

                    <AdminSection title="Servicios Externos" subtitle="TMDB, AniList, Trakt, etc." icon={IconStatusCloud}>
                        <AdminServicesGrid />
                    </AdminSection>

                    <AdminSection title="Sistema" subtitle="Configuración y monitoreo" icon={IconUiSliders}>
                        <AdminSystemGrid />
                    </AdminSection>

                    <AdminSection title="Logs del Servidor" subtitle="Visor y limpieza de archivos de log" icon={IconStatusFile}>
                        <AdminLogsViewer />
                    </AdminSection>

                    <AdminRecentActivity />
                </main>
            </div>
        </m.div>
    )
}

function AdminHeader() {
    const { mutate: backupDb, isPending: isBackingUp } = useBackupDatabase()
    const { download: downloadReport, isDownloading: isDownloadingReport } = useDownloadDiagnosticsReport()
    const { download: downloadBackup, isDownloading: isDownloadingBackup } = useDownloadDatabaseBackup()

    const handleBackup = () => {
        backupDb(undefined, {
            onSuccess: () => {
                toast.success("Respaldo de base de datos generado con éxito")
                void downloadBackup()
            },
            onError: () => {
                toast.error("Error al generar el respaldo")
            }
        })
    }

    return (
        <header className="relative z-10">
            <div className="w-full">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-4">
                    <div>
                        <h1 className="text-h2 font-display text-on-surface tracking-tight">Panel de Administración</h1>
                        <p className="text-body-md text-on-surface-variant/70 mt-2">Gestiona y monitorea tu instancia de KameHouse</p>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto flex-wrap">
                        <button
                            onClick={handleBackup}
                            disabled={isBackingUp || isDownloadingBackup}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 h-10 border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-button transition duration-fast hover:border-brand-accent hover:bg-brand-accent/10 active:scale-[0.97] disabled:opacity-50"
                        >
                            <IconUiDownload size={16} strokeWidth={2.5} />
                            {isBackingUp ? "Creando..." : isDownloadingBackup ? "Descargando..." : "Backup"}
                        </button>
                        <button
                            onClick={downloadReport}
                            disabled={isDownloadingReport}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 h-10 border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-button transition duration-fast hover:border-brand-accent hover:bg-brand-accent/10 active:scale-[0.97] disabled:opacity-50"
                        >
                            <IconStatusFile size={16} strokeWidth={2.5} />
                            {isDownloadingReport ? "Descargando..." : "Reporte"}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    )
}

function AdminStatsGrid({ trStats }: { trStats?: ReturnType<typeof useGetTranscodeStats>["data"] }) {
    const { data: libStats } = useGetLibraryStats()

    const cpuPercent = trStats?.system?.cpuPercent?.toFixed(1) || "0.0"
    const memoryTotal = trStats?.system?.memoryTotal ? (trStats.system.memoryTotal / 1024 / 1024 / 1024).toFixed(1) : "0.0"
    const memoryUsed = trStats?.system?.memoryUsed ? (trStats.system.memoryUsed / 1024 / 1024 / 1024).toFixed(1) : "0.0"

    const stats = React.useMemo(() => [
        { label: "Medios", count: libStats?.totalMedia, change: "Series y Películas", icon: IconNavigationTv, color: "var(--brand-primary)" },
        { label: "Archivos", count: libStats?.totalLocalFiles, change: "Ficheros indexados", icon: IconNavigationFilm, color: "var(--brand-secondary)" },
        { label: "CPU", value: `${cpuPercent}%`, change: "Uso del sistema", icon: IconStatusActivity, color: "var(--brand-success)" },
        { label: "Memoria", value: `${memoryUsed} GB`, change: `De ${memoryTotal} GB totales`, icon: IconStatusHdd, color: "var(--brand-magic)" },
        { label: "Transcoder NVENC", value: trStats?.transcoderInitialized && trStats.governor ? `${trStats.governor.activeNvenc} / ${trStats.governor.nvencCap}` : "Inactivo", change: "Sesiones GPU activas", icon: IconNavigationTv, color: "var(--md-sys-color-on-surface-variant)" },
        { label: "Pre-Transcode", count: trStats?.preTranscodeQueue, change: "En cola", icon: IconStatusPulse, color: "var(--brand-success)" },
    ], [libStats, trStats, cpuPercent, memoryUsed, memoryTotal])

    return (
        <section aria-labelledby="stats-title" className="mb-6">
            <h2 id="stats-title" className="sr-only">Estadísticas Generales</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {stats.map((stat) => (
                    <div key={stat.label} className="sectionbar p-4.5 relative overflow-hidden group hover:border-white/30 transition duration-base">
                        <div className="flex items-start justify-between">
                            <stat.icon size={24} className="text-on-surface-variant group-hover:text-on-surface transition-colors" style={{ color: stat.color }} />
                            <span className="text-3xs font-mono text-on-surface-variant/60 uppercase tracking-wider">—</span>
                        </div>
                        <div className="text-2xl font-display text-on-surface font-extrabold tracking-tight mt-3 tabular-nums">
                            {stat.count !== undefined ? (
                                <ElasticCounter value={stat.count} />
                            ) : (
                                stat.value
                            )}
                        </div>
                        <div className="text-2xs mt-1">
                            <span className="text-on-surface font-semibold block truncate">{stat.label}</span>
                            <span className="text-on-surface-variant/70 text-3xs truncate block mt-0.5">{stat.change}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function AdminSection({
    title,
    subtitle,
    icon,
    badge,
    children,
    collapsible = false,
    defaultOpen = true,
}: {
    title: string
    subtitle?: string
    icon?: React.ElementType
    badge?: React.ReactNode
    children: React.ReactNode
    collapsible?: boolean
    defaultOpen?: boolean
}) {
    return (
        <SectionBar
            label={title}
            description={subtitle}
            icon={icon}
            badge={badge}
            collapsible={collapsible}
            defaultOpen={defaultOpen}
            variant="default"
            className="mb-8"
        >
            <div className="pt-2">
                {children}
            </div>
        </SectionBar>
    )
}

function AdminActionsGrid() {
    const navigate = useNavigate()
    const { mutate: scanLibrary } = useScanLocalFiles()

    const actions = [
        { label: "Escanear Biblioteca", desc: "Detectar nuevos archivos", icon: IconNavigationSearch, variant: "primary" as const, action: () => scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Re-Scan Forzado", desc: "Ignorar cache y re-escanear todo", icon: IconUiRefresh, variant: "secondary" as const, action: () => scanLibrary({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Match Manual", desc: "Resolver archivos no vinculados", icon: IconUiLink, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Limpiar Huérfanos", desc: "Eliminar entradas sin archivo (no implementado)", icon: IconUiDelete, variant: "destructive" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Actualizar Metadatos", desc: "Refrescar info de TMDB/AniList", icon: IconStatusDatabase, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Configurar Pre-Transcode", desc: "Gestionar caché y perfiles", icon: IconStatusImage, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "performance" } }) },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {actions.map((action, i) => {
                if (action.variant === "destructive") {
                    return (
                        <div key={i} className="w-full text-left sectionbar p-5 transition duration-base flex flex-col justify-between">
                            <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500/15 text-red-400 border border-red-500/25">
                                    <action.icon size={20} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-on-surface tracking-wide uppercase font-mono">{action.label}</h3>
                                    <p className="text-2xs text-on-surface-variant/70 mt-0.5">{action.desc}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                                <span className="text-3xs font-mono text-on-surface-variant/60 uppercase">No implementado</span>
                                <span className="text-3xs font-mono px-2 py-1 rounded bg-white/5 border border-white/10 text-on-surface-variant/70 uppercase">
                                    Próximamente
                                </span>
                            </div>
                        </div>
                    )
                }
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={action.action}
                        className="w-full text-left sectionbar p-5 cursor-pointer transition duration-base hover:border-white/30 hover:bg-white/[0.04] active:scale-[0.98] group flex flex-col justify-between"
                    >
                        <div className="flex items-start gap-3.5">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform",
                                action.variant === "primary" && "bg-brand-accent/15 text-brand-accent border border-brand-accent/25",
                                action.variant === "secondary" && "bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/25",
                                action.variant === "outline" && "bg-white/[0.04] border border-white/10 text-on-surface-variant",
                                (action.variant as string) === "magic" && "bg-brand-magic/15 text-brand-magic border border-brand-magic/25",
                            )}>
                                <action.icon size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-on-surface tracking-wide uppercase font-mono">{action.label}</h3>
                                <p className="text-2xs text-on-surface-variant/70 mt-0.5">{action.desc}</p>
                            </div>
                            <IconArrowRight size={18} className="text-on-surface-variant/70 group-hover:text-brand-accent group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

function AdminServicesGrid() {
    const { data: settings } = useGetSettings()
    const { data: ffmpegStatus } = useGetFFmpegStatus()
    const tmdbConfigured = Boolean(settings?.library?.tmdbApiKey)
    const hasPaths = Boolean((settings?.library?.seriesPaths?.length ?? 0) > 0 || (settings?.library?.moviePaths?.length ?? 0) > 0)
    const ffmpegReady = Boolean(ffmpegStatus?.ffmpegAvailable)

    const services = [
        {
            name: "TMDB",
            status: tmdbConfigured ? "connected" : "disconnected",
            desc: "Metadatos y afiches oficiales de películas y series",
            lastSync: tmdbConfigured ? "Vinculado" : "Sin configurar",
            icon: IconStatusCloud,
            tab: "system",
        },
        {
            name: "AniList",
            status: "unknown",
            desc: "Metadatos canónicos de anime y personajes",
            lastSync: "No monitoreado",
            icon: IconStatusDatabase,
            tab: "system",
        },
        {
            name: "Biblioteca Local",
            status: hasPaths ? "connected" : "disconnected",
            desc: "Directorios locales escaneados en tiempo real",
            lastSync: hasPaths ? "Monitoreado" : "Sin carpetas",
            icon: IconNavigationLibrary,
            tab: "library",
        },
        {
            name: "Motor de Video / FFmpeg",
            status: ffmpegReady ? "connected" : "disconnected",
            desc: "Aceleración por hardware y transcodificación HLS",
            lastSync: ffmpegReady ? "Listo" : "No instalado",
            icon: IconStatusZap,
            tab: "performance",
        },
        {
            name: "Continuidad y Marcas Skip",
            status: settings?.library?.enableWatchContinuity ? "connected" : "disconnected",
            desc: "Historial sincronizado y detección acústica",
            lastSync: settings?.library?.enableWatchContinuity ? "Activo" : "Desactivado",
            icon: IconMediaWand,
            tab: "playback",
        },
        {
            name: "Música Ambiental y Audio",
            status: "unknown",
            desc: "Bandas sonoras de era y efectos sonoros",
            lastSync: "No monitoreado",
            icon: IconStatusMusic,
            tab: "playback",
        },
    ]

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "connected": return { color: "var(--brand-success)", label: "Conectado", icon: IconUiCheckCircle }
            case "disconnected": return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconectado", icon: IconUiXCircle }
            case "error": return { color: "var(--brand-destructive)", label: "Error", icon: IconUiAlertCircle }
            case "unknown": return { color: "var(--md-sys-color-on-surface-variant)", label: "No monitoreado", icon: IconUiHelpCircle }
            default: return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconocido", icon: IconUiHelpCircle }
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {services.map((service, i) => {
                const status = getStatusConfig(service.status)
                return (
                    <div key={i} className="sectionbar p-5 transition duration-base hover:border-white/25 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                                    <service.icon size={20} className="text-on-surface-variant/80" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xs font-bold text-on-surface tracking-wide uppercase font-mono truncate">{service.name}</h3>
                                    <p className="text-2xs text-on-surface-variant/70 mt-0.5 line-clamp-2">{service.desc}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <status.icon size={14} className="shrink-0" style={{ color: status.color }} />
                                <span className="text-3xs font-mono font-bold uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex items-center justify-between">
                            <span className="text-2xs text-on-surface-variant/70">Estado: <span className="font-mono text-on-surface ml-1">{service.lastSync}</span></span>
                            <Link
                                to="/settings"
                                search={{ tab: service.tab }}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 text-on-surface-variant font-semibold text-xs rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.06] hover:text-white active:scale-95 transition min-h-[30px]"
                            >
                                Configurar
                            </Link>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function StatBar({ label, value, max, display, color }: { label: string; value: number; max: number; display: string; color?: string }) {
    const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
                <span>{label}</span>
                <span className="font-mono normal-case tracking-normal" style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/5">
                <div
                    className="h-full rounded-full transition-[width] duration-base ease-smooth-out"
                    style={{ width: `${percent}%`, background: color || "var(--brand-accent)" }}
                />
            </div>
        </div>
    )
}

function formatGb(bytes: number | undefined): string {
    return ((bytes || 0) / 1024 / 1024 / 1024).toFixed(1)
}

function AdminTranscodePanel({ trStats }: { trStats?: ReturnType<typeof useGetTranscodeStats>["data"] }) {
    const stats = trStats

    const governor = stats?.governor
    const system = stats?.system
    const gpu = stats?.gpu

    return (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Motor de transcodificación */}
            <div className="sectionbar p-5 flex flex-col gap-4.5 hover:border-white/25 transition duration-base">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-on-surface">Motor de Streaming</h3>
                    <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-mono font-bold uppercase tracking-wider border",
                        stats?.transcoderInitialized
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-white/5 border-white/10 text-on-surface-variant"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", stats?.transcoderInitialized ? "bg-emerald-400 animate-pulse" : "bg-on-surface-variant/50")} />
                        {stats?.transcoderInitialized ? "Activo" : "En reposo"}
                    </span>
                </div>
                {governor ? (
                    <>
                        <StatBar
                            label="Procesos ffmpeg"
                            value={governor.activeProcesses}
                            max={governor.maxConcurrency}
                            display={`${governor.activeProcesses} / ${governor.maxConcurrency}`}
                        />
                        <StatBar
                            label="Sesiones NVENC"
                            value={governor.activeNvenc}
                            max={governor.nvencCap}
                            display={`${governor.activeNvenc} / ${governor.nvencCap}`}
                            color="var(--brand-success)"
                        />
                        <div className="flex items-center justify-between text-2xs text-on-surface-variant/70 mt-auto pt-3.5 border-t border-white/[0.08]">
                            <span>Lanzados: <span className="font-mono text-on-surface ml-1">{governor.totalLaunched}</span></span>
                            <span>Completados: <span className="font-mono text-on-surface ml-1">{governor.totalCompleted}</span></span>
                        </div>
                    </>
                ) : (
                    <p className="text-2xs text-on-surface-variant/70 my-auto">
                        El transcoder está dormido. Se despierta al reproducir un stream que lo necesite.
                    </p>
                )}
                <div className="flex items-center justify-between text-2xs text-on-surface-variant/70">
                    <span>Cola de pre-transcode</span>
                    <span className="font-mono text-on-surface font-semibold">{stats?.preTranscodeQueue ?? 0}</span>
                </div>
            </div>

            {/* Sistema */}
            <div className="sectionbar p-5 flex flex-col gap-4.5 hover:border-white/25 transition duration-base">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-on-surface">Sistema</h3>
                <StatBar
                    label="CPU"
                    value={system?.cpuPercent || 0}
                    max={100}
                    display={`${(system?.cpuPercent || 0).toFixed(1)}%`}
                />
                <StatBar
                    label="Memoria RAM"
                    value={system?.memoryUsed || 0}
                    max={system?.memoryTotal || 1}
                    display={`${formatGb(system?.memoryUsed)} / ${formatGb(system?.memoryTotal)} GB`}
                    color="var(--brand-secondary)"
                />
            </div>

            {/* GPU (solo si nvidia-smi respondió) */}
            <div className="sectionbar p-5 flex flex-col gap-4.5 hover:border-white/25 transition duration-base">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-on-surface">GPU · NVIDIA</h3>
                {gpu ? (
                    <>
                        <StatBar label="Uso de GPU" value={gpu.utilization} max={100} display={`${gpu.utilization}%`} />
                        <StatBar label="Encoder NVENC" value={gpu.encoder} max={100} display={`${gpu.encoder}%`} color="var(--brand-success)" />
                        <StatBar
                            label="VRAM"
                            value={gpu.memoryUsed}
                            max={gpu.memoryTotal || 1}
                            display={`${gpu.memoryUsed} / ${gpu.memoryTotal} MB`}
                            color="var(--brand-magic)"
                        />
                    </>
                ) : (
                    <p className="text-2xs text-on-surface-variant/70 my-auto">
                        No se detectó nvidia-smi en el servidor.
                    </p>
                )}
            </div>
        </div>
        <PreTranscodeJobsList />
        </>
    )
}

/** Filas de carga con la misma caja que las filas reales, para que nada salte al llegar los datos. */
function AdminRowSkeletons({ count }: { count: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="h-[58px] rounded-xl" />
            ))}
        </>
    )
}

function PreTranscodeJobsList() {
    const { data: jobs, isLoading } = useGetPreTranscodeJobs()
    const { mutate: cancelJob, isPending: isCancelling } = useCancelPreTranscode()

    if (isLoading) {
        return (
            <div className="sectionbar p-5 mt-3.5 space-y-2.5" role="status" aria-label="Cargando cola de pre-transcode">
                <Skeleton className="h-3 w-40 rounded-full" />
                <AdminRowSkeletons count={2} />
            </div>
        )
    }
    if (!jobs || jobs.length === 0) return null

    return (
        <div className="sectionbar p-5 mt-3.5">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-on-surface mb-3">
                Cola de Pre-Transcode ({jobs.length})
            </h3>
            <div className="space-y-2.5">
                {jobs.map((job) => (
                    <div key={job.hash} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-on-surface truncate" title={job.filePath}>{job.filePath}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-brand-accent transition-[width]"
                                        style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                                    />
                                </div>
                                <span className="text-3xs font-mono text-on-surface-variant/70 shrink-0">
                                    {job.status} · {Math.round(job.progress)}%
                                </span>
                            </div>
                            {job.error && (
                                <p className="text-3xs text-red-400 mt-1 truncate">{job.error}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => cancelJob(job.hash)}
                            disabled={isCancelling}
                            title="Cancelar pre-transcode"
                            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant hover:text-red-400 hover:border-red-500/40 active:scale-95 transition disabled:opacity-50"
                        >
                            <IconUiDelete size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

function AdminSystemGrid() {
    const navigate = useNavigate()

    const items = [
        { label: "Logs y Diagnóstico", desc: "Ver reportes y eventos del sistema", icon: IconStatusFile, action: () => navigate({ to: "/settings", search: { tab: "system" } }) },
        { label: "Configuración Avanzada", desc: "Ajustes de rendimiento y hardware", icon: IconUiSliders, action: () => navigate({ to: "/settings", search: { tab: "performance" } }) },
        { label: "Rutas de Biblioteca", desc: "Gestionar carpetas de series y películas", icon: IconNavigationUsers, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Backup y Base de Datos", desc: "Respaldos y mantenimiento de SQLite", icon: IconStatusHdd, action: () => navigate({ to: "/settings", search: { tab: "system" } }) },
        { label: "Apariencia y Temas", desc: "Personalización visual y eras", icon: IconUiRefresh, action: () => navigate({ to: "/settings", search: { tab: "appearance" } }) },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {items.map((item, i) => (
                <button key={i} type="button" onClick={item.action} className="w-full text-left sectionbar p-5 cursor-pointer transition duration-base hover:border-white/30 hover:bg-white/[0.04] active:scale-[0.98] group flex flex-col justify-between">
                    <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:bg-white/[0.08] group-hover:border-white/20 transition shrink-0">
                            <item.icon size={20} className="text-on-surface-variant/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-on-surface tracking-wide uppercase font-mono">{item.label}</h3>
                            <p className="text-2xs text-on-surface-variant/70 mt-0.5">{item.desc}</p>
                        </div>
                        <IconArrowRight size={18} className="text-on-surface-variant/70 group-hover:text-brand-accent group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                    </div>
                </button>
            ))}
        </div>
    )
}

function AdminLogsViewer() {
    const { data: filenames, isLoading: isLoadingFiles } = useGetLogFilenames()
    const [selected, setSelected] = useState<string | null>(null)
    const { data: content, isLoading: isLoadingContent } = useGetLogContent(selected)
    const { mutate: deleteLogs, isPending: isDeleting } = useDeleteLogs()
    const files = filenames ?? []
    const shown = (content ?? "").split("\n").slice(-300).join("\n")

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
                <select
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value || null)}
                    disabled={isLoadingFiles || files.length === 0}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white min-h-[40px] disabled:opacity-50"
                >
                    <option value="">Último log</option>
                    {files.map((f) => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => {
                        if (!selected) {
                            toast.error("Selecciona un archivo para eliminar (el actual está protegido)")
                            return
                        }
                        deleteLogs({ filenames: [selected] }, {
                            onSuccess: () => setSelected(null),
                        })
                    }}
                    disabled={isDeleting || !selected}
                    className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 active:scale-95 transition disabled:opacity-50 min-h-[40px]"
                >
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                </button>
            </div>
            <pre className="max-h-[400px] overflow-auto p-4 rounded-xl bg-black/40 border border-white/10 text-3xs font-mono text-on-surface-variant whitespace-pre-wrap break-all">
                {isLoadingContent ? "Cargando..." : shown || "Sin contenido."}
            </pre>
        </div>
    )
}

function AdminRecentActivity() {
    const navigate = useNavigate()
    const { data: notifData, isLoading } = useGetNotifications()
    const notifications = (notifData?.notifications ?? []).slice(0, 6)

    const iconForType = (type: string) => {
        switch (type) {
            case "scanner": return { icon: IconNavigationSearch, color: "var(--brand-success)" }
            case "mediastream": return { icon: IconStatusZap, color: "var(--brand-secondary)" }
            default: return { icon: IconStatusActivity, color: "var(--brand-primary)" }
        }
    }

    return (
        <SectionBar
            label="Actividad Reciente"
            description="Eventos del sistema y sincronizaciones automáticas"
            icon={IconStatusActivity}
            variant="default"
            className="mb-8"
        >
            <div className="pt-2 space-y-4">
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => navigate({ to: "/settings", search: { tab: "system" } })}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-on-surface-variant font-semibold text-xs rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.06] hover:text-white active:scale-95 transition cursor-pointer min-h-[32px]"
                    >
                        Ver Todo en Sistema
                        <IconArrowRight size={13} strokeWidth={2.5} />
                    </button>
                </div>
                <div className="space-y-2.5">
                    {isLoading ? (
                        <div role="status" aria-label="Cargando actividad" className="space-y-2.5">
                            <AdminRowSkeletons count={3} />
                        </div>
                    ) : notifications.length === 0 ? (
                        <p className="text-2xs text-on-surface-variant/70">Sin actividad reciente.</p>
                    ) : (
                        notifications.map((n) => {
                            const cfg = iconForType(n.type)
                            return (
                                <div key={n.id} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, color: cfg.color }}>
                                        <cfg.icon size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-on-surface">{n.title}: {n.message}</p>
                                        <p className="text-3xs text-on-surface-variant/70 mt-0.5">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
                                    </div>
                                    <span className="text-4xs font-mono text-on-surface-variant/60 uppercase tracking-wider shrink-0 mt-0.5">{n.type}</span>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </SectionBar>
    )
}