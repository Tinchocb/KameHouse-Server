import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { m } from "framer-motion"
import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Button, ButtonAnatomy } from "@/components/ui/button"
import {
    IconNavigationTv,
    IconNavigationFilm,
    IconStatusActivity,
    IconStatusHdd,
    IconStatusPulse,
    IconNavigationSearch,
    IconUiRefresh,
    IconUiLink,
    IconUiDelete,
    IconStatusDatabase,
    IconStatusImage,
    IconArrowRight,
    IconStatusCloud,
    IconNavigationLibrary,
    IconStatusZap,
    IconMediaWand,
    IconStatusMusic,
    IconUiCheckCircle,
    IconUiXCircle,
    IconUiAlertCircle,
    IconUiHelpCircle,
    IconStatusFile,
    IconUiSliders,
    IconNavigationUsers,
} from "@/components/ui/icons"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useGetLibraryStats, useGetTranscodeStats } from "@/api/hooks/admin.hooks"
import { useGetNotifications } from "@/api/hooks/notifications.hooks"
import { useGetFFmpegStatus } from "@/api/hooks/mediastream.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { SectionBar } from "@/components/ui/sectionbar"
import { ElasticCounter, LoadSwap } from "@/components/ui/kinetics"
import { AdminHeader } from "./-components/admin-header"
import { AdminTranscodePanel, AdminRowSkeletons } from "./-components/admin-transcode-panel"
import { ServerLogsViewer } from "@/components/settings/server-logs-viewer"

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
            className="min-h-screen text-on-surface font-sans antialiased"
        >
            <div className="page-container pt-nav pb-8 sm:pb-10">
                <AdminHeader />

                <div className="mt-8 md:mt-12 space-y-6 md:space-y-8">
                    <AdminStatsGrid trStats={trStats} />

                    <AdminSection title="Gestión de la biblioteca" subtitle="Escaneo y sincronización" icon={IconNavigationLibrary}>
                        <AdminActionsGrid />
                    </AdminSection>

                    <AdminSection title="Conversión de video" subtitle="Transcodificación en vivo: motor, CPU, memoria y GPU" icon={IconStatusZap}>
                        <AdminTranscodePanel trStats={trStats} />
                    </AdminSection>

                    <AdminSection title="Servicios externos" subtitle="TMDB, AniList y otros" icon={IconStatusCloud}>
                        <AdminServicesGrid />
                    </AdminSection>

                    <AdminSection title="Sistema" subtitle="Ajustes y monitoreo" icon={IconUiSliders}>
                        <AdminSystemGrid />
                    </AdminSection>

                    <AdminSection title="Registros del servidor" subtitle="Visor y limpieza de los archivos de registro" icon={IconStatusFile}>
                        <ServerLogsViewer />
                    </AdminSection>

                    <AdminRecentActivity />
                </div>
            </div>
        </m.div>
    )
}


