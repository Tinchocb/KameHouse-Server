import { PresenceSurface } from "@/components/ui/kinetics/presence-surface"
import { errorText } from "@/api/client/error-messages"
import { createLazyFileRoute, Link, useBlocker } from "@tanstack/react-router"
import React, { useEffect, useState, useMemo, useRef, Suspense } from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { m, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { IconUiPalette, IconMediaPlay, IconNavigationLibrary, IconStatusZap, IconUiSettings, IconUiCheck, IconUiAdmin } from "@/components/ui/icons"
import { useReducedMotion, useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useSound } from "@/hooks/use-sound"

// Consolidación de los 5 Pilares de Configuración con lazy loading y prewarming
const tabLoaders = {
    appearance: () => import("./tabs/appearance-tab"),
    playback: () => import("./tabs/playback-tab"),
    library: () => import("./tabs/library-tab"),
    performance: () => import("./tabs/performance-tab"),
    system: () => import("./tabs/system-tab"),
}

const AppearanceTab = React.lazy(() => tabLoaders.appearance().then(m => ({ default: m.AppearanceTab })))
const PlaybackTab = React.lazy(() => tabLoaders.playback().then(m => ({ default: m.PlaybackTab })))
const LibraryTab = React.lazy(() => tabLoaders.library().then(m => ({ default: m.LibraryTab })))
const PerformanceTab = React.lazy(() => tabLoaders.performance().then(m => ({ default: m.PerformanceTab })))
const SystemTab = React.lazy(() => tabLoaders.system().then(m => ({ default: m.SystemTab })))

import { findIgnoredBinaryPaths, settingsSchema, type SettingsFormInput, type SettingsFormValues } from "@/lib/server/settings"
import { ApiError, buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Models_Settings } from "@/api/generated/types"
import { getEffectiveSettings, syncStoresWithSettings } from "@/lib/server/settings-state"
import { SettingsLoadError } from "@/components/settings/settings-load-error"
import { applySettingsPatch, changedSettings } from "@/lib/server/settings-patch"
import { useQueryClient } from "@tanstack/react-query"


const SETTINGS_PILLARS = [
    {
        id: "appearance",
        label: "Apariencia y diseño",
        shortLabel: "Apariencia",
        icon: IconUiPalette,
        summary: "Tema, transparencia, efectos y orden del catálogo.",
    },
    {
        id: "playback",
        label: "Reproducción y audio",
        shortLabel: "Reproducción",
        icon: IconMediaPlay,
        summary: "Doblaje, saltar intro y créditos, música de fondo y modos de reproducción.",
    },
    {
        id: "library",
        label: "Biblioteca y escáner",
        shortLabel: "Biblioteca",
        icon: IconNavigationLibrary,
        summary: "Carpetas de series y películas, escáner en vivo y proveedores de metadatos.",
    },
    {
        id: "performance",
        label: "Rendimiento y hardware",
        shortLabel: "Rendimiento",
        icon: IconStatusZap,
        summary: "Datos de tu hardware, perfiles de rendimiento y aceleración por GPU.",
    },
    {
        id: "system",
        label: "Sistema e integraciones",
        shortLabel: "Sistema",
        icon: IconUiSettings,
        summary: "Claves de API, registros, respaldo de la base de datos, caché y restablecimiento.",
    },
]

const VALID_TAB_IDS = new Set(SETTINGS_PILLARS.map(p => p.id))

// El formulario es uno solo para las 5 pestañas: para marcar cuál tiene cambios
// sin guardar se reparte cada campo sucio en la pestaña que lo muestra.
const PLAYBACK_LIBRARY_KEYS = new Set([
    "preferredAudioProfile", "autoDisableSubtitlesWhenDubbed", "autoSkipIntro", "autoSkipOutro",
    "autoDetectSkipTimes", "autoPlayNextEpisode", "enableWatchContinuity",
    "marathonMode",
])
const PLAYBACK_THEME_KEYS = new Set([
    "uiSoundsEnabled", "uiSoundsVolume", "bgMusicEnabled", "bgMusicVolume", "bgMusicDir",
    "bgMusicTracks", "seriesSoundtrackMode",
])

function pillarForFieldPath(path: string): string {
    const [root, key] = path.split(".")
    switch (root) {
        case "mediastream": return "performance"
        case "googleDrive": return "library"
        case "platform": return "appearance"
        case "theme": return PLAYBACK_THEME_KEYS.has(key) ? "playback" : "appearance"
        case "library":
            if (key === "tmdbApiKey") return "system"
            return PLAYBACK_LIBRARY_KEYS.has(key) ? "playback" : "library"
        default: return "system"
    }
}

function hasDirtyLeaf(val: unknown): boolean {
    if (val === true) return true
    if (Array.isArray(val)) return val.some(hasDirtyLeaf)
    if (val && typeof val === "object") return Object.values(val).some(hasDirtyLeaf)
    return false
}

function collectDirtyPillars(node: unknown, path: string, out: Set<string>) {
    if (node === true) {
        out.add(pillarForFieldPath(path))
    } else if (Array.isArray(node)) {
        // Listas (carpetas, pistas): un solo marcador si algún elemento cambió.
        if (hasDirtyLeaf(node)) out.add(pillarForFieldPath(path))
    } else if (node && typeof node === "object") {
        for (const [key, child] of Object.entries(node)) {
            collectDirtyPillars(child, path ? `${path}.${key}` : key, out)
        }
    }
}

export const Route = createLazyFileRoute("/settings/")({
    component: SettingsPage,
})

/** Espeja las SectionBar de una pestaña (guía §5.7): al terminar de cargar, el contenido no salta. */
function SettingsTabSkeleton() {
    return (
        <div role="status" aria-label="Cargando ajustes" className="space-y-9">
            {["h-44", "h-64", "h-36"].map((height) => (
                <div
                    key={height}
                    className={`surface-content surface-content-row rounded-2xl animate-pulse motion-reduce:animate-none ${height}`}
                />
            ))}
        </div>
    )
}

/** Nodo de FieldErrors: objeto con mensaje (hoja) o con más errores (sección). */
function isErrorNode(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function SettingsPage() {
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const { data: serverSettings, isLoading, isError, refetch } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    // La pestaña vive solo en la URL (?tab): sin copia local que sincronizar.
    const activeTab = search.tab && VALID_TAB_IDS.has(search.tab) ? search.tab : "appearance"
    const [isSaveSuccess, setIsSaveSuccess] = useState(false)

    useEffect(() => {
        if (!isSaveSuccess) return
        const timer = window.setTimeout(() => setIsSaveSuccess(false), 2000)
        return () => window.clearTimeout(timer)
    }, [isSaveSuccess])

    const handleSelectTab = (tabId: string) => {
        navigate({ search: { tab: tabId }, replace: true }).catch(() => {})
    }

    // Pre-warm all lazy settings tabs sequentially in background during idle time (eliminates chunk stall without network contention)
    useEffect(() => {
        let isCancelled = false
        const loaderKeys = (Object.keys(tabLoaders) as (keyof typeof tabLoaders)[])
            .filter(tab => tab !== activeTab)
        const loaders = loaderKeys.map(tab => tabLoaders[tab])

        let currentIndex = 0
        let idleHandle: number | undefined
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined

        const loadNext = () => {
            if (isCancelled || currentIndex >= loaders.length) return
            const loader = loaders[currentIndex++]
            Promise.resolve(loader())
                .catch(() => {})
                .finally(() => {
                    if (isCancelled || currentIndex >= loaders.length) return
                    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
                        idleHandle = window
                            .requestIdleCallback(loadNext, { timeout: 3000 })
                    } else {
                        timeoutHandle = setTimeout(loadNext, 200)
                    }
                })
        }

        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            idleHandle = window
                .requestIdleCallback(loadNext, { timeout: 3000 })
        } else {
            timeoutHandle = setTimeout(loadNext, 500)
        }

        return () => {
            isCancelled = true
            if (idleHandle !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleHandle)
            }
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle)
            }
        }
    }, [activeTab])

    // KameHouse backdrop for settings
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
    useEffect(() => {
        setBackdropUrl(null)
        return () => { setBackdropUrl(null) }
    }, [setBackdropUrl])

    const form = useForm<SettingsFormInput, unknown, SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: getEffectiveSettings(serverSettings),
        mode: "onBlur",
        shouldUnregister: false,
    })

    const { control, handleSubmit, formState: { isDirty, dirtyFields, defaultValues }, reset } = form
    const saveInFlight = useRef<Promise<boolean> | null>(null)
    // Sin useMemo: RHF muta dirtyFields en sitio y la identidad no cambia entre ediciones.
    const dirtyPillars = new Set<string>()
    collectDirtyPillars(dirtyFields, "", dirtyPillars)

    useEffect(() => {
        if (serverSettings) {
            const effective = getEffectiveSettings(serverSettings)
            reset(effective, { keepDirtyValues: true })
            syncStoresWithSettings(form.getValues())
        }
    }, [serverSettings, reset, form])

    const saveValues = async (data: SettingsFormValues): Promise<boolean> => {
        // Sin los ajustes del servidor el formulario tiene defaults: guardarlos
        // pisaría la configuración real.
        if (!serverSettings) {
            toast.error("No se guardó nada porque los ajustes no se cargaron del servidor", { description: "Recarga la página e inténtalo de nuevo." })
            return false
        }
        try {
            const submitted = structuredClone(form.getValues())
            await saveSettings(changedSettings(data, settingsSchema.parse(defaultValues)))
            const fresh = queryClient.getQueryData<Models_Settings>([API_ENDPOINTS.SETTINGS.GetSettings.key])
            const effective = getEffectiveSettings(fresh ?? data)
            const pending = changedSettings(form.getValues(), submitted)
            playSound("category", 0.4)
            setIsSaveSuccess(Object.keys(pending).length === 0)
            reset(effective)
            // Las ediciones hechas durante el guardado siguen pendientes: se reaplican sobre lo guardado y quedan sucias.
            reset(applySettingsPatch(effective, pending), { keepDefaultValues: true })
            syncStoresWithSettings(form.getValues())
            toast.success("Ajustes guardados")
            void warnIgnoredBinaryPaths(data)
            return true
        } catch (err) {
            // Los errores de la API ya los muestra el onError de useServerMutation.
            if (!(err instanceof ApiError)) {
                toast.error(errorText(err, "No se pudieron guardar los ajustes"))
            }
            return false
        }
    }

    // Guardar y salir comparten la misma solicitud, incluso con clics rápidos.
    const onSubmit = (data: SettingsFormValues): Promise<boolean> => {
        if (!saveInFlight.current) {
            saveInFlight.current = saveValues(data).finally(() => { saveInFlight.current = null })
        }
        return saveInFlight.current
    }

    // El servidor descarta en silencio las rutas de FFmpeg/FFprobe que no son
    // seguras (fuera de la carpeta bin de KameHouse o del PATH): avisarlo.
    const warnIgnoredBinaryPaths = async (sent: SettingsFormValues) => {
        try {
            const fresh = await buildApiQuery<Models_Settings>({
                endpoint: API_ENDPOINTS.SETTINGS.GetSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.GetSettings.methods[0],
            })
            for (const { label, used } of findIgnoredBinaryPaths(sent.mediastream, fresh?.mediastream)) {
                toast.warning(`La ruta de ${label} no está permitida`, {
                    description: `Se usa la detectada: ${used}. Solo se aceptan binarios de la carpeta bin de KameHouse o del PATH del sistema.`,
                })
            }
        } catch {
            // Solo informativo: si falla la consulta no hay nada que avisar.
        }
    }

    const handleDiscard = () => {
        playSound("hover", 0.3)
        const effective = getEffectiveSettings(serverSettings)
        reset(effective)
        syncStoresWithSettings(effective)
    }

    const onFormError = (errors: import("react-hook-form").FieldErrors<SettingsFormInput>) => {
        const failedFields: string[] = []
        const extractErrors = (obj: Record<string, unknown> | undefined | null, prefix = "") => {
            if (!obj) return
            for (const key of Object.keys(obj)) {
                const errorObj = obj[key]
                if (isErrorNode(errorObj) && errorObj.message) {
                    failedFields.push(`${prefix}${key}: ${errorObj.message}`)
                } else if (isErrorNode(errorObj)) {
                    extractErrors(errorObj, `${prefix}${key}.`)
                }
            }
        }
        extractErrors(errors)
        // El detalle técnico (rutas de campo y mensajes del validador, en inglés) va a la consola.
        if (failedFields.length > 0) console.warn("Ajustes: campos no válidos", failedFields)
        toast.error("Hay campos con valores no válidos", {
            description: "Revisa las secciones marcadas con un punto y vuelve a guardar.",
        })
    }

    useBlocker({
        disabled: !isDirty && !isSaving,
        enableBeforeUnload: false,
        shouldBlockFn: async ({ next }) => {
            // Las pestañas comparten formulario; solo guardar al salir de Ajustes.
            if (next.pathname.replace(/\/$/, "") === "/settings") return false
            let saved = false
            await handleSubmit(async (values) => { saved = await onSubmit(values) }, onFormError)()
            if (!saved) return true
            // Si hubo otra edición durante la solicitud, conservarla en pantalla.
            return Object.keys(changedSettings(form.getValues(), settingsSchema.parse(form.formState.defaultValues))).length > 0
        },
    })

    const activePillar = useMemo(() => {
        return SETTINGS_PILLARS.find(p => p.id === activeTab) || SETTINGS_PILLARS[0]
    }, [activeTab])

    const desktopPillarSpring = useSpringPreset("entrance");
    const desktopIndicatorSpring = useSpringPreset("tabIndicator");
    const tabContentSpring = useSpringPreset("tabContent");
    const saveBarSpring = useSpringPreset("entrance");
    // Fundido de salida del contenido (80 ms, como la cabecera de Ajustes); con movimiento reducido, instantáneo.
    const reduceMotion = useReducedMotion();

    // Loader y contenido se alternan con AnimatePresence (mode="wait"): el loader sale con su fundido antes de entrar el contenido.
    const showLoader = isLoading && !serverSettings
    // Sin configuración del servidor no hay formulario: no se edita ni se guarda sobre valores por defecto (QA-01).
    const loadFailed = isError && !serverSettings

    const content = (
        // overflow-clip (no hidden): hidden crea un contenedor de scroll propio y el sidebar sticky
        // nunca se engancharía al scroll real de la página (#main-content).
        <m.div data-settings-page="" key="content" exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }} className="flex flex-col lg:flex-row min-h-full w-full text-on-surface-variant selection:bg-brand-accent/30 overflow-clip relative bg-transparent">
            {/* ── Left Sidebar Nav for Desktop (5 Clean Pillars) ─────────────────── */}
            <div className="flex w-full lg:w-auto lg:sticky top-0 lg:h-dvh shrink-0 self-start items-center pt-[calc(var(--chrome-top)+0.25rem)] pb-2 lg:pb-[calc(var(--chrome-top)+0.25rem)] px-4 lg:pr-0 pointer-events-none">
            <nav
                aria-label="Secciones de ajustes"
                data-liquid-surface="navigation"
                className="pointer-events-auto w-full lg:w-64 xl:w-[272px] max-h-full flex flex-col sectionbar rounded-3xl overflow-y-auto overflow-x-hidden no-scrollbar"
            >
                {/* Sidebar header */}
                <div className="relative z-10 px-5 pt-4 pb-3 lg:pt-5 lg:pb-4 border-b border-[var(--neutral-separator)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="type-title text-label-1 select-none">
                                Ajustes
                            </h1>
                            <p className="type-caption text-on-surface-variant mt-0.5">
                                Personaliza KameHouse
                            </p>
                        </div>
                        {isDirty && (
                            <span
                                role="img"
                                aria-label="Cambios sin guardar"
                                title="Cambios sin guardar"
                                className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-text-swap-in"
                            />
                        )}
                    </div>
                </div>

                {/* 5 Pillars list */}
                <div className="relative z-10 p-3 flex lg:flex-col gap-1 w-full overflow-x-auto">
                    {SETTINGS_PILLARS.map((pillar) => {
                        const isActive = activeTab === pillar.id
                        const Icon = pillar.icon
                        return (
                            <m.button
                                key={pillar.id}
                                type="button"
                                aria-current={isActive ? "page" : undefined}
                                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                transition={desktopPillarSpring}
                                onMouseEnter={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onFocus={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onClick={() => handleSelectTab(pillar.id)}
                                className={cn(
                                    "w-auto lg:w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left group relative shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                    "[transition:color_var(--duration-base)_var(--ease-smooth-out),background-color_var(--duration-base)_var(--ease-smooth-out)]",
                                    isActive
                                        ? "text-label-1"
                                        : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                )}
                            >
                                {isActive && (
                                    <m.div
                                        layoutId="activeDesktopPillarIndicator"
                                        transition={desktopIndicatorSpring}
                                        className="absolute inset-0 rounded-2xl bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)]"
                                    >
                                        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-brand-accent" />
                                    </m.div>
                                )}
                                <div aria-hidden="true" className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border relative z-10",
                                    "[transition:background-color_var(--duration-base)_var(--ease-smooth-out),border-color_var(--duration-base)_var(--ease-smooth-out),color_var(--duration-base)_var(--ease-smooth-out)]",
                                    isActive
                                        ? "bg-brand-accent/15 border-brand-accent/30 text-brand-accent-readable"
                                        : "bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)] text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-1"
                                )}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                    <span className={cn(
                                        // 13px en md y 14px desde lg: cada etiqueta cabe en una línea y las filas quedan parejas.
                                        "text-[13px] lg:text-sm block leading-snug font-semibold whitespace-nowrap truncate [transition:color_var(--duration-base)_var(--ease-smooth-out)]",
                                        isActive ? "text-label-1" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-1"
                                    )}>
                                        {pillar.label}
                                    </span>
                                </div>
                                {dirtyPillars.has(pillar.id) && (
                                    <span
                                        role="img"
                                        aria-label="Cambios sin guardar en esta sección"
                                        title="Cambios sin guardar"
                                        className="relative z-10 w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0 animate-text-swap-in"
                                    />
                                )}
                            </m.button>
                        )
                    })}
                </div>

                {/* Administración: vive dentro de Ajustes */}
                <div className="relative z-10 px-3 pb-3 pt-1 border-t border-[var(--neutral-separator)]">
                    <Link
                        to="/admin"
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left group text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [transition:color_var(--duration-base)_var(--ease-smooth-out),background-color_var(--duration-base)_var(--ease-smooth-out)]"
                    >
                        <div aria-hidden="true" className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)]">
                            <IconUiAdmin className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[13px] lg:text-sm block leading-snug font-semibold whitespace-nowrap truncate text-on-surface">Administración</span>
                        </div>
                    </Link>
                </div>
            </nav>
            </div>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <div className="min-w-0 flex-1 flex flex-col">{/* Sin altura fija ni overflow propio: #main-content es el único scroller (la rueda funciona sobre sidebar y cabecera, y el sidebar lg:sticky se engancha). */}
                {/* Content header */}
                <header className="shrink-0 pt-5 lg:pt-[calc(var(--chrome-top)+0.5rem)] pb-5 border-b border-[var(--neutral-separator)] sectionbar sectionbar-minimal">
                    {/* Mismo contenedor y padding que el formulario: título y tarjetas comparten borde izquierdo y aprovechan el ancho disponible. */}
                    <div className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 xl:px-10">
                    <AnimatePresence mode="wait" initial={false}>
                        <PresenceSurface
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.08 } }}
                            transition={tabContentSpring}
                        >
                            <div className="flex items-center gap-3">
                                <div aria-hidden="true" className="w-9 h-9 shrink-0 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-center overflow-hidden">
                                    <span className="flex">
                                        {React.createElement(activePillar.icon, { className: "h-4 w-4 text-brand-accent" })}
                                    </span>
                                </div>
                                <h2 className="type-title text-on-surface text-balance">
                                    {activePillar.label}
                                </h2>
                            </div>
                            <p className="mt-2 text-sm text-on-surface-variant text-pretty">
                                {activePillar.summary}
                            </p>
                        </PresenceSurface>
                    </AnimatePresence>
                    <div className="h-[2px] w-12 bg-gradient-to-r from-label-3 to-transparent rounded-full mt-3" />
                    </div>
                </header>

                {/* Scrollable form content */}
                <div className="flex-1">{/* Formulario: fluye dentro del scroll de #main-content */}
                    <FormProvider {...form}>
                        <form
                            id="settings-form"
                            onSubmit={(event) => { void handleSubmit(onSubmit, onFormError)(event) }}
                            className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 lg:py-7 pb-28 md:pb-28 space-y-6"
                        >
                            <Suspense fallback={<SettingsTabSkeleton />}>
                                <AnimatePresence mode="wait" initial={false}>
                                    <PresenceSurface
                                        key={activeTab}
                                        initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.15 } }}
                                        transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: "easeInOut" }}
                                    >
                                        {activeTab === "appearance"  && <AppearanceTab control={control} />}
                                        {activeTab === "playback"    && <PlaybackTab control={control} />}
                                        {activeTab === "library"     && <LibraryTab control={control} />}
                                        {activeTab === "performance" && <PerformanceTab control={control} />}
                                        {activeTab === "system"      && <SystemTab control={control} />}
                                    </PresenceSurface>
                                </AnimatePresence>
                            </Suspense>
                        </form>
                    </FormProvider>
                </div>
            </div>

            {/* ── Floating Save Bar ────────────────────────────────────────────── */}
            <AnimatePresence>
                {(isDirty || isSaveSuccess) && (
                    <m.div
                        data-liquid-surface="navigation"
                        data-liquid-status={isSaveSuccess ? "success" : undefined}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 12, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : 6, x: "-50%", transition: { duration: 0.15, ease: "easeOut" } }}
                        transition={saveBarSpring}
                        className={cn(
                            "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
                            "flex items-center gap-4 sm:gap-6",
                            "sectionbar sectionbar-strong sectionbar-pill rounded-full px-5 py-2.5",
                            "max-w-[calc(100vw-2rem)] w-max",
                            isSaveSuccess && "border-status-success/40 shadow-[shadow:var(--shadow-save-bar-success)]"
                        )}
                    >
                        <div className="flex items-center gap-2.5 pl-1">
                            {isSaveSuccess ? (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
                                    </span>
                                    <span className="text-xs font-bold text-status-success animate-text-swap-in">
                                        Cambios guardados
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
                                    </span>
                                    <span className="text-xs font-bold text-label-1 animate-text-swap-in">
                                        Cambios pendientes
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!isSaveSuccess && (
                                <Button intent="ghost" size="md" onClick={handleDiscard}>
                                    Descartar
                                </Button>
                            )}
                            <Button
                                type="submit"
                                form="settings-form"
                                intent="primary"
                                size="md"
                                loading={isSaving}
                                disabled={isSaveSuccess}
                                leftIcon={isSaveSuccess ? <IconUiCheck className="w-3.5 h-3.5 animate-success-check" strokeWidth={3} /> : undefined}
                                iconSpacing="0.5rem"
                                className={cn("min-w-[144px]", isSaveSuccess && "bg-status-success text-black animate-success-pop disabled:opacity-100")}
                            >
                                {isSaving ? "Guardando…" : isSaveSuccess ? "Guardado" : "Guardar ajustes"}
                            </Button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </m.div>
    )

    return (
        <AnimatePresence mode="wait" initial={false}>
            {showLoader ? <LoadingOverlayWithLogo key="loader" /> : loadFailed ? <SettingsLoadError key="load-error" onRetry={() => void refetch()} /> : content}
        </AnimatePresence>
    )
}
