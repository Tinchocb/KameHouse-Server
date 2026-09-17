import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { motion, useReducedMotion } from "framer-motion"
import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconUiDownload, IconNavigationTv, IconNavigationFilm, IconStatusActivity, IconStatusHdd, IconStatusPulse, IconNavigationSearch, IconUiRefresh, IconUiLink, IconUiDelete, IconStatusDatabase, IconStatusImage, IconArrowRight, IconStatusCloud, IconNavigationLibrary, IconStatusZap, IconMediaWand, IconStatusMusic, IconUiCheckCircle, IconUiXCircle, IconUiAlertCircle, IconUiHelpCircle, IconStatusFile, IconUiSliders, IconNavigationUsers } from "@/components/ui/icons";
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useGetLibraryStats, useGetTranscodeStats } from "@/api/hooks/admin.hooks"
import { useBackupDatabase } from "@/api/hooks/system.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { toast } from "sonner"

export const Route = createFileRoute("/admin/")({
    component: AdminPage,
})

function AdminPage() {
    const { data: trStats } = useGetTranscodeStats()

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen text-on-surface bg-surface-dim font-sans antialiased selection:bg-brand-accent/30 selection:text-white"
        >
            <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                <AdminHeader />

                <main className="mt-8 md:mt-12 space-y-8 md:space-y-10">
                    <AdminStatsGrid trStats={trStats} />

                    <AdminSection title="Gestión de Biblioteca" subtitle="Escaneo y sincronización">
                        <AdminActionsGrid />
                    </AdminSection>

                    <AdminSection title="Transcodificación" subtitle="Motor de streaming, CPU, RAM y GPU en tiempo real">
                        <AdminTranscodePanel trStats={trStats} />
                    </AdminSection>

                    <AdminSection title="Servicios Externos" subtitle="TMDB, AniList, Trakt, etc.">
                        <AdminServicesGrid />
                    </AdminSection>

                    <AdminSection title="Sistema" subtitle="Configuración y monitoreo">
                        <AdminSystemGrid />
                    </AdminSection>

                    <AdminRecentActivity />
                </main>
            </div>
        </motion.div>
    )
}