function AdminStatsGrid({ trStats }: { trStats?: ReturnType<typeof useGetTranscodeStats>["data"] }) {
    const { data: libStats } = useGetLibraryStats()

    const cpuPercent = trStats?.system?.cpuPercent?.toFixed(1) || "0.0"
    const memoryTotal = trStats?.system?.memoryTotal ? (trStats.system.memoryTotal / 1024 / 1024 / 1024).toFixed(1) : "0.0"
    const memoryUsed = trStats?.system?.memoryUsed ? (trStats.system.memoryUsed / 1024 / 1024 / 1024).toFixed(1) : "0.0"

    const stats = React.useMemo(() => [
        { label: "Títulos", count: libStats?.totalMedia, change: "Series y películas", icon: IconNavigationTv, color: "hsl(var(--brand-accent))" },
        { label: "Archivos", count: libStats?.totalLocalFiles, change: "En la biblioteca", icon: IconNavigationFilm, color: "hsl(var(--brand-accent))" },
        { label: "CPU", value: `${cpuPercent}%`, change: "Uso del sistema", icon: IconStatusActivity, color: "var(--status-success)" },
        { label: "Memoria", value: `${memoryUsed} GB`, change: `De ${memoryTotal} GB totales`, icon: IconStatusHdd, color: "var(--brand-accent-hex)" },
        { label: "GPU (NVENC)", value: trStats?.transcoderInitialized && trStats.governor ? `${trStats.governor.activeNvenc} / ${trStats.governor.nvencCap}` : "Inactiva", change: "Sesiones de GPU activas", icon: IconNavigationTv, color: "var(--md-sys-color-on-surface-variant)" },
        { label: "Conversión previa", count: trStats?.preTranscodeQueue, change: "En cola", icon: IconStatusPulse, color: "var(--status-success)" },
    ], [libStats, trStats, cpuPercent, memoryUsed, memoryTotal])

    return (
        <section aria-labelledby="stats-title" className="mb-6">
            <h2 id="stats-title" className="sr-only">Estadísticas generales</h2>
            {/* Un solo contenedor de vidrio para los 6 datos: cada tarjeta suelta sumaba un blur (Admin llegaba a 16 nodos). */}
            <div className="surface-content rounded-2xl p-3.5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-4 relative overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] transition-colors duration-base ease-smooth-out">
                        <div className="flex items-start justify-between">
                            <stat.icon size={22} className="text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface transition-colors duration-fast ease-smooth-out" style={{ color: stat.color }} />
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
                            <span className="text-label-2 text-3xs truncate block mt-0.5">{stat.change}</span>
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
            variant="content"
            label={title}
            description={subtitle}
            icon={icon}
            badge={badge}
            collapsible={collapsible}
            defaultOpen={defaultOpen}
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
        { label: "Escanear biblioteca", desc: "Detecta archivos nuevos", icon: IconNavigationSearch, variant: "primary" as const, action: () => scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Escaneo profundo", desc: "Ignora la caché y analiza todo de nuevo", icon: IconUiRefresh, variant: "secondary" as const, action: () => scanLibrary({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false }) },
        { label: "Coincidencia manual", desc: "Vincula archivos sin identificar", icon: IconUiLink, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Limpiar huérfanos", desc: "Elimina entradas de la biblioteca que ya no tienen archivo", icon: IconUiDelete, variant: "destructive" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Metadatos", desc: "Elige el proveedor y el idioma de los metadatos", icon: IconStatusDatabase, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Rendimiento y video", desc: "Perfil de rendimiento y motor de video", icon: IconStatusImage, variant: "outline" as const, action: () => navigate({ to: "/settings", search: { tab: "performance" } }) },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {actions.map((action, i) => {
                if (action.variant === "destructive") {
                    return (
                        <div key={i} className="w-full text-left rounded-xl bg-[var(--neutral-elev-1)] border border-[var(--neutral-separator)] p-5 flex flex-col justify-between">
                            <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-status-error/15 text-status-error border border-status-error/25">
                                    <action.icon size={20} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-on-surface">{action.label}</h3>
                                    <p className="text-2xs text-label-2 mt-0.5">{action.desc}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[var(--neutral-separator)] flex items-center justify-end gap-2">
                                <span className="text-2xs px-2 py-1 rounded bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)] text-on-surface-variant">
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
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full text-left rounded-xl bg-[var(--neutral-elev-1)] border border-[var(--neutral-separator)] p-5 cursor-pointer transition-[background-color,transform] duration-fast ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-2)] active:scale-[0.98] group flex flex-col justify-between"
                    >
                        <div className="flex items-start gap-3.5">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-fast ease-smooth-out",
                                action.variant === "primary" && "bg-brand-accent/15 text-brand-accent-readable border border-brand-accent/25",
                                action.variant === "secondary" && "bg-brand-accent/15 text-brand-accent-readable border border-brand-accent/25",
                                action.variant === "outline" && "bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] text-on-surface-variant",
                            )}>
                                <action.icon size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-bold text-on-surface">{action.label}</h3>
                                <p className="text-2xs text-label-2 mt-0.5">{action.desc}</p>
                            </div>
                            <IconArrowRight size={18} className="text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 transition-[transform,color] duration-fast ease-smooth-out shrink-0 mt-0.5" />
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
            desc: "Metadatos y pósters de películas y series",
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
            name: "Biblioteca local",
            status: hasPaths ? "connected" : "disconnected",
            desc: "Carpetas locales vigiladas en tiempo real",
            lastSync: hasPaths ? "Monitoreado" : "Sin carpetas",
            icon: IconNavigationLibrary,
            tab: "library",
        },
        {
            name: "Motor de video (FFmpeg)",
            status: ffmpegReady ? "connected" : "disconnected",
            desc: "Aceleración por GPU y conversión de video HLS",
            lastSync: ffmpegReady ? "Listo" : "No instalado",
            icon: IconStatusZap,
            tab: "performance",
        },
        {
            name: "Progreso e intros",
            status: settings?.library?.enableWatchContinuity ? "connected" : "disconnected",
            desc: "Historial de reproducción y detección de intros y créditos",
            lastSync: settings?.library?.enableWatchContinuity ? "Activo" : "Desactivado",
            icon: IconMediaWand,
            tab: "playback",
        },
        {
            name: "Música y sonidos",
            status: "unknown",
            desc: "Música de fondo y sonidos de la interfaz",
            lastSync: "No monitoreado",
            icon: IconStatusMusic,
            tab: "playback",
        },
    ]

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "connected": return { color: "var(--status-success)", label: "Conectado", icon: IconUiCheckCircle }
            case "disconnected": return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconectado", icon: IconUiXCircle }
            case "error": return { color: "var(--status-error)", label: "Error", icon: IconUiAlertCircle }
            case "unknown": return { color: "var(--md-sys-color-on-surface-variant)", label: "No monitoreado", icon: IconUiHelpCircle }
            default: return { color: "var(--md-sys-color-on-surface-variant)", label: "Desconocido", icon: IconUiHelpCircle }
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {services.map((service, i) => {
                const status = getStatusConfig(service.status)
                return (
                    <div key={i} className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 transition-[background-color,border-color] duration-base ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center shrink-0">
                                    <service.icon size={20} className="text-label-2" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xs font-bold text-on-surface truncate">{service.name}</h3>
                                    <p className="text-2xs text-label-2 mt-0.5 line-clamp-2">{service.desc}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <status.icon size={14} className="shrink-0" style={{ color: status.color }} />
                                <span className="text-2xs font-bold" style={{ color: status.color }}>{status.label}</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-3.5 border-t border-[var(--neutral-separator)] flex items-center justify-between">
                            <span className="text-2xs text-label-2">Estado: <span className="text-on-surface ml-1">{service.lastSync}</span></span>
                            <Link
                                to="/settings"
                                search={{ tab: service.tab }}
                                className={ButtonAnatomy.root({ intent: "outline", size: "sm" })}
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





function AdminSystemGrid() {
    const navigate = useNavigate()

    const items = [
        { label: "Registros y diagnóstico", desc: "Ver informes y eventos del sistema", icon: IconStatusFile, action: () => navigate({ to: "/settings", search: { tab: "system" } }) },
        { label: "Ajustes avanzados", desc: "Ajustes de rendimiento y hardware", icon: IconUiSliders, action: () => navigate({ to: "/settings", search: { tab: "performance" } }) },
        { label: "Carpetas de la biblioteca", desc: "Gestiona las carpetas de series y películas", icon: IconNavigationUsers, action: () => navigate({ to: "/settings", search: { tab: "library" } }) },
        { label: "Respaldo y base de datos", desc: "Copias de seguridad y mantenimiento", icon: IconStatusHdd, action: () => navigate({ to: "/settings", search: { tab: "system" } }) },
        { label: "Apariencia y temas", desc: "Personalización visual y eras", icon: IconUiRefresh, action: () => navigate({ to: "/settings", search: { tab: "appearance" } }) },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {items.map((item, i) => (
                <button key={i} type="button" onClick={item.action} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full text-left rounded-xl bg-[var(--neutral-elev-1)] border border-[var(--neutral-separator)] p-5 cursor-pointer transition-[background-color,transform] duration-fast ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-2)] active:scale-[0.98] group flex flex-col justify-between">
                    <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-[var(--neutral-separator)] transition-[background-color,border-color] duration-fast ease-smooth-out shrink-0">
                            <item.icon size={20} className="text-label-2" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-on-surface">{item.label}</h3>
                            <p className="text-2xs text-label-2 mt-0.5">{item.desc}</p>
                        </div>
                        <IconArrowRight size={18} className="text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 transition-[transform,color] duration-fast ease-smooth-out shrink-0 mt-0.5" />
                    </div>
                </button>
            ))}
        </div>
    )
}


function AdminRecentActivity() {
    const navigate = useNavigate()
    const { data: notifData, isLoading } = useGetNotifications()
    const notifications = (notifData?.notifications ?? []).slice(0, 6)

    const iconForType = (type: string) => {
        switch (type) {
            case "scanner": return { icon: IconNavigationSearch, color: "var(--status-success)" }
            case "mediastream": return { icon: IconStatusZap, color: "hsl(var(--brand-accent))" }
            default: return { icon: IconStatusActivity, color: "var(--brand-accent-hex)" }
        }
    }

    return (
        <SectionBar
            variant="content"
            label="Actividad reciente"
            description="Eventos del sistema y sincronizaciones automáticas"
            icon={IconStatusActivity}
            className="mb-8"
        >
            <div className="pt-2 space-y-4">
                <div className="flex items-center justify-end">
                    <Button
                        intent="outline"
                        size="sm"
                        onClick={() => navigate({ to: "/settings", search: { tab: "system" } })}
                        rightIcon={<IconArrowRight size={13} strokeWidth={2.5} />}
                    >
                        Abrir ajustes del sistema
                    </Button>
                </div>
                <LoadSwap
                    className="space-y-2.5"
                    loading={isLoading}
                    skeleton={
                        <div role="status" aria-label="Cargando actividad" className="space-y-2.5">
                            <AdminRowSkeletons count={3} />
                        </div>
                    }
                >
                    {notifications.length === 0 ? (
                        <p className="text-2xs text-label-2">Sin actividad reciente.</p>
                    ) : (
                        notifications.map((n) => {
                            const cfg = iconForType(n.type)
                            return (
                                <div key={n.id} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[border-color] duration-fast ease-smooth-out">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, color: cfg.color }}>
                                        <cfg.icon size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-on-surface">{n.title}: {n.message}</p>
                                        <p className="text-3xs text-label-2 mt-0.5">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
                                    </div>
                                    <span className="text-2xs text-label-2 shrink-0 mt-0.5">{n.type === "scanner" ? "Escáner" : n.type === "mediastream" ? "Reproducción" : "Sistema"}</span>
                                </div>
                            )
                        })
                    )}
                </LoadSwap>
            </div>
        </SectionBar>
    )
}