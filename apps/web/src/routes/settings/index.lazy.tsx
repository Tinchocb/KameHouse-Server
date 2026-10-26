import { errorText } from "@/api/client/error-messages"
import { createLazyFileRoute, Link } from "@tanstack/react-router"
import React, { useEffect, useState, useMemo, Suspense } from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useForm, FormProvider, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
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
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

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

import { findIgnoredBinaryPaths, settingsSchema, type SettingsFormValues } from "@/lib/server/settings"
import { ApiError, buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Models_Settings } from "@/api/generated/types"
import { useAppStore, usePlayerStore, useUIStore } from "@/lib/store"
import { usePerformanceStore } from "@/lib/hardware/performance-store"

export type { SettingsFormValues }

function syncStoresWithSettings(data: Partial<SettingsFormValues>) {
    if (!data) return
    const playerState = usePlayerStore.getState()
    const uiState = useUIStore.getState()
    const playerUpdates: Record<string, unknown> = {}
    const uiUpdates: Record<string, unknown> = {}

    if (data.library) {
        const lib = data.library as Record<string, unknown>
        if (lib.preferredAudioProfile !== undefined && lib.preferredAudioProfile !== playerState.preferredAudioProfile) {
            playerUpdates.preferredAudioProfile = lib.preferredAudioProfile
        }
        if (lib.autoSkipIntro !== undefined && lib.autoSkipIntro !== playerState.autoSkipIntro) {
            playerUpdates.autoSkipIntro = lib.autoSkipIntro
        }
        if (lib.autoSkipOutro !== undefined && lib.autoSkipOutro !== playerState.autoSkipOutro) {
            playerUpdates.autoSkipOutro = lib.autoSkipOutro
        }
        if (lib.autoDisableSubtitlesWhenDubbed !== undefined && lib.autoDisableSubtitlesWhenDubbed !== playerState.autoDisableSubtitlesWhenDubbed) {
            playerUpdates.autoDisableSubtitlesWhenDubbed = lib.autoDisableSubtitlesWhenDubbed
        }
        if (lib.marathonMode !== undefined && lib.marathonMode !== playerState.marathonMode) {
            playerUpdates.marathonMode = lib.marathonMode
        }
        if (lib.tvMode !== undefined && lib.tvMode !== playerState.tvMode) {
            playerUpdates.tvMode = lib.tvMode
        }
    }
    if (data.theme) {
        const theme = data.theme as Record<string, unknown>
        if (theme.bgMusicEnabled !== undefined && theme.bgMusicEnabled !== uiState.bgMusicEnabled) {
            uiUpdates.bgMusicEnabled = theme.bgMusicEnabled
        }
        if (theme.bgMusicVolume !== undefined && theme.bgMusicVolume !== uiState.bgMusicVolume) {
            uiUpdates.bgMusicVolume = theme.bgMusicVolume
        }
        if (theme.bgMusicDir !== undefined && theme.bgMusicDir !== uiState.bgMusicDir) {
            uiUpdates.bgMusicDir = theme.bgMusicDir
        }
        if (theme.bgMusicTracks !== undefined && theme.bgMusicTracks !== uiState.bgMusicTracks) {
            uiUpdates.bgMusicTracks = theme.bgMusicTracks
        }
        if (theme.seriesSoundtrackMode !== undefined && theme.seriesSoundtrackMode !== uiState.seriesSoundtrackMode) {
            uiUpdates.seriesSoundtrackMode = theme.seriesSoundtrackMode
        }
        if (theme.uiSoundsEnabled !== undefined && theme.uiSoundsEnabled !== uiState.uiSoundsEnabled) {
            uiUpdates.uiSoundsEnabled = theme.uiSoundsEnabled
        }
        if (theme.uiSoundsVolume !== undefined && theme.uiSoundsVolume !== uiState.uiSoundsVolume) {
            uiUpdates.uiSoundsVolume = theme.uiSoundsVolume
        }
        const visualKeys = [
            "themeEra", "themeMode", "enableColorSettings", "backgroundColor", "accentColor",
            "themeEnableBlurringEffects", "themeMediaPageBannerType", "themeMediaPageBannerSize",
            "themeMediaPageBannerInfoBoxSize", "themeEnableMediaPageBlurredBackground",
            "themeAnimeLibraryCollectionDefaultSorting",
        ] as const
        const currentVisual = (uiState.themeVisual ?? {}) as Record<string, unknown>
        const nextVisual: Record<string, unknown> = { ...currentVisual }
        let visualDirty = false
        for (const key of visualKeys) {
            if (theme[key] !== undefined && theme[key] !== currentVisual[key]) {
                nextVisual[key] = theme[key]
                visualDirty = true
            } else if (theme[key] === undefined && currentVisual[key] !== undefined) {
                delete nextVisual[key]
                visualDirty = true
            }
        }
        if (visualDirty) {
            uiUpdates.themeVisual = nextVisual
        }
    }
    if (data.platform) {
        const platform = data.platform as Record<string, unknown>
        if (platform.hideAudienceScore !== undefined && platform.hideAudienceScore !== uiState.hideAudienceScore) {
            uiUpdates.hideAudienceScore = platform.hideAudienceScore
        } else if (platform.hideAudienceScore === undefined && uiState.hideAudienceScore !== undefined) {
            uiUpdates.hideAudienceScore = undefined
        }
    }
    if (Object.keys(playerUpdates).length > 0) {
        usePlayerStore.setState(playerUpdates)
    }
    if (Object.keys(uiUpdates).length > 0) {
        useUIStore.setState(uiUpdates)
    }
    if (data.mediastream) {
        const ms = data.mediastream as Record<string, unknown>
        const perfState = usePerformanceStore.getState()
        const perfUpdates: Record<string, unknown> = {}
        if (ms.performanceProfile !== undefined && ms.performanceProfile !== perfState.performanceProfile) {
            perfUpdates.performanceProfile = ms.performanceProfile
        }
        if (ms.autoGovernorEnabled !== undefined && ms.autoGovernorEnabled !== perfState.autoGovernorEnabled) {
            perfUpdates.autoGovernorEnabled = ms.autoGovernorEnabled
        }
        if (Object.keys(perfUpdates).length > 0) {
            usePerformanceStore.setState(perfUpdates)
        }
    }
}