function AdminHeader() {
    const { mutate: backupDb, isPending: isBackingUp } = useBackupDatabase()

    const handleBackup = () => {
        backupDb(undefined, {
            onSuccess: () => {
                toast.success("Respaldo de base de datos generado con éxito")
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
                            disabled={isBackingUp}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 h-10 border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-button transition-all duration-fast hover:border-brand-accent hover:bg-brand-accent/10 active:scale-[0.97] disabled:opacity-50"
                        >
                            <IconUiDownload size={16} strokeWidth={2.5} />
                            {isBackingUp ? "Creando..." : "Backup"}
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
        { label: "Medios", value: libStats?.totalMedia?.toString() || "0", change: "Series y Películas", trend: "neutral", icon: IconNavigationTv, color: "var(--brand-primary)" },
        { label: "Archivos", value: libStats?.totalLocalFiles?.toString() || "0", change: "Ficheros indexados", trend: "neutral", icon: IconNavigationFilm, color: "var(--brand-secondary)" },
        { label: "CPU", value: `${cpuPercent}%`, change: "Uso del sistema", trend: "neutral", icon: IconStatusActivity, color: "var(--brand-success)" },
        { label: "Memoria", value: `${memoryUsed} GB`, change: `De ${memoryTotal} GB totales`, trend: "neutral", icon: IconStatusHdd, color: "var(--brand-magic)" },
        { label: "Transcoder NVENC", value: trStats?.transcoderInitialized && trStats.governor ? `${trStats.governor.activeNvenc} / ${trStats.governor.nvencCap}` : "Inactivo", change: "Sesiones GPU activas", trend: "neutral", icon: IconNavigationTv, color: "var(--md-sys-color-on-surface-variant)" },
        { label: "Pre-Transcode", value: trStats?.preTranscodeQueue?.toString() || "0", change: "En cola", trend: "neutral", icon: IconStatusPulse, color: "var(--brand-success)" },
    ], [libStats, trStats, cpuPercent, memoryUsed, memoryTotal])

    return (
        <section aria-labelledby="stats-title" className="mb-4">
            <h2 id="stats-title" className="sr-only">Estadísticas Generales</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-surface-container shadow-elevation-3 rounded-container p-6 backdrop-blur-overlay-md border border-outline-variant relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-on-surface/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-start justify-between">
                            <stat.icon size={28} className="text-on-surface-variant group-hover:text-on-surface transition-colors" style={{ color: stat.color }} />
                            <span className="text-caption text-on-surface-variant/70 uppercase tracking-wider">{stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "—"}</span>
                        </div>
                        <div className="text-h3 font-display text-on-surface font-extrabold tracking-tight mt-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {stat.value}
                        </div>
                        <div className="text-label-md mt-1">
                            <span className="text-on-surface-variant">{stat.label}</span>
                            <span className="text-on-surface-variant/70 ml-2">{stat.change}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function AdminSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="mb-8 md:mb-10" aria-labelledby={title.toLowerCase().replace(/\s+/g, '-')}>
            <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                    <h2 id={title.toLowerCase().replace(/\s+/g, '-')} className="text-h3 font-display text-on-surface uppercase tracking-wide">
                        {title}
                    </h2>
                    {subtitle && <p className="text-body-sm text-on-surface-variant/70 mt-1">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    )
}

function AdminActionsGrid() {
    const navigate = useNavigate()
    const { mutate: scanLibrary } = useScanLocalFiles()

    const actions = [
        { label: "Escanear Biblioteca", desc: "Detectar nuevos archivos", icon: IconNavigationSearch, variant: "primary" as const, action: () => scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Re-Scan Forzado", desc: "Ignorar cache y re-escanear todo", icon: IconUiRefresh, variant: "secondary" as const, action: () => scanLibrary({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Match Manual", desc: "Resolver archivos no vinculados", icon: IconUiLink, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Limpiar Huérfanos", desc: "Eliminar entradas sin archivo", icon: IconUiDelete, variant: "destructive" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Actualizar Metadatos", desc: "Refrescar info de TMDB/AniList", icon: IconStatusDatabase, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Configurar Pre-Transcode", desc: "Gestionar caché y perfiles", icon: IconStatusImage, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "performance" } }) },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actions.map((action, i) => (
                <div key={i} onClick={action.action} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action.action(); } }} className="bg-surface-container shadow-elevation-3 rounded-container p-6 backdrop-blur-overlay-md border border-outline-variant cursor-pointer transition-all duration-base hover:shadow-elevation-4 active:scale-[0.98] group">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform",
                            action.variant === "primary" && "bg-brand-accent/20 text-brand-accent",
                            action.variant === "secondary" && "bg-brand-secondary/20 text-brand-secondary",
                            action.variant === "destructive" && "bg-brand-destructive/20 text-brand-destructive",
                            action.variant === "outline" && "bg-surface-container border border-outline-variant text-on-surface-variant",
                            (action.variant as string) === "magic" && "bg-brand-magic/20 text-brand-magic",
                        )}>
                            <action.icon size={24} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-h6 font-display text-on-surface tracking-wide">{action.label}</h3>
                            <p className="text-body-sm text-on-surface-variant/70 mt-1">{action.desc}</p>
                        </div>
                        <IconArrowRight size={20} className="text-on-surface-variant/70 group-hover:text-brand-accent transition-colors shrink-0 mt-1" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function AdminServicesGrid() {
    const { data: settings } = useGetSettings()
    const tmdbConfigured = Boolean(settings?.library?.tmdbApiKey)
    const hasPaths = Boolean((settings?.library?.seriesPaths?.length ?? 0) > 0 || (settings?.library?.moviePaths?.length ?? 0) > 0)

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
            status: "connected",
            desc: "Metadatos canónicos de anime y personajes",
            lastSync: "En línea",
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
            status: "connected",
            desc: "Aceleración por hardware y transcodificación HLS",
            lastSync: "Listo",
            icon: IconStatusZap,
            tab: "performance",
        },
        {
            name: "Continuidad y Marcas Skip",
            status: settings?.library?.enableWatchContinuity ? "connected" : "disconnected",
            desc: "Historial sincronizado y detección acústica",
            lastSync: "Activo",
            icon: IconMediaWand,
            tab: "playback",
        },
        {
            name: "Música Ambiental y Audio",
            status: "connected",
            desc: "Bandas sonoras de era y efectos sonoros",
            lastSync: "Listo",
            icon: IconStatusMusic,
            tab: "playback",
        },
    ]

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "connected": return { color: "var(--brand-success)", label: "Conectado", icon: IconUiCheckCircle }
            case "disconnected": return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconectado", icon: IconUiXCircle }
            case "error": return { color: "var(--brand-destructive)", label: "Error", icon: IconUiAlertCircle }
            default: return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconocido", icon: IconUiHelpCircle }
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service, i) => {
                const status = getStatusConfig(service.status)
                return (
                    <div key={i} className="bg-surface-container shadow-elevation-3 rounded-container p-6 backdrop-blur-overlay-md border border-outline-variant">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-center">
                                    <service.icon size={24} className="text-on-surface-variant/80" />
                                </div>
                                <div>
                                    <h3 className="text-h6 font-display text-on-surface tracking-wide">{service.name}</h3>
                                    <p className="text-body-sm text-on-surface-variant/70 mt-1">{service.desc}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <status.icon size={16} className="shrink-0" style={{ color: status.color }} />
                                <span className="text-caption font-bold uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-outline-variant flex items-center justify-between">
                            <span className="text-caption text-on-surface-variant/70">Estado: </span>
                            <span className="text-caption text-on-surface-variant font-mono">{service.lastSync}</span>
                            <Link
                                to="/settings"
                                search={{ tab: service.tab }}
                                className="inline-flex items-center justify-center gap-1.5 px-3 h-7 text-on-surface-variant font-semibold text-xs rounded-button transition-all duration-fast hover:bg-surface-container hover:text-white active:scale-[0.97]"
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
                    className="h-full rounded-full transition-all duration-base ease-smooth-out"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Motor de transcodificación */}
            <div className="bg-surface-container shadow-elevation-3 rounded-container p-6 border border-outline-variant flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-h6 font-display text-on-surface tracking-wide">Motor de Streaming</h3>
                    <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold uppercase tracking-widest border",
                        stats?.transcoderInitialized
                            ? "bg-brand-success/15 border-brand-success/30 text-brand-success"
                            : "bg-white/5 border-white/10 text-on-surface-variant"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", stats?.transcoderInitialized ? "bg-brand-success animate-pulse" : "bg-on-surface-variant/50")} />
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
                        <div className="flex items-center justify-between text-body-sm text-on-surface-variant/70 mt-auto pt-4 border-t border-outline-variant">
                            <span>Lanzados: <span className="font-mono text-on-surface-variant">{governor.totalLaunched}</span></span>
                            <span>Completados: <span className="font-mono text-on-surface-variant">{governor.totalCompleted}</span></span>
                        </div>
                    </>
                ) : (
                    <p className="text-body-sm text-on-surface-variant/70 my-auto">
                        El transcoder está dormido. Se despierta al reproducir un stream que lo necesite.
                    </p>
                )}
                <div className="flex items-center justify-between text-body-sm text-on-surface-variant/70">
                    <span>Cola de pre-transcode</span>
                    <span className="font-mono text-on-surface-variant">{stats?.preTranscodeQueue ?? 0}</span>
                </div>
            </div>

            {/* Sistema */}
            <div className="bg-surface-container shadow-elevation-3 rounded-container p-6 border border-outline-variant flex flex-col gap-5">
                <h3 className="text-h6 font-display text-on-surface tracking-wide">Sistema</h3>
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
            <div className="bg-surface-container shadow-elevation-3 rounded-container p-6 border border-outline-variant flex flex-col gap-5">
                <h3 className="text-h6 font-display text-on-surface tracking-wide">GPU · NVIDIA</h3>
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
                    <p className="text-body-sm text-on-surface-variant/70 my-auto">
                        No se detectó nvidia-smi en el servidor.
                    </p>
                )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, i) => (
                <div key={i} onClick={item.action} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.action(); } }} className="bg-surface-container shadow-elevation-3 rounded-container p-6 backdrop-blur-overlay-md border border-outline-variant cursor-pointer transition-all duration-base hover:shadow-elevation-4 active:scale-[0.98] group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-center group-hover:bg-surface-container-high transition-colors">
                            <item.icon size={24} className="text-on-surface-variant/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-h6 font-display text-on-surface tracking-wide">{item.label}</h3>
                            <p className="text-body-sm text-on-surface-variant/70 mt-1">{item.desc}</p>
                        </div>
                        <IconArrowRight size={20} className="text-on-surface-variant/70 group-hover:text-brand-accent transition-colors shrink-0 mt-1" />
                    </div>
                </div>
            ))}
        </div>
    )
}

