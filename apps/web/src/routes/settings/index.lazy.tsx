import { createLazyFileRoute } from "@tanstack/react-router"
import React, { useEffect, useState, useMemo, Suspense } from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useForm, FormProvider, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { m, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconUiPalette, IconMediaPlay, IconNavigationLibrary, IconStatusZap, IconUiSettings, IconUiCheck } from "@/components/ui/icons"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
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

import { settingsSchema, type SettingsFormValues } from "@/lib/server/settings"
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
        if (lib.autoSkipFiller !== undefined && lib.autoSkipFiller !== playerState.autoSkipFiller) {
            playerUpdates.autoSkipFiller = lib.autoSkipFiller
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
            "themeEnableBlurringEffects", "themeEnableLiquidGlass", "themeEnableSidebarGradient",
            "themeEnableCinematicGrain", "themeMediaPageBannerType", "themeMediaPageBannerSize",
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
            primaryMetadataProvider: base.library?.primaryMetadataProvider || "anilist",
            scannerProvider: base.library?.scannerProvider || base.library?.primaryMetadataProvider || "anilist",
            tmdbLanguage: base.library?.tmdbLanguage || "es-MX",
            tmdbApiKey: base.library?.tmdbApiKey || "",
            scannerStrictStructure: base.library?.scannerStrictStructure ?? false,
            scannerUseLegacyMatching: base.library?.scannerUseLegacyMatching ?? false,
            disableLocalScanning: base.library?.disableLocalScanning ?? false,
            disableCloudSource: base.library?.disableCloudSource ?? false,
            preferredAudioProfile: base.library?.preferredAudioProfile || appState.preferredAudioProfile || "latino",
            autoSkipIntro: base.library?.autoSkipIntro ?? appState.autoSkipIntro ?? false,
            autoSkipOutro: base.library?.autoSkipOutro ?? appState.autoSkipOutro ?? false,
            autoSkipFiller: base.library?.autoSkipFiller ?? appState.autoSkipFiller ?? false,
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

export const SETTINGS_PILLARS = [
    {
        id: "appearance",
        label: "Apariencia y Diseño",
        shortLabel: "Apariencia",
        icon: IconUiPalette,
        desc: "Temas por era, modo AMOLED y efectos visuales",
        keywords: ["tema", "era", "vidrio", "blur", "liquid glass", "fondo", "diseño", "orden", "dragon ball", "amoled"]
    },
    {
        id: "playback",
        label: "Reproducción y Audio",
        shortLabel: "Reproducción",
        icon: IconMediaPlay,
        desc: "Doblaje, auto-skip, música de fondo y modos",
        keywords: ["audio", "doblaje", "latino", "skip", "intro", "outro", "relleno", "música", "volumen", "maratón", "tv"]
    },
    {
        id: "library",
        label: "Biblioteca y Escáner",
        shortLabel: "Biblioteca",
        icon: IconNavigationLibrary,
        desc: "Carpetas, escáner en vivo y metadatos",
        keywords: ["carpetas", "directorios", "series", "peliculas", "escaner", "dragonball", "live", "tmdb", "anilist", "jikan", "scan"]
    },
    {
        id: "performance",
        label: "Rendimiento y Hardware",
        shortLabel: "Rendimiento",
        icon: IconStatusZap,
        desc: "Telemetría de hardware, perfiles y aceleración GPU",
        keywords: ["hardware", "gpu", "nvenc", "qsv", "amf", "apple", "cpu", "ram", "transcode", "ffmpeg", "ultra", "eco", "rendimiento"]
    },
    {
        id: "system",
        label: "Sistema e Integraciones",
        shortLabel: "Sistema",
        icon: IconUiSettings,
        desc: "Claves de API, respaldo SQLite, caché y reseteo",
        keywords: ["sistema", "tmdb", "omdb", "api", "database", "sqlite", "backup", "cache", "notificaciones", "peligro"]
    },
]

const VALID_TAB_IDS = new Set(SETTINGS_PILLARS.map(p => p.id))

export const Route = createLazyFileRoute("/settings/")({
    component: SettingsPage,
})

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const initialTab = search.tab && VALID_TAB_IDS.has(search.tab) ? search.tab : "appearance"
    const [activeTab, setActiveTab] = useState<string>(initialTab)
    const [prevSearchTab, setPrevSearchTab] = useState(search.tab)
    const [isSaveSuccess, setIsSaveSuccess] = useState(false)

    if (search.tab !== prevSearchTab) {
        setPrevSearchTab(search.tab)
        if (search.tab && VALID_TAB_IDS.has(search.tab)) {
            setActiveTab(search.tab)
        }
    }

    const handleSelectTab = (tabId: string) => {
        setActiveTab(tabId)
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

    const { control, handleSubmit, formState: { isDirty }, reset } = form

    useEffect(() => {
        if (serverSettings && !isDirty) {
            const effective = getEffectiveSettings(serverSettings as unknown as SettingsFormValues)
            reset(effective, { keepDirtyValues: true })
            syncStoresWithSettings(effective)
        }
    }, [serverSettings, reset, isDirty])

    const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
        try {
            await saveSettings(data as unknown as SaveSettings_Variables)
            setIsSaveSuccess(true)
            reset(data)
            syncStoresWithSettings(data)
            toast.success("Ajustes guardados con éxito")
            setTimeout(() => {
                setIsSaveSuccess(false)
            }, 2000)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar los ajustes")
        }
    }

    const handleDiscard = () => {
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
        const errorMsg = failedFields.length > 0 
            ? `Errores de validación: ${failedFields.join(", ")}` 
            : "Hay errores de validación en el formulario"
        toast.error(errorMsg)
    }

    const activePillar = useMemo(() => {
        return SETTINGS_PILLARS.find(p => p.id === activeTab) || SETTINGS_PILLARS[0]
    }, [activeTab])

    const mobileTabSpring = useSpringPreset("tabIndicator");
    const desktopPillarSpring = useSpringPreset("entrance");
    const desktopIndicatorSpring = useSpringPreset("tabIndicator");
    const tabContentSpring = useSpringPreset("tabContent");
    const saveBarSpring = useSpringPreset("entrance");

    if (isLoading && !serverSettings) return <LoadingOverlayWithLogo />

    return (
        <div className="flex flex-col md:flex-row h-full w-full text-on-surface-variant selection:bg-brand-accent/30 overflow-hidden relative bg-transparent">
            {/* ── Mobile Segmented Tab Bar ────────────────────────────────────────── */}
            <nav className="md:hidden shrink-0 w-full flex flex-row overflow-x-auto no-scrollbar border-b border-white/10 sectionbar sectionbar-strong px-3 py-2.5 gap-2 z-20">
                {SETTINGS_PILLARS.map((item) => {
                    const isActive = activeTab === item.id
                    const Icon = item.icon
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onMouseEnter={() => tabLoaders[item.id as keyof typeof tabLoaders]?.()}
                            onFocus={() => tabLoaders[item.id as keyof typeof tabLoaders]?.()}
                            onClick={() => handleSelectTab(item.id)}
                            className={cn(
                                "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 active:scale-95",
                                "[transition:color_var(--duration-fast)_var(--ease-smooth-out),background-color_var(--duration-fast)_var(--ease-smooth-out)]",
                                isActive ? "text-black font-black" : "text-on-surface-variant hover:text-white"
                            )}
                        >
                            {isActive && (
                                <m.div
                                    layoutId="activeMobileTabIndicator"
                                    transition={mobileTabSpring}
                                    className="absolute inset-0 bg-white rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.5)]"
                                />
                            )}
                            <Icon className={cn("w-4 h-4 shrink-0 relative z-10", isActive ? "text-black" : "text-on-surface-variant")} />
                            <span className="relative z-10">{item.shortLabel}</span>
                        </button>
                    )
                })}
            </nav>

            {/* ── Left Sidebar Nav for Desktop (5 Clean Pillars) ─────────────────── */}
            <nav
                className="hidden md:flex relative md:w-60 lg:w-[280px] xl:w-[290px] shrink-0 h-full flex-col border-r border-white/10 sectionbar overflow-y-auto overflow-x-hidden no-scrollbar"
            >
                {/* Sidebar header */}
                <div className="relative z-10 px-6 pt-20 pb-5 border-b border-white/[0.08]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight select-none font-display">
                                AJUSTES
                            </h1>
                            <p className="text-2xs font-mono text-on-surface-variant uppercase tracking-widest mt-0.5">
                                Panel de Control
                            </p>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                    </div>
                </div>

                {/* 5 Pillars list */}
                <div className="relative z-10 flex-1 px-4 py-5 flex flex-col space-y-1.5 w-full">
                    {SETTINGS_PILLARS.map((pillar) => {
                        const isActive = activeTab === pillar.id
                        const Icon = pillar.icon
                        return (
                            <m.button
                                key={pillar.id}
                                type="button"
                                whileHover={{ scale: 1.015, x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                transition={desktopPillarSpring}
                                onMouseEnter={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onFocus={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onClick={() => handleSelectTab(pillar.id)}
                                className={cn(
                                    "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-left group relative shrink-0 overflow-hidden",
                                    "[transition:color_var(--duration-fast)_var(--ease-smooth-out),background-color_var(--duration-fast)_var(--ease-smooth-out)]",
                                    isActive
                                        ? "text-black font-bold"
                                        : "text-on-surface-variant hover:text-white hover:bg-white/[0.04]"
                                )}
                            >
                                {isActive && (
                                    <m.div
                                        layoutId="activeDesktopPillarIndicator"
                                        transition={desktopIndicatorSpring}
                                        className="absolute inset-0 bg-white rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.5)]"
                                    />
                                )}
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border relative z-10",
                                    "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out)]",
                                    isActive
                                        ? "bg-black/10 border-black/20 text-black"
                                        : "bg-white/5 border-white/10 text-on-surface-variant group-hover:text-white group-hover:bg-white/10"
                                )}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                    <span className={cn(
                                        "text-xs sm:text-sm block leading-snug [transition:color_var(--duration-fast)_var(--ease-smooth-out)]",
                                        isActive ? "font-black text-black" : "font-semibold text-on-surface group-hover:text-white"
                                    )}>
                                        {pillar.label}
                                    </span>
                                    <span className={cn(
                                        "text-3xs block mt-0.5 font-normal truncate [transition:color_var(--duration-fast)_var(--ease-smooth-out)]",
                                        isActive ? "text-black/70 font-medium" : "text-on-surface-variant/70 group-hover:text-on-surface-variant"
                                    )}>
                                        {pillar.desc}
                                    </span>
                                </div>
                            </m.button>
                        )
                    })}
                </div>
            </nav>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Content header */}
                <header className="shrink-0 px-6 sm:px-8 lg:px-10 pt-5 md:pt-20 pb-5 border-b border-white/[0.06] sectionbar sectionbar-minimal">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={tabContentSpring}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-7 h-7 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-center overflow-hidden">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <m.span
                                            key={activeTab + "-icon"}
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.6 }}
                                            transition={desktopIndicatorSpring}
                                            className="flex"
                                        >
                                            {React.createElement(activePillar.icon, { className: "h-3.5 w-3.5 text-brand-accent" })}
                                        </m.span>
                                    </AnimatePresence>
                                </div>
                                <span key={activeTab + "-short"} className="text-label-sm uppercase tracking-wider text-on-surface-variant font-mono animate-text-swap-in">
                                    {activePillar.shortLabel}
                                </span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-display tracking-wider text-on-surface leading-tight uppercase text-balance">
                                {activePillar.label}
                            </h2>
                        </m.div>
                    </AnimatePresence>
                    <div className="h-[2px] w-12 bg-gradient-to-r from-white/40 to-transparent rounded-full mt-3" />
                </header>

                {/* Scrollable form content */}
                <div className="flex-1 overflow-y-auto no-scrollbar transform-gpu [contain:paint]">
                    <FormProvider {...form}>
                        <form
                            id="settings-form"
                            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>, onFormError)}
                            className="w-full max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-7 pb-32 space-y-9 min-h-full"
                        >
                            <Suspense fallback={<div className="flex items-center justify-center w-full h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-accent border-t-transparent animate-spin" /></div>}>
                                <AnimatePresence mode="wait" initial={false}>
                                    <m.div
                                        key={activeTab}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -14 }}
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
            </main>

            {/* ── Floating Save Bar ────────────────────────────────────────────── */}
            <AnimatePresence>
                {(isDirty || isSaveSuccess) && (
                    <m.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 50, x: "-50%" }}
                        transition={saveBarSpring}
                        className={cn(
                            "fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50",
                            "flex items-center gap-4 sm:gap-6",
                            "sectionbar sectionbar-strong rounded-full px-5 py-2.5",
                            "max-w-[calc(100vw-2rem)] w-max",
                            isSaveSuccess && "border-emerald-500/40 bg-zinc-950/80 shadow-[inset_0_1px_1px_0_rgba(52,211,153,0.3),0_12px_36px_-6px_rgba(0,0,0,0.85)]"
                        )}
                    >
                        <div className="flex items-center gap-2.5 pl-1">
                            {isSaveSuccess ? (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    </span>
                                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider animate-text-swap-in">
                                        Ajustes sincronizados
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]" />
                                    </span>
                                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider animate-text-swap-in">
                                        Cambios pendientes
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!isSaveSuccess && (
                                <button
                                    type="button"
                                    onClick={handleDiscard}
                                    className="text-xs font-semibold text-on-surface-variant hover:text-white transition-[color,background-color,transform] duration-fast ease-smooth-out px-3.5 py-1.5 rounded-full hover:bg-white/10 active:scale-95 cursor-pointer min-h-[36px]"
                                >
                                    Descartar
                                </button>
                            )}
                            <button
                                type="submit"
                                form="settings-form"
                                disabled={isSaving || isSaveSuccess}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2 min-h-[36px] rounded-full text-xs font-black select-none cursor-pointer uppercase tracking-wider",
                                    "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),opacity_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                                    isSaveSuccess
                                        ? "bg-emerald-400 text-black animate-success-pop"
                                        : "bg-white text-black hover:bg-white/90 hover:scale-102 active:scale-95 disabled:opacity-50"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                                        <span className="animate-text-swap-in">Guardando...</span>
                                    </>
                                ) : isSaveSuccess ? (
                                    <>
                                        <IconUiCheck className="w-3.5 h-3.5 animate-success-check" strokeWidth={3} />
                                        <span className="animate-text-swap-in">¡Guardado!</span>
                                    </>
                                ) : (
                                    <span className="animate-text-swap-in">Guardar Ajustes</span>
                                )}
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}