function getEffectiveSettings(server: Partial<SettingsFormValues> | null | undefined): SettingsFormValues {
    const appState = useAppStore.getState()
    const perfState = usePerformanceStore.getState()
    const base = (server || {}) as Partial<SettingsFormValues>

    return {
        ...base,
        googleDrive: {
            enabled: base.googleDrive?.enabled ?? false,
            clientId: base.googleDrive?.clientId ?? "",
            clientSecret: base.googleDrive?.clientSecret ?? "",
            refreshToken: base.googleDrive?.refreshToken ?? "",
            folderId: base.googleDrive?.folderId ?? "",
            folderName: base.googleDrive?.folderName ?? "",
        },
        library: {
            ...base.library,
            seriesPaths: base.library?.seriesPaths ?? [],
            moviePaths: base.library?.moviePaths ?? [],
            autoScan: base.library?.autoScan ?? false,
            unifiedScan: base.library?.unifiedScan ?? false,
            refreshLibraryOnStart: base.library?.refreshLibraryOnStart ?? false,
            autoPlayNextEpisode: base.library?.autoPlayNextEpisode ?? true,
            autoDetectSkipTimes: base.library?.autoDetectSkipTimes ?? true,
            enableWatchContinuity: base.library?.enableWatchContinuity ?? true,
            scannerMatchingThreshold: base.library?.scannerMatchingThreshold ?? 0,
            scannerProvider: base.library?.scannerProvider || "anilist",
            tmdbLanguage: base.library?.tmdbLanguage || "es-MX",
            tmdbApiKey: base.library?.tmdbApiKey || "",
            scannerStrictStructure: base.library?.scannerStrictStructure ?? false,
            disableLocalScanning: base.library?.disableLocalScanning ?? false,
            disableCloudSource: base.library?.disableCloudSource ?? false,
            preferredAudioProfile: base.library?.preferredAudioProfile || appState.preferredAudioProfile || "latino",
            autoSkipIntro: base.library?.autoSkipIntro ?? appState.autoSkipIntro ?? false,
            autoSkipOutro: base.library?.autoSkipOutro ?? appState.autoSkipOutro ?? false,
            autoDisableSubtitlesWhenDubbed: base.library?.autoDisableSubtitlesWhenDubbed ?? appState.autoDisableSubtitlesWhenDubbed ?? true,
            marathonMode: base.library?.marathonMode ?? appState.marathonMode ?? false,
            tvMode: base.library?.tvMode ?? appState.tvMode ?? false,
        },
        mediastream: {
            ...base.mediastream,
            performanceProfile: base.mediastream?.performanceProfile || perfState.performanceProfile || "auto",
            autoGovernorEnabled: base.mediastream?.autoGovernorEnabled ?? perfState.autoGovernorEnabled ?? true,
        },
        theme: {
            ...base.theme,
            bgMusicEnabled: appState.bgMusicEnabled ?? base.theme?.bgMusicEnabled ?? true,
            bgMusicVolume: appState.bgMusicVolume ?? base.theme?.bgMusicVolume ?? 0.25,
            bgMusicDir: base.theme?.bgMusicDir || appState.bgMusicDir || "",
            bgMusicTracks: (base.theme?.bgMusicTracks && base.theme.bgMusicTracks.length > 0) ? base.theme.bgMusicTracks : (appState.bgMusicTracks || []),
            seriesSoundtrackMode: appState.seriesSoundtrackMode ?? base.theme?.seriesSoundtrackMode ?? true,
            uiSoundsEnabled: appState.uiSoundsEnabled ?? base.theme?.uiSoundsEnabled ?? true,
            uiSoundsVolume: appState.uiSoundsVolume ?? base.theme?.uiSoundsVolume ?? 1.0,
        },
    } as SettingsFormValues
}

const SETTINGS_PILLARS = [
    {
        id: "appearance",
        label: "Apariencia y diseño",
        shortLabel: "Apariencia",
        icon: IconUiPalette,
        summary: "Tema neutro o por era, transparencia, efectos y orden del catálogo.",
        keywords: ["tema", "era", "vidrio", "blur", "liquid glass", "fondo", "diseño", "orden", "dragon ball", "amoled"]
    },
    {
        id: "playback",
        label: "Reproducción y audio",
        shortLabel: "Reproducción",
        icon: IconMediaPlay,
        summary: "Doblaje, saltar intro y créditos, música de fondo y modos de reproducción.",
        keywords: ["audio", "doblaje", "latino", "skip", "intro", "outro", "relleno", "música", "volumen", "maratón", "tv"]
    },
    {
        id: "library",
        label: "Biblioteca y escáner",
        shortLabel: "Biblioteca",
        icon: IconNavigationLibrary,
        summary: "Carpetas de series y películas, escáner en vivo y proveedores de metadatos.",
        keywords: ["carpetas", "directorios", "series", "peliculas", "escaner", "dragonball", "live", "tmdb", "anilist", "jikan", "scan"]
    },
    {
        id: "performance",
        label: "Rendimiento y hardware",
        shortLabel: "Rendimiento",
        icon: IconStatusZap,
        summary: "Datos de tu hardware, perfiles de rendimiento y aceleración por GPU.",
        keywords: ["hardware", "gpu", "nvenc", "qsv", "amf", "apple", "cpu", "ram", "transcode", "ffmpeg", "ultra", "eco", "rendimiento"]
    },
    {
        id: "system",
        label: "Sistema e integraciones",
        shortLabel: "Sistema",
        icon: IconUiSettings,
        summary: "Claves de API, registros, respaldo de la base de datos, caché y restablecimiento.",
        keywords: ["sistema", "tmdb", "omdb", "api", "database", "sqlite", "backup", "cache", "notificaciones", "peligro", "registros", "logs", "diagnóstico"]
    },
]