const ADMIN_STATIC_ACTIVITIES = [
    { time: "Hace 5 min", type: "scan", message: "Escaneo completado: 12 series, 3 películas nuevas", icon: IconUiCheckCircle, color: "var(--brand-success)" },
    { time: "Hace 15 min", type: "match", message: "Match manual: Dragon Ball GT vinculado correctamente", icon: IconUiLink, color: "var(--brand-primary)" },
    { time: "Hace 1 hora", type: "sync", message: "Sincronización TMDB completada: 247 items actualizados", icon: IconStatusCloud, color: "var(--brand-secondary)" },
    { time: "Hace 3 horas", type: "error", message: "Error en Trakt API: Rate limit exceeded", icon: IconUiAlertCircle, color: "var(--brand-destructive)" },
    { time: "Hace 6 horas", type: "backup", message: "Backup automático completado: 2.1 GB", icon: IconStatusHdd, color: "var(--brand-magic)" },
    { time: "Ayer", type: "scan", message: "Escaneo programado: 0 nuevos items", icon: IconNavigationSearch, color: "var(--muted-foreground)" },
]

function AdminRecentActivity() {
    const navigate = useNavigate()

    return (
        <section aria-labelledby="activity-title" className="mb-4">
            <h2 id="activity-title" className="sr-only">Actividad Reciente</h2>
            <div className="bg-surface-container shadow-elevation-3 rounded-container p-6 backdrop-blur-overlay-md border border-outline-variant">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-h5 font-display text-on-surface uppercase tracking-wide">Actividad Reciente</h3>
                    <button
                        type="button"
                        onClick={() => navigate({ to: "/settings", search: { tab: "system" } })}
                        className="inline-flex items-center justify-center gap-2 px-4 h-9 text-on-surface-variant font-semibold text-xs rounded-button transition-all duration-fast hover:bg-surface-container active:scale-[0.97] cursor-pointer"
                    >
                        Ver Todo
                        <IconArrowRight size={14} strokeWidth={2.5} className="ml-1" />
                    </button>
                </div>
                <div className="space-y-4">
                    {ADMIN_STATIC_ACTIVITIES.map((activity, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-surface-container border border-outline-variant hover:border-surface-container-high transition-colors">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${activity.color} 12%, transparent)`, color: activity.color }}>
                                <activity.icon size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-body-md text-on-surface">{activity.message}</p>
                                <p className="text-caption text-on-surface-variant/70 mt-1">{activity.time}</p>
                            </div>
                            <span className="text-caption text-on-surface-variant/70 uppercase tracking-wider shrink-0 mt-1">{activity.type}</span>
                        </div>
                    ))}
                </div>
                </div>
        </section>
    )
}