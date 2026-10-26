import { errorText } from "@/api/client/error-messages"
import React, { useState } from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { AnimatePresence, m } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { settingsSchema } from "@/lib/server/settings"
import { useAppStore, usePlayerStore, useQueueStore, useUIStore } from "@/lib/store"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SecretField } from "@/components/settings/secret-field"
const ServerLogsViewer = React.lazy(() =>
    import("@/components/settings/server-logs-viewer").then(m => ({ default: m.ServerLogsViewer }))
)
import { DangerZone } from "@/components/settings/danger-zone"
import { CacheLocationField } from "@/components/settings/cache-location"
import { HoldConfirm } from "@/components/ui/kinetics/hold-confirm"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useTransientFlag } from "@/components/ui/kinetics/icon-swap"
import { Modal } from "@/components/ui/modal/modal"
import { Button } from "@/components/ui/button"
import { IconUiKey, IconUiRotate, IconUiSpinner, IconStatusArchive, IconUiTrash, IconUiAlert, IconMediaStop, IconUiCheck } from "@/components/ui/icons";
import { OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

interface SystemTabProps {
    control: Control<SettingsFormValues>
}

function resetStore<T>(store: { getInitialState: () => T; setState: (state: T, replace: true) => unknown }) {
    store.setState(store.getInitialState(), true)
}

function ApiKeyCard({ name, description, connected, children }: { name: string; description: string; connected: boolean; children: React.ReactNode }) {
    return (
        <div className="bg-[var(--neutral-elev-2)] rounded-xl p-4 space-y-3 border border-[var(--neutral-separator)]">
            <div className="flex items-center justify-between border-b border-[var(--neutral-separator)] pb-2.5">
                <div>
                    <h3 className="text-xs font-bold text-on-surface">{name}</h3>
                    <p className="text-2xs text-on-surface-variant mt-0.5">{description}</p>
                </div>
                {connected ? (
                    <div className="flex items-center gap-1.5 bg-status-success/15 border border-status-success/25 px-2 py-0.5 rounded-full shrink-0 animate-fade-in">
                        <span className="text-2xs font-bold text-status-success">Conectado</span>
                        <span key="on" className="w-1.5 h-1.5 rounded-full bg-status-success shadow-[0_0_6px_hsl(var(--brand-success))] animate-success-pop" />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)] px-2 py-0.5 rounded-full shrink-0">
                        <span className="text-2xs text-on-surface-variant">Sin configurar</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40" />
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
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
    driveBlocks?: {
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
    const collapseSpring = useSpringPreset("tabContent")
    // Con el interruptor general activo, el del escáner no tiene efecto (el notificador corta antes).
    const allNotificationsOff = !!useWatch({ control, name: "notifications.disableNotifications" })

    /**
     * PATCH parcial inmediato (sin dirty): el backend lo aplica en vivo
     * (TMDB client y notifier releen por request/evento). Revierte el form si falla.
     */
    const patchSettingsNow = React.useCallback(async (patch: Record<string, unknown>, revert: () => void) => {
        try {
            await buildApiQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: patch,
            })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        } catch (err) {
            revert()
            toast.error(errorText(err, "No se pudo aplicar el cambio"))
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
            toast.success(value ? "Clave de API aplicada" : "Clave de API eliminada")
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
            // Ajustes locales a fábrica. rehydrate() con el storage vacío no toca la
            // memoria, así que se reemplaza el estado por el inicial y persist lo
            // vuelve a escribir. La cola y los tiempos de salto son datos, no ajustes.
            resetStore(useAppStore)
            resetStore(useUIStore)
            resetStore(usePlayerStore)
            const { hardwareSpecs } = usePerformanceStore.getState() // hardware detectado, no un ajuste
            resetStore(usePerformanceStore)
            usePerformanceStore.setState({ hardwareSpecs })
            useQueueStore.setState({ queueRepeatMode: useQueueStore.getInitialState().queueRepeatMode })
            toast.success("Ajustes restablecidos")
        } catch (err) {
            toast.error(errorText(err, "No se pudieron restablecer los ajustes"))
            throw new Error("reset-failed") // HoldConfirm conserva el estado de error y permite reintentar.
        } finally {
            setIsResetting(false)
        }
    }

    // "Conectado" sale del servidor (devuelve la clave enmascarada), no de lo que se
    // teclea: así el pop de éxito corre cuando el PATCH se aplicó, no 800 ms antes.
    const tmdbConnected = !!serverSettings?.library?.tmdbApiKey

    const { data: cacheStats = null, refetch: fetchCacheStats, isFetchedAfterMount: cacheStatsFetched } = useQuery<CacheStats | null>({
        queryKey: ["system-cache-stats"],
        queryFn: async () => {
            try {
                const res = await buildApiQuery<CacheStats>({
                    endpoint: API_ENDPOINTS.CACHE_HANDLERS.GetCacheStats.endpoint,
                    method: API_ENDPOINTS.CACHE_HANDLERS.GetCacheStats.methods[0],
                })
                return res ?? null
            } catch {
                return null
            }
        },
        staleTime: 10 * 1000,
        refetchInterval: (query) => (query.state.data?.isWarming ? 1500 : false),
    })
    const serverWarming = !!cacheStats?.isWarming
    // Puente optimista entre el clic y la primera respuesta del servidor. Se suelta
    // cuando el servidor confirma (el sondeo toma el relevo) o, en handleWarmCache,
    // cuando la consulta posterior al POST dice que ya no está generando.
    const [isWarmingLocal, setIsWarming] = useState(false)
    const isWarming = (isWarmingLocal && !serverWarming) || serverWarming

    // Fase "terminado": al pasar el servidor de generando a parado, la barra se llena
    // y el bloque queda un momento antes de plegarse. Si fue por "Detener"
    // (cancelledRef), no hay ✓: el bloque solo se pliega.
    const [justFinished, triggerFinished] = useTransientFlag(1500)
    const cancelledRef = React.useRef(false)
    const wasServerWarming = React.useRef(false)
    const cacheStatsKnown = cacheStats !== null
    // Layout effect: la fase final se enciende antes de pintar, así el bloque no
    // llega a empezar su salida en el cuadro en que el servidor deja de generar.
    React.useLayoutEffect(() => {
        // Solo cuentan datos pedidos con la pestaña montada: un "generando" viejo de la
        // caché no debe acabar en "Miniaturas listas". Sin datos (falló la consulta)
        // tampoco se confirma nada.
        if (!cacheStatsFetched) return
        if (wasServerWarming.current && !serverWarming && cacheStatsKnown && !cancelledRef.current) {
            triggerFinished()
        }
        wasServerWarming.current = serverWarming
    }, [serverWarming, cacheStatsFetched, cacheStatsKnown, triggerFinished])
    const warmProgress = cacheStats?.warmingProgress
    const warmFinished = justFinished && !serverWarming
    const showWarmBlock = !!warmProgress && warmProgress.total > 0 && (serverWarming || warmFinished)
    const warmPercent = warmProgress && warmProgress.total > 0
        ? Math.min(100, Math.round((warmProgress.processed / warmProgress.total) * 100))
        : 0
    const [isClearModalOpen, setIsClearModalOpen] = React.useState(false)
    const [isClearingTarget, setIsClearingTarget] = React.useState<string | null>(null)

    const handleBackup = () => {
        backupDb(undefined, {
            onSuccess: (data) => {
                if (data) {
                    toast.success(`Respaldo creado (${formatBytes(data.sizeBytes)})`)
                } else {
                    toast.success("Respaldo creado")
                }
                void downloadBackup()
            },
            onError: (err) => {
                toast.error(errorText(err, "No se pudo crear el respaldo"))
            },
        })
    }

    const handleClearCache = async (target: string = "all") => {
        setIsClearingTarget(target)
        const labels: Record<string, string> = {
            all: "toda la caché",
            thumbnails: "caché de miniaturas",
            videofiles: "videos convertidos",
            keyframes: "índices de cuadros clave",
            fingerprints: "huellas de audio",
            images: "imágenes descargadas",
            drive: "caché de Google Drive",
            metadata: "metadatos en caché",
        }
        const label = labels[target] || "caché"
        toast.loading(`Limpiando: ${label}…`, { id: "cache-toast" })
        try {
            const res = await buildApiQuery<{ freedBytes: number; freedCount: number }, { target: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.methods[0],
                params: { target },
            })
            const freedMsg = res?.freedBytes ? ` (${formatBytes(res.freedBytes)})` : ""
            toast.success(`Limpieza terminada: ${label}${freedMsg}`, { id: "cache-toast" })
            fetchCacheStats()
        } catch {
            toast.error(`No se pudo limpiar: ${label}`, { id: "cache-toast" })
        } finally {
            setIsClearingTarget(null)
        }
    }

    const handleWarmCache = async () => {
        cancelledRef.current = false
        setIsWarming(true)
        toast.loading("Preparando las miniaturas…", { id: "warm-toast" })
        try {
            const res = await buildApiQuery<{ status: string; totalFiles?: number; message?: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.methods[0],
            })
            if (res?.status === "already_running") {
                toast.info("Ya se están generando las miniaturas", { id: "warm-toast" })
            } else {
                toast.success(`Generando miniaturas en segundo plano (${res?.totalFiles === 1 ? "1 video" : `${res?.totalFiles ?? 0} videos`})`, { id: "warm-toast" })
            }
            const { data: stats } = await fetchCacheStats()
            // Terminó antes de que el sondeo lo viera (o no arrancó): soltar el puente.
            if (!stats?.isWarming) setIsWarming(false)
        } catch {
            toast.error("No se pudo iniciar la generación de miniaturas", { id: "warm-toast" })
            setIsWarming(false)
        }
    }

    const handleCancelWarm = async () => {
        // Anula la fase "Miniaturas listas": al detener, el bloque solo se pliega.
        cancelledRef.current = true
        toast.loading("Deteniendo la generación…", { id: "warm-toast" })
        try {
            await buildApiQuery<{ status: string; message?: string }, { action: string }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.methods[0],
                params: { action: "cancel" },
            })
            toast.info("Generación de miniaturas detenida", { id: "warm-toast" })
            fetchCacheStats()
        } catch {
            cancelledRef.current = false
            toast.error("No se pudo detener la generación de miniaturas", { id: "warm-toast" })
        }
    }

    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. PROVEEDORES Y CLAVES DE API
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="api-providers"
                label="Proveedores y claves de API"
                description="Claves para obtener sinopsis, pósters en alta resolución y calificaciones."
                icon={IconUiKey}
            >
                <div className="p-5 space-y-4">
                    <ApiKeyCard
                        name="The Movie Database (TMDB)"
                        description="Permite descargar pósters, sinopsis y fechas de emisión automáticamente."
                        connected={tmdbConnected}
                    >
                        <Controller
                            control={control}
                            name="library.tmdbApiKey"
                            render={({ field }) => (
                                <SecretField
                                    label="Clave de API de TMDB (v3)"
                                    value={field.value || ""}
                                    onChange={(v) => {
                                        setValue("library.tmdbApiKey", v, { shouldDirty: false, shouldValidate: true })
                                        pendingTmdbKey.current = v
                                        if (tmdbPatchTimer.current) clearTimeout(tmdbPatchTimer.current)
                                        tmdbPatchTimer.current = setTimeout(flushTmdbKey, 800)
                                    }}
                                    placeholder="Pega tu clave de API de TMDB"
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
                variant="content"
                id="system-maintenance"
                label="Mantenimiento y notificaciones"
                description="Respaldos de base de datos, limpieza de caché y avisos de sistema."
                icon={IconUiRotate}
            >
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-on-surface">Copia de seguridad</p>
                            <p className="text-2xs text-on-surface-variant">Guarda una copia de tu progreso y tus ajustes.</p>
                        </div>
                        <Button
                            intent="primary"
                            size="sm"
                            className="shrink-0"
                            onClick={handleBackup}
                            disabled={isBackingUp || isDownloadingBackup}
                            leftIcon={isBackingUp || isDownloadingBackup ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconStatusArchive className="w-3.5 h-3.5" />}
                        >
                            {isBackingUp ? "Creando…" : isDownloadingBackup ? "Descargando…" : "Crear copia"}
                        </Button>
                    </div>

                    {/* Sin gap: el espacio sobre la barra (mt-3) va dentro de su colapso. */}
                    <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-xs font-bold text-on-surface">Limpieza de caché</p>
                                <p className="text-2xs text-on-surface-variant truncate">
                                    {cacheStats
                                        ? `${formatBytes(cacheStats.totalDiskSizeBytes)} en disco · ${cacheStats.thumbnails.diskItemCount} miniaturas`
                                        : "Libera miniaturas y temporales."}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isWarming ? (
                                    <Button
                                        intent="alert-subtle"
                                        size="sm"
                                        onClick={handleCancelWarm}
                                        title="Detener la generación de miniaturas"
                                        aria-label="Detener la generación de miniaturas"
                                        leftIcon={<IconMediaStop className="w-3.5 h-3.5" />}
                                        hideTextOnSmallScreen
                                    >
                                        Detener
                                    </Button>
                                ) : (
                                    <Button
                                        intent="outline"
                                        size="sm"
                                        onClick={handleWarmCache}
                                        title="Generar por adelantado las miniaturas de toda la biblioteca"
                                        aria-label="Generar por adelantado las miniaturas de toda la biblioteca"
                                        leftIcon={<IconUiRotate className="w-3.5 h-3.5" />}
                                        hideTextOnSmallScreen
                                    >
                                        Generar miniaturas
                                    </Button>
                                )}
                                <Button
                                    intent="outline"
                                    size="sm"
                                    onClick={() => setIsClearModalOpen(true)}
                                    leftIcon={<IconUiTrash className="w-3.5 h-3.5 text-on-surface-variant" />}
                                >
                                    Gestionar
                                </Button>
                            </div>
                        </div>

                        {/* Barra de progreso de pre-generación en vivo: entra y sale con el
                            colapso de SectionBar; al terminar muestra ✓ antes de plegarse. */}
                        <AnimatePresence initial={false}>
                            {showWarmBlock && warmProgress && (
                                <m.div
                                    key="warm-progress"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={collapseSpring}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-3 pt-2 border-t border-[var(--neutral-separator)] space-y-1.5">
                                        <div className="flex items-center justify-between text-3xs font-mono text-on-surface-variant">
                                            {warmFinished ? (
                                                <span key="done" className="flex items-center gap-1.5 text-status-success animate-text-swap-in">
                                                    <IconUiCheck className="w-3 h-3 animate-success-check" />
                                                    Miniaturas listas
                                                </span>
                                            ) : (
                                                <span key="run" className="flex items-center gap-1.5 text-brand-accent-readable">
                                                    <IconUiSpinner className="w-3 h-3 animate-spin" />
                                                    Generando miniaturas…
                                                </span>
                                            )}
                                            <span className="tabular-nums">
                                                {warmProgress.processed} / {warmProgress.total} ({warmPercent}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-[var(--neutral-elev-3)] rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-brand-accent w-full h-full origin-left transition-transform duration-slow ease-smooth-out"
                                                style={{ transform: `scaleX(${warmFinished ? 1 : warmPercent / 100})` }}
                                            />
                                        </div>
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <Controller
                    control={control}
                    name="notifications.disableNotifications"
                    render={({ field }) => (
                        <OsToggle
                            label="Desactivar todas las notificaciones"
                            description="Silencia todos los avisos flotantes de la app."
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
                            label="Silenciar avisos del escáner automático"
                            description={allNotificationsOff
                                ? "Ya está todo silenciado por «Desactivar todas las notificaciones»."
                                : "No avisa cuando el escáner añade episodios en segundo plano."}
                            checked={!!field.value}
                            disabled={allNotificationsOff}
                            onChange={(v) => applyNotificationsNow("disableAutoScannerNotifications", v)}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                2b. REGISTROS (diagnóstico de arranque y ejecución)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="system-logs"
                label="Registros"
                description="Lo que hace el servidor y la app. Revísalos si algo falla al arrancar o al reproducir."
                icon={IconStatusArchive}
                collapsible
                defaultOpen={false}
            >
                <div className="p-5">
                    <React.Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-on-surface-variant">Cargando registros...</div>}>
                        <ServerLogsViewer />
                    </React.Suspense>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. ZONA DE PELIGRO (CRÍTICO - COLAPSABLE)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="danger-zone"
                label="Zona de peligro"
                description="Restablecer ajustes de fábrica o reiniciar el servidor."
                icon={IconUiAlert}
                collapsible
                defaultOpen={false}
                badge={
                    <span className="text-3xs px-2 py-0.5 rounded bg-status-error/10 text-status-error border border-status-error/20">
                        Crítico
                    </span>
                }
            >
                <div className="rounded-2xl border border-[var(--error-border)] bg-status-error/[0.04] p-5">
                    <DangerZone
                        title="Restablecer y reiniciar"
                        description="Acciones que cambian la configuración de KameHouse y no se pueden deshacer."
                        actions={
                            <div className="flex flex-col gap-4 pt-2">
                                {/* Hold-confirm: Restablecer Ajustes */}
                                <div className="space-y-1.5">
                                    <p className="text-2xs font-bold text-status-error/80">
                                        Restablecer ajustes de fábrica
                                    </p>
                                    <p className="text-2xs text-on-surface-variant leading-relaxed mb-2">
                                        Mantén pulsado el botón para confirmar. Las carpetas y el contenido de tu biblioteca no se eliminan. Las claves de API (como la de TMDB) sí se restablecen.
                                    </p>
                                    <HoldConfirm
                                        label="Mantén pulsado para restablecer"
                                        confirmLabel="Restablecido"
                                        onConfirm={handleConfirmReset}
                                        disabled={isResetting}
                                        variant="destructive"
                                        holdDurationMs={800}
                                    />
                                </div>

                                {/* Botón informativo: Reiniciar Servidor */}
                                <div className="space-y-1.5 pt-1 border-t border-status-error/15">
                                    <p className="text-2xs font-bold text-status-error/80">
                                        Reiniciar el servidor
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
                title="Reiniciar el servidor de KameHouse"
                description={
                    <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed">
                        <p>
                            El servidor de KameHouse funciona como un proceso aparte en tu equipo. Para reiniciarlo:
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-on-surface">
                            <li><strong className="text-label-1">App de escritorio (Windows):</strong> Cierra KameHouse desde la barra de tareas o la bandeja del sistema y vuelve a abrirla.</li>
                            <li><strong className="text-label-1">Docker:</strong> Ejecuta <code className="font-mono text-2xs bg-[var(--neutral-elev-3)] px-1 py-0.5 rounded text-brand-accent-readable">docker restart kamehouse</code>.</li>
                            <li><strong className="text-label-1">Servicio en Linux o macOS:</strong> Ejecuta <code className="font-mono text-2xs bg-[var(--neutral-elev-3)] px-1 py-0.5 rounded text-brand-accent-readable">systemctl restart kamehouse</code> o reinicia el proceso desde la terminal.</li>
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
                title="Almacenamiento y caché"
                description={
                    <div className="space-y-1 text-xs text-on-surface-variant">
                        <p>Libera espacio sin tocar tus ajustes ni tu progreso.</p>
                        <p className="font-mono text-2xs text-on-surface pt-1">
                            Ocupación total en disco: <strong className="text-brand-accent-readable">{formatBytes(cacheStats?.totalDiskSizeBytes ?? 0)}</strong>
                        </p>
                    </div>
                }
                footer={
                    <div className="flex items-center justify-between w-full">
                        <Button
                            intent="destructive"
                            size="sm"
                            onClick={() => handleClearCache("all")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                        >
                            {isClearingTarget === "all" ? "Limpiando…" : "Limpiar toda la caché"}
                        </Button>
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
                    <CacheLocationField />
                    {/* 1. Miniaturas */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Miniaturas de video</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.thumbnails.diskSizeBytes ?? 0)} ({cacheStats?.thumbnails.diskItemCount ?? 0} archivos) · RAM: {formatBytes(cacheStats?.thumbnails.memoryBytes ?? 0)}
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("thumbnails")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "thumbnails" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 2. Video HLS */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Videos convertidos (HLS)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.videofiles.diskSizeBytes ?? 0)} en disco
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("videofiles")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "videofiles" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 3. Keyframes */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Índices de cuadros clave</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.keyframes?.diskSizeBytes ?? 0)} ({cacheStats?.keyframes?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("keyframes")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "keyframes" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 4. Skip Detect */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Huellas de audio (para detectar intros)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.fingerprints?.diskSizeBytes ?? 0)} ({cacheStats?.fingerprints?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("fingerprints")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "fingerprints" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 5. Image proxy */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Imágenes descargadas (TMDB y otras)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.images?.diskSizeBytes ?? 0)} ({cacheStats?.images?.diskItemCount ?? 0} archivos)
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("images")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "images" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 5b. Google Drive: fuera de "Limpiar todo" (rellenarla gasta cuota de Drive) */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Google Drive (bloques descargados)</p>
                            <p className="text-2xs text-on-surface-variant font-mono tabular-nums">
                                {formatBytes(cacheStats?.driveBlocks?.diskSizeBytes ?? 0)} ({cacheStats?.driveBlocks?.diskItemCount ?? 0} bloques)
                            </p>
                            <p className="text-2xs text-on-surface-variant">
                                Evita volver a descargar de Drive. «Limpiar toda la caché» no la borra.
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("drive")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "drive" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>

                    {/* 6. Metadatos */}
                    <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-on-surface">Metadatos y consultas de TMDB</p>
                            <p className="text-2xs text-on-surface-variant">
                                Respuestas guardadas de servicios externos y registros vencidos.
                            </p>
                        </div>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => handleClearCache("metadata")}
                            disabled={isClearingTarget !== null}
                            leftIcon={<IconUiTrash className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                        >
                            {isClearingTarget === "metadata" ? "Limpiando…" : "Limpiar"}
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    )
})