const VALID_TAB_IDS = new Set(SETTINGS_PILLARS.map(p => p.id))

// El formulario es uno solo para las 5 pestañas: para marcar cuál tiene cambios
// sin guardar se reparte cada campo sucio en la pestaña que lo muestra.
const PLAYBACK_LIBRARY_KEYS = new Set([
    "preferredAudioProfile", "autoDisableSubtitlesWhenDubbed", "autoSkipIntro", "autoSkipOutro",
    "autoDetectSkipTimes", "autoPlayNextEpisode", "enableWatchContinuity",
    "marathonMode", "tvMode",
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

function SettingsPage() {
    const { playSound } = useSound()
    const { data: serverSettings, isLoading } = useGetSettings()
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
                        idleHandle = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
                            .requestIdleCallback(loadNext, { timeout: 3000 })
                    } else {
                        timeoutHandle = setTimeout(loadNext, 200)
                    }
                })
        }

        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            idleHandle = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
                .requestIdleCallback(loadNext, { timeout: 3000 })
        } else {
            timeoutHandle = setTimeout(loadNext, 500)
        }

        return () => {
            isCancelled = true
            if (idleHandle !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
                (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleHandle)
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

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: getEffectiveSettings(serverSettings as unknown as SettingsFormValues),
        mode: "onBlur",
        shouldUnregister: false,
    })

    const { control, handleSubmit, formState: { isDirty, dirtyFields }, reset } = form
    // Sin useMemo: RHF muta dirtyFields en sitio y la identidad no cambia entre ediciones.
    const dirtyPillars = new Set<string>()
    collectDirtyPillars(dirtyFields, "", dirtyPillars)

    useEffect(() => {
        if (serverSettings && !isDirty) {
            const effective = getEffectiveSettings(serverSettings as unknown as SettingsFormValues)
            reset(effective, { keepDirtyValues: true })
            syncStoresWithSettings(effective)
        }
    }, [serverSettings, reset, isDirty])

    const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
        // Sin los ajustes del servidor el formulario tiene defaults: guardarlos
        // pisaría la configuración real.
        if (!serverSettings) {
            toast.error("No se guardó nada porque los ajustes no se cargaron del servidor", { description: "Recarga la página e inténtalo de nuevo." })
            return
        }
        try {
            await saveSettings(data as unknown as SaveSettings_Variables)
            playSound("category", 0.4)
            setIsSaveSuccess(true)
            reset(data)
            syncStoresWithSettings(data)
            toast.success("Ajustes guardados")
            void warnIgnoredBinaryPaths(data)
        } catch (err) {
            // Los errores de la API ya los muestra el onError de useServerMutation.
            if (!(err instanceof ApiError)) {
                toast.error(errorText(err, "No se pudieron guardar los ajustes"))
            }
        }
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
        const effective = getEffectiveSettings(serverSettings as unknown as SettingsFormValues)
        reset(effective)
        syncStoresWithSettings(effective)
    }

    const onFormError = (errors: import("react-hook-form").FieldErrors<SettingsFormValues>) => {
        const failedFields: string[] = []
        const extractErrors = (obj: Record<string, unknown> | undefined | null, prefix = "") => {
            if (!obj) return
            for (const key of Object.keys(obj)) {
                const errorObj = obj[key] as Record<string, unknown> | undefined
                if (errorObj && errorObj.message) {
                    failedFields.push(`${prefix}${key}: ${errorObj.message}`)
                } else if (errorObj && typeof errorObj === "object") {
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

    const activePillar = useMemo(() => {
        return SETTINGS_PILLARS.find(p => p.id === activeTab) || SETTINGS_PILLARS[0]
    }, [activeTab])

    const mobilePillarOptions = useMemo<SegmentedOption<string>[]>(() => {
        return SETTINGS_PILLARS.map((item) => {
            const Icon = item.icon
            return {
                value: item.id,
                label: item.shortLabel,
                icon: <Icon className="w-4 h-4 shrink-0" />,
            }
        })
    }, [])

    // Degradé de pista en las pestañas móviles: se muestra del lado donde quedan pestañas ocultas.
    const mobileTabsRef = React.useRef<HTMLElement>(null)
    const [tabsFade, setTabsFade] = React.useState({ left: false, right: false })
    const updateTabsFade = React.useCallback(() => {
        const el = mobileTabsRef.current
        if (!el) return
        const left = el.scrollLeft > 4
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
        setTabsFade((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }, [])
    React.useEffect(() => {
        updateTabsFade()
        window.addEventListener("resize", updateTabsFade, { passive: true })
        return () => window.removeEventListener("resize", updateTabsFade)
    }, [updateTabsFade, isLoading])

    const desktopPillarSpring = useSpringPreset("entrance");
    const desktopIndicatorSpring = useSpringPreset("tabIndicator");
    const tabContentSpring = useSpringPreset("tabContent");
    const saveBarSpring = useSpringPreset("entrance");
    // Fundido de salida del contenido (80 ms, como la cabecera de Ajustes); con movimiento reducido, instantáneo.
    const reduceMotion = useReducedMotion();

    // Loader y contenido se alternan con AnimatePresence (mode="wait"): el loader sale con su fundido antes de entrar el contenido.
    const showLoader = isLoading && !serverSettings

    const content = (
        // overflow-clip (no hidden): hidden crea un contenedor de scroll propio y el sidebar sticky
        // nunca se engancharía al scroll real de la página (#main-content).
        <m.div key="content" exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }} className="flex flex-col md:flex-row h-full w-full text-on-surface-variant selection:bg-brand-accent/30 overflow-clip relative bg-transparent">
            {/* ── Mobile Segmented Tab Bar ────────────────────────────────────────── */}
            {/* En móvil el h1 visible vive en la barra lateral de escritorio (oculta): este mantiene el título de página. */}
            <h1 className="sr-only md:hidden">Ajustes</h1>
            <div className="md:hidden relative shrink-0 w-full z-20 border-b border-[var(--neutral-separator)] sectionbar sectionbar-strong">
            <nav
                ref={mobileTabsRef}
                onScroll={updateTabsFade}
                aria-label="Navegación de ajustes"
                className="w-full flex flex-row overflow-x-auto no-scrollbar px-3 py-2.5"
            >
                <SegmentedControl
                    aria-label="Pestañas de ajustes"
                    layoutId="activeMobileTabIndicator"
                    semantics="tablist"
                    tone="neutral"
                    surface="inset"
                    labelStyle="sentence"
                    value={activeTab}
                    onChange={handleSelectTab}
                    onOptionHover={(val) => tabLoaders[val as keyof typeof tabLoaders]?.()}
                    options={mobilePillarOptions}
                    className="w-max"
                />
                <Link
                    to="/admin"
                    className="ml-2 shrink-0 min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-on-surface-variant active:scale-95 transition-[transform,color] duration-fast"
                >
                    <IconUiAdmin className="w-4 h-4 shrink-0" aria-hidden />
                    Administración
                </Link>
            </nav>
            {/* Pista de scroll: degradé en el borde donde aún hay pestañas fuera de vista */}
            <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/70 to-transparent transition-opacity duration-fast", tabsFade.left ? "opacity-100" : "opacity-0")} />
            <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/70 to-transparent transition-opacity duration-fast", tabsFade.right ? "opacity-100" : "opacity-0")} />
            </div>

            {/* ── Left Sidebar Nav for Desktop (5 Clean Pillars) ─────────────────── */}
            {/* Envoltorio sticky del alto exacto de la ventana: acompaña al scroll y centra la tarjeta
                a la izquierda. Centrar con flex (y no con top-1/2 + translate) evita que, al llegar al
                final de la página, el navegador empuje la tarjeta hacia arriba (usa el borde sin
                transformar). py-[4.5rem] deja libre la barra superior de la app. */}
            <div className="hidden md:flex sticky top-0 h-dvh shrink-0 self-start items-center py-[calc(var(--chrome-top)+0.25rem)] pl-4 pointer-events-none">
            <nav
                aria-label="Secciones de ajustes"
                className="pointer-events-auto md:w-64 xl:w-[272px] max-h-full flex flex-col sectionbar rounded-3xl overflow-y-auto overflow-x-hidden no-scrollbar"
            >
                {/* Sidebar header */}
                <div className="relative z-10 px-5 pt-5 pb-4 border-b border-[var(--neutral-separator)]">
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
                <div className="relative z-10 p-3 flex flex-col space-y-1 w-full">
                    {SETTINGS_PILLARS.map((pillar) => {
                        const isActive = activeTab === pillar.id
                        const Icon = pillar.icon
                        return (
                            <m.button
                                key={pillar.id}
                                type="button"
                                aria-current={isActive ? "page" : undefined}
                                whileTap={{ scale: 0.98 }}
                                transition={desktopPillarSpring}
                                onMouseEnter={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onFocus={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onClick={() => handleSelectTab(pillar.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left group relative shrink-0 overflow-hidden",
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left group text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [transition:color_var(--duration-base)_var(--ease-smooth-out),background-color_var(--duration-base)_var(--ease-smooth-out)]"
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
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Content header */}
                <header className="shrink-0 pt-5 md:pt-[calc(var(--chrome-top)+0.5rem)] pb-5 border-b border-[var(--neutral-separator)] sectionbar sectionbar-minimal">
                    {/* Mismo contenedor y padding que el formulario: título y tarjetas comparten borde izquierdo y aprovechan el ancho disponible. */}
                    <div className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 xl:px-10">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.08 } }}
                            transition={tabContentSpring}
                        >
                            <div className="flex items-center gap-3">
                                <div aria-hidden="true" className="w-9 h-9 shrink-0 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-center overflow-hidden">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <m.span
                                            key={activeTab + "-icon"}
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.6 }}
                                            transition={desktopIndicatorSpring}
                                            className="flex"
                                        >
                                            {React.createElement(activePillar.icon, { className: "h-4 w-4 text-brand-accent" })}
                                        </m.span>
                                    </AnimatePresence>
                                </div>
                                <h2 className="type-title text-on-surface text-balance">
                                    {activePillar.label}
                                </h2>
                            </div>
                            <p className="mt-2 text-sm text-on-surface-variant text-pretty">
                                {activePillar.summary}
                            </p>
                        </m.div>
                    </AnimatePresence>
                    <div className="h-[2px] w-12 bg-gradient-to-r from-label-3 to-transparent rounded-full mt-3" />
                    </div>
                </header>

                {/* Scrollable form content */}
                <div className="flex-1 overflow-y-auto no-scrollbar transform-gpu [contain:paint]">
                    <FormProvider {...form}>
                        <form
                            id="settings-form"
                            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>, onFormError)}
                            className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 lg:py-7 pb-28 md:pb-10 space-y-6 min-h-full"
                        >
                            <Suspense fallback={<SettingsTabSkeleton />}>
                                <AnimatePresence mode="wait" initial={false}>
                                    <m.div
                                        key={activeTab}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, transition: { duration: 0.08 } }}
                                        transition={tabContentSpring}
                                    >
                                        {activeTab === "appearance"  && <AppearanceTab control={control} />}
                                        {activeTab === "playback"    && <PlaybackTab control={control} />}
                                        {activeTab === "library"     && <LibraryTab control={control} />}
                                        {activeTab === "performance" && <PerformanceTab control={control} />}
                                        {activeTab === "system"      && <SystemTab control={control} />}
                                    </m.div>
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
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 50, x: "-50%" }}
                        transition={saveBarSpring}
                        className={cn(
                            "fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-1/2 -translate-x-1/2 z-50",
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
                                className={cn(isSaveSuccess && "bg-status-success text-black animate-success-pop disabled:opacity-100")}
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
            {showLoader ? <LoadingOverlayWithLogo key="loader" /> : content}
        </AnimatePresence>
    )
}
