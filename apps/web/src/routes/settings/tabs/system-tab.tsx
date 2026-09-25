import React, { useState } from "react"
import { type Control, Controller, useWatch, useFormContext } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { settingsSchema } from "@/lib/server/settings"
import { useAppStore, useUIStore } from "@/lib/store"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SecretField } from "@/components/settings/secret-field"
import { DangerZone } from "@/components/settings/danger-zone"
import { HoldConfirm } from "@/components/ui/kinetics/hold-confirm"
import { Modal } from "@/components/ui/modal/modal"
import { Button } from "@/components/ui/button"
import { IconUiKey, IconUiRotate, IconUiSpinner, IconStatusArchive, IconUiTrash, IconUiAlert, IconMediaStop } from "@/components/ui/icons";
import { OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

interface SystemTabProps {
    control: Control<SettingsFormValues>
}

function ApiKeyCard({ name, description, connected, children }: { name: string; description: string; connected: boolean; children: React.ReactNode }) {
    return (
        <div className="bg-white/[0.02] rounded-xl p-4 space-y-3 border border-white/10">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <div>
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">{name}</h4>
                    <p className="text-2xs text-on-surface-variant mt-0.5">{description}</p>
                </div>
                {connected ? (
                    <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full shrink-0 animate-fade-in">
                        <span className="text-3xs font-mono font-bold text-emerald-400 uppercase">Conectado</span>
                        <span key="on" className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(var(--brand-success))] animate-success-pop" />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                        <span className="text-3xs font-mono text-on-surface-variant uppercase">Sin configurar</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40" />
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface CacheStats {
    thumbnails: {
        memoryHits: number
        memoryMisses: number
        memoryCount: number
        memoryMaxItems: number
        memoryBytes?: number
        diskSizeBytes: number
        diskItemCount: number
        diskMaxSizeMB: number
    }
    videofiles: {
        diskSizeBytes: number
    }
    keyframes?: {
        diskSizeBytes: number
        diskItemCount: number
    }
    fingerprints?: {
        diskSizeBytes: number
        diskItemCount: number
    }
    images?: {
        diskSizeBytes: number
        diskItemCount: number
    }
    totalDiskSizeBytes: number
    isWarming: boolean
    warmingProgress?: {
        total: number
        processed: number
        generated: number
        skipped: number
    }
}

export const SystemTab = React.memo(function SystemTab({ control }: SystemTabProps) {
    const { mutate: backupDb, isPending: isBackingUp } = useBackupDatabase()
    const { download: downloadBackup, isDownloading: isDownloadingBackup } = useDownloadDatabaseBackup()
    const { mutateAsync: saveSettings } = useSaveSettings()
    const { data: serverSettings } = useGetSettings()
    const { reset, setValue, getValues } = useFormContext<SettingsFormValues>()
    const queryClient = useQueryClient()

    /**
     * PATCH parcial inmediato (sin dirty): el backend lo aplica en vivo
     * (TMDB client y notifier releen por request/evento). Revierte el form si falla.
     */
    const patchSettingsNow = React.useCallback(async (patch: Record<string, unknown>, revert: () => void) => {
        try {
            await buildSeaQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: patch,
            })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        } catch (err) {
            revert()
            toast.error(err instanceof Error ? err.message : "No se pudo aplicar el cambio")
            throw err
        }
    }, [queryClient])

    const applyNotificationsNow = (key: "disableNotifications" | "disableAutoScannerNotifications", value: boolean) => {
        const field = `notifications.${key}` as const
        const prev = getValues(field)
        setValue(field, value, { shouldDirty: false, shouldValidate: true })
        const next = {
            disableNotifications: getValues("notifications.disableNotifications") ?? false,
            disableAutoScannerNotifications: getValues("notifications.disableAutoScannerNotifications") ?? false,
        }
        void patchSettingsNow({ notifications: next }, () =>
            setValue(field, prev, { shouldDirty: false })
        ).then(() => toast.success("Notificaciones actualizadas")).catch(() => {})
    }

    // TMDB key con debounce: evita un PATCH por tecla; flush al desmontar.
    const pendingTmdbKey = React.useRef<string | null>(null)
    const tmdbPatchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const flushTmdbKey = React.useCallback(() => {
        const value = pendingTmdbKey.current
        pendingTmdbKey.current = null
        if (value === null) return
        void patchSettingsNow({ library: { tmdbApiKey: value } }, () => {}).then(() =>
            toast.success(value ? "API Key aplicada" : "API Key eliminada")
        ).catch(() => {})
    }, [patchSettingsNow])
    React.useEffect(() => () => {
        if (tmdbPatchTimer.current) clearTimeout(tmdbPatchTimer.current)
        flushTmdbKey()
    }, [flushTmdbKey])

    const [isRestartModalOpen, setRestartModalOpen] = useState(false)
    const [isResetting, setIsResetting] = useState(false)

    const handleConfirmReset = async () => {
        setIsResetting(true)
        try {
            const parsed = settingsSchema.safeParse({})
            if (!parsed.success) {
                throw new Error("No se pudieron generar los ajustes por defecto")
            }
            const defaultSettings = parsed.data
            // Preservar rutas de biblioteca: el copy promete no eliminarlas.
            defaultSettings.library.seriesPaths =
                serverSettings?.library?.seriesPaths ?? []
            defaultSettings.library.moviePaths =
                serverSettings?.library?.moviePaths ?? []
            await saveSettings(defaultSettings as unknown as SaveSettings_Variables)
            reset(defaultSettings as unknown as SettingsFormValues)
            // Limpiar tiendas locales y rehidratar a defaults (clearStorage solo
            // borra el disco; el preview visual en memoria se limpia explícito).
            useAppStore.persist?.clearStorage?.()
            usePerformanceStore.persist?.clearStorage?.()
            useUIStore.setState({ themeVisual: {}, hideAudienceScore: false })
            await Promise.allSettled([
                useAppStore.persist?.rehydrate?.(),
                usePerformanceStore.persist?.rehydrate?.(),
            ])
            // Rehydrate puede devolver undefined desde disco: fijar fábrica explícito.
            useUIStore.setState({ themeVisual: {}, hideAudienceScore: false })
            toast.success("Ajustes restablecidos de fábrica con éxito")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al restablecer los ajustes")
            throw new Error("reset-failed") // re-lanza para que SlideToConfirm sepa que falló
        } finally {
            setIsResetting(false)
        }
    }

    const tmdbApiKey = useWatch({ control, name: "library.tmdbApiKey" })

    const { data: cacheStats = null, refetch: fetchCacheStats } = useQuery<CacheStats | null>({
        queryKey: ["system-cache-stats"],
        queryFn: async () => {
            try {
                const res = await buildSeaQuery<CacheStats>({
                    endpoint: API_ENDPOINTS.CACHE_HANDLERS.GetCacheStats.endpoint,
                    method: API_ENDPOINTS.CACHE_HANDLERS.GetCacheStats.methods[0],
                })
                return res ?? null
            } catch {
                return null
            }
        },
        refetchInterval: (query) => (query.state.data?.isWarming ? 1500 : false),
    })
    const [isWarmingLocal, setIsWarming] = useState(false)
    if (isWarmingLocal && !cacheStats?.isWarming) {
        setIsWarming(false)
    }
    const isWarming = isWarmingLocal || cacheStats?.isWarming || false
    const [isClearModalOpen, setIsClearModalOpen] = React.useState(false)
    const [isClearingTarget, setIsClearingTarget] = React.useState<string | null>(null)

    const handleBackup = () => {
        backupDb(undefined, {
            onSuccess: (data) => {
                if (data) {
                    toast.success(`Respaldo generado con éxito (${formatBytes(data.sizeBytes)})`)
                } else {
                    toast.success(`Respaldo generado con éxito`)
                }
                void downloadBackup()
            },
            onError: (err) => {
                toast.error(err instanceof Error ? err.message : "Error al generar el respaldo")
            },
        })
    }

    const handleClearCache = async (target: string = "all") => {
        setIsClearingTarget(target)
        const labels: Record<string, string> = {
            all: "toda la caché del sistema",
            thumbnails: "caché de miniaturas",
            videofiles: "videos transcodificados",
            keyframes: "índices de keyframes",
            fingerprints: "huellas de audio",
            images: "imágenes proxy",
            metadata: "metadatos en caché",
        }
        const label = labels[target] || "caché"
        toast.loading(`Limpiando ${label}...`, { id: "cache-toast" })
        try {
            const res = await buildSeaQuery<{ freedBytes: number; freedCount: number }, { target: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.methods[0],
                params: { target },
            })
            const freedMsg = res?.freedBytes ? ` (${formatBytes(res.freedBytes)})` : ""
            toast.success(`Se liberó ${label}${freedMsg}`, { id: "cache-toast" })
            fetchCacheStats()
        } catch {
            toast.error(`No se pudo limpiar ${label}`, { id: "cache-toast" })
        } finally {
            setIsClearingTarget(null)
        }
    }

    const handleWarmCache = async () => {
        setIsWarming(true)
        toast.loading("Iniciando pre-generación de miniaturas...", { id: "warm-toast" })
        try {
            const res = await buildSeaQuery<{ status: string; totalFiles?: number; message?: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.methods[0],
            })
            if (res?.status === "already_running") {
                toast.info("La pre-generación ya está en curso", { id: "warm-toast" })
            } else {
                toast.success(`Indexando miniaturas en segundo plano (${res?.totalFiles ?? 0} videos)`, { id: "warm-toast" })
            }
            fetchCacheStats()
        } catch {
            toast.error("No se pudo iniciar la pre-generación", { id: "warm-toast" })
            setIsWarming(false)
        }
    }

    const handleCancelWarm = async () => {
        toast.loading("Cancelando pre-generación...", { id: "warm-toast" })
        try {
            await buildSeaQuery<{ status: string; message?: string }, { action: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.methods[0],
                params: { action: "cancel" },
            })
            toast.info("Pre-generación detenida", { id: "warm-toast" })
            fetchCacheStats()
        } catch {
            toast.error("No se pudo cancelar la pre-generación", { id: "warm-toast" })
        }
    }

    const connectedApiCount = tmdbApiKey ? 1 : 0

    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. PROVEEDORES Y CLAVES DE API
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="api-providers"
                label="Proveedores de Metadatos y APIs"
                description="Claves para enriquecer sinopsis, afiches en alta resolución y calificaciones oficiales."
                icon={IconUiKey}
                badge={
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {connectedApiCount} vinculada
                    </span>
                }
            >
                <div className="p-5 space-y-4">
                    <ApiKeyCard
                        name="The Movie Database (TMDB)"
                        description="Permite buscar automáticamente afiches oficiales, sinopsis de sagas y fechas de emisión."
                        connected={!!tmdbApiKey}
                    >
                        <Controller
                            control={control}
                            name="library.tmdbApiKey"
                            render={({ field }) => (
                                <SecretField
                                    label="API Key de TMDB v3"
                                    value={field.value || ""}
                                    onChange={(v) => {
                                        setValue("library.tmdbApiKey", v, { shouldDirty: false, shouldValidate: true })
                                        pendingTmdbKey.current = v
                                        if (tmdbPatchTimer.current) clearTimeout(tmdbPatchTimer.current)
                                        tmdbPatchTimer.current = setTimeout(flushTmdbKey, 800)
                                    }}
                                    placeholder="Ingresa tu API Key de TMDB"
                                />
                            )}
                        />
                    </ApiKeyCard>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                2. MANTENIMIENTO Y NOTIFICACIONES
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="system-maintenance"
                label="Mantenimiento y Notificaciones"
                description="Respaldos de base de datos, limpieza de caché y avisos de sistema."
                icon={IconUiRotate}
            >
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01]">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-on-surface">Copia de Seguridad SQLite</p>
                            <p className="text-2xs text-on-surface-variant">Genera un dump seguro de tu progreso.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleBackup}
                            disabled={isBackingUp || isDownloadingBackup}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-accent text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm transition-[filter,transform,opacity] duration-fast ease-smooth-out hover:brightness-110 active:scale-95 disabled:opacity-50"
                        >
                            {isBackingUp || isDownloadingBackup ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconStatusArchive className="w-3.5 h-3.5" />}
                            <span>{isBackingUp ? "Creando..." : isDownloadingBackup ? "Descargando..." : "Crear Copia"}</span>
                        </button>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-xs font-bold text-on-surface">Limpieza de Caché</p>
                                <p className="text-2xs text-on-surface-variant truncate">
                                    {cacheStats
                                        ? `${formatBytes(cacheStats.totalDiskSizeBytes)} en disco · ${cacheStats.thumbnails.diskItemCount} miniaturas`
                                        : "Libera miniaturas y temporales."}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isWarming ? (
                                    <button
                                        type="button"
                                        onClick={handleCancelWarm}
                                        title="Detener pre-generación"
                                        className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 text-xs font-bold text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95"
                                    >
                                        <IconMediaStop className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Detener</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleWarmCache}
                                        title="Pre-generar miniaturas para toda la biblioteca"
                                        className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95"
                                    >
                                        <IconUiRotate className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Pre-generar</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsClearModalOpen(true)}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95"
                                >
                                    <IconUiTrash className="w-3.5 h-3.5 text-on-surface-variant" />
                                    <span>Gestionar</span>
                                </button>
                            </div>
                        </div>

                        {/* Barra de progreso de pre-generación en vivo */}
                        {isWarming && cacheStats?.warmingProgress && cacheStats.warmingProgress.total > 0 && (
                            <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                                <div className="flex items-center justify-between text-3xs font-mono text-on-surface-variant">
                                    <span className="flex items-center gap-1.5 text-brand-accent">
                                        <IconUiSpinner className="w-3 h-3 animate-spin" />
                                        Indexando miniaturas...
                                    </span>
                                    <span className="tabular-nums">
                                        {cacheStats.warmingProgress.processed} / {cacheStats.warmingProgress.total} ({Math.round((cacheStats.warmingProgress.processed / cacheStats.warmingProgress.total) * 100)}%)
                                    </span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="bg-brand-accent h-full transition-[width] duration-slow ease-smooth-out"
                                        style={{
                                            width: `${Math.min(100, Math.round((cacheStats.warmingProgress.processed / cacheStats.warmingProgress.total) * 100))}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <Controller
                    control={control}
                    name="notifications.disableNotifications"
                    render={({ field }) => (
                        <OsToggle
                            label="Desactivar Todas las Notificaciones"
                            description="Silencia avisos flotantes de sistema en el navegador."
                            checked={!!field.value}
                            onChange={(v) => applyNotificationsNow("disableNotifications", v)}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="notifications.disableAutoScannerNotifications"
                    render={({ field }) => (
                        <OsToggle
                            label="Silenciar Avisos del Escáner Automático"
                            description="No muestra alertas cuando el indexador añade episodios en segundo plano."
                            checked={!!field.value}
                            onChange={(v) => applyNotificationsNow("disableAutoScannerNotifications", v)}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. ZONA DE PELIGRO (CRÍTICO - COLAPSABLE)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="danger-zone"
                label="Zona de Peligro"
                description="Restablecer ajustes de fábrica o reiniciar el servidor."
                icon={IconUiAlert}
                collapsible
                defaultOpen={false}
                badge={
                    <span className="text-3xs font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        Crítico
                    </span>
                }
            >
                <div className="rounded-2xl border border-red-500/20 bg-red-950/[0.05] p-5">
                    <DangerZone
                        title="Restablecimiento y Zona de Peligro"
                        description="Acciones de mantenimiento que pueden restablecer la configuración de fábrica de KameHouse."
                        actions={
                            <div className="flex flex-col gap-4 pt-2">
                                {/* Hold-confirm: Restablecer Ajustes */}
                                <div className="space-y-1.5">
                                    <p className="text-2xs font-bold text-red-400/80 uppercase tracking-wider font-mono">
                                        Restablecer Ajustes de Fábrica
                                    </p>
                                    <p className="text-2xs text-on-surface-variant leading-relaxed mb-2">
                                        Mantené presionado para confirmar. Las rutas de carpetas y el contenido de tu biblioteca no se eliminarán. Las claves de API (ej. TMDB) sí se restablecerán.
                                    </p>
                                    <HoldConfirm
                                        label="Mantener para restablecer"
                                        confirmLabel="¡Restablecido!"
                                        onConfirm={handleConfirmReset}
                                        disabled={isResetting}
                                        variant="destructive"
                                        holdDurationMs={800}
                                    />
                                </div>

                                {/* Botón informativo: Reiniciar Servidor */}
                                <div className="space-y-1.5 pt-1 border-t border-red-500/15">
                                    <p className="text-2xs font-bold text-red-400/80 uppercase tracking-wider font-mono">
                                        Reiniciar Servidor
                                    </p>
                                    <Button
                                        type="button"
                                        intent="brand-destructive"
                                        size="sm"
                                        onClick={() => setRestartModalOpen(true)}
                                        className="font-bold text-xs"
                                    >
                                        Ver instrucciones de reinicio
                                    </Button>
                                </div>
                            </div>
                        }
                    />
                </div>
            </SectionBar>

            {/* Modal informativo: Reiniciar Servidor */}

            <Modal
                open={isRestartModalOpen}
                onOpenChange={setRestartModalOpen}
                title="Reinicio del Servidor KameHouse"
                description={
                    <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed">
                        <p>
                            El servidor backend de KameHouse se ejecuta como un proceso local independiente. Para reiniciar el servicio:
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-on-surface">
                            <li><strong className="text-white">Aplicación de Escritorio / Windows:</strong> Cierra KameHouse desde la barra de tareas / bandeja del sistema (System Tray) y vuelve a abrirla.</li>
                            <li><strong className="text-white">Docker:</strong> Ejecuta <code className="font-mono text-2xs bg-white/10 px-1 py-0.5 rounded text-brand-accent">docker restart kamehouse</code>.</li>
                            <li><strong className="text-white">Servicio Linux / macOS:</strong> Ejecuta <code className="font-mono text-2xs bg-white/10 px-1 py-0.5 rounded text-brand-accent">systemctl restart kamehouse</code> o reinicia el proceso en terminal.</li>
                        </ul>
                    </div>
                }
                footer={
                    <div className="flex justify-end w-full">
                        <Button
                            type="button"
                            intent="primary"
                            onClick={() => setRestartModalOpen(false)}
                        >
                            Entendido
                        </Button>
                    </div>
                }
            />

            {/* Modal: Gestión detallada de caché y almacenamiento */}
            <Modal
                open={isClearModalOpen}
                onOpenChange={setIsClearModalOpen}
                title="Gestión de Almacenamiento y Caché"
                description={
                    <div className="space-y-1 text-xs text-on-surface-variant">
                        <p>Libera espacio selectivamente sin alterar tus ajustes ni base de datos.</p>
                        <p className="font-mono text-2xs text-on-surface pt-1">
                            Ocupación total en disco: <strong className="text-brand-accent">{formatBytes(cacheStats?.totalDiskSizeBytes ?? 0)}</strong>
                        </p>
                    </div>
                }
                footer={
                    <div className="flex items-center justify-between w-full">
                        <button
                            type="button"
                            onClick={() => handleClearCache("all")}
                            disabled={isClearingTarget !== null}
                            className="px-3.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 hover:bg-red-500/20 text-xs font-bold text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "all" ? "Limpiando..." : "Limpiar Toda la Caché"}</span>
                        </button>
                        <Button
                            type="button"
                            intent="secondary"
                            onClick={() => setIsClearModalOpen(false)}
                        >
                            Cerrar
                        </Button>
                    </div>
                }
            >
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    {/* 1. Miniaturas */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Miniaturas de Video</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.thumbnails.diskSizeBytes ?? 0)} ({cacheStats?.thumbnails.diskItemCount ?? 0} archivos) · RAM: {formatBytes(cacheStats?.thumbnails.memoryBytes ?? 0)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("thumbnails")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "thumbnails" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>

                    {/* 2. Video HLS */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Video Transcodificado (HLS)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.videofiles.diskSizeBytes ?? 0)} en disco
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("videofiles")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "videofiles" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>

                    {/* 3. Keyframes */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Índices de Keyframes</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.keyframes?.diskSizeBytes ?? 0)} ({cacheStats?.keyframes?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("keyframes")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "keyframes" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>

                    {/* 4. Skip Detect */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Huellas de Audio (Skip Detect)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.fingerprints?.diskSizeBytes ?? 0)} ({cacheStats?.fingerprints?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("fingerprints")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "fingerprints" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>

                    {/* 5. Image proxy */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Imágenes Proxy (TMDB/remotas)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.images?.diskSizeBytes ?? 0)} ({cacheStats?.images?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("images")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "images" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>

                    {/* 6. Metadatos */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Metadatos y Consultas TMDB</p>
                            <p className="text-2xs text-on-surface-variant">
                                Consultas HTTP remotas en memoria y registros expirados SQLite
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleClearCache("metadata")}
                            disabled={isClearingTarget !== null}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface hover:text-red-400 flex items-center gap-1.5 transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <IconUiTrash className="w-3.5 h-3.5" />
                            <span>{isClearingTarget === "metadata" ? "Limpiando..." : "Limpiar"}</span>
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    )
})

