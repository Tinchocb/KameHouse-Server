import { createFileRoute } from "@tanstack/react-router"
import React, { useEffect, useState, useMemo, Suspense } from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useForm, FormProvider, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconUiPalette, IconMediaPlay, IconNavigationLibrary, IconStatusZap, IconUiSettings } from "@/components/ui/icons";
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

// ─── Schema ───────────────────────────────────────────────────────────────────
// Matches backend Models_Settings exactly

const settingsSchema = z.object({
    library: z.object({
        seriesPaths: z.array(z.string()).nullish().transform(v => v ?? []),
        moviePaths: z.array(z.string()).nullish().transform(v => v ?? []),
        autoScan: z.boolean().default(false),
        refreshLibraryOnStart: z.boolean().default(false),
        autoPlayNextEpisode: z.boolean().default(true),
        autoDetectSkipTimes: z.boolean().default(true),
        enableWatchContinuity: z.boolean().default(false),
        scannerMatchingThreshold: z.number().default(0),
        tmdbApiKey: z.string().default(""),
        tmdbLanguage: z.string().default("es-MX"),
        scannerUseLegacyMatching: z.boolean().default(false),
        scannerStrictStructure: z.boolean().default(false),
        scannerProvider: z.string().default(""),
        disableLocalScanning: z.boolean().default(false),
        primaryMetadataProvider: z.string().default("tmdb"),
        lastScanAt: z.any().optional(),
    }).passthrough().default({}),
    mediaPlayer: z.object({}).passthrough().default({}),
    mediastream: z.object({
        transcodeEnabled: z.boolean().default(false),
        transcodeHwAccel: z.string().default("auto"),
        transcodeThreads: z.number().default(0),
        transcodePreset: z.string().default(""),
        disableAutoSwitchToDirectPlay: z.boolean().default(false),
        directPlayOnly: z.boolean().default(false),
        preTranscodeEnabled: z.boolean().default(false),
        preTranscodeLibraryDir: z.string().default(""),
        transcodeHwAccelCustomSettings: z.string().default(""),
        ffmpegPath: z.string().default(""),
        ffprobePath: z.string().default(""),
    }).passthrough().default({}),
    theme: z.object({
        enableColorSettings: z.boolean().default(false),
        backgroundColor: z.string().default("#050506"),
        accentColor: z.string().default("#C8102E"),
        themeEra: z.string().default(""),
        themeMode: z.string().default(""),
        themeEnableLiquidGlass: z.boolean().default(false),
        themeSmallerEpisodeCarouselSize: z.boolean().default(false),
        themeExpandSidebarOnHover: z.boolean().default(false),
        themeLibraryScreenBannerType: z.string().default("dynamic"),
        themeLibraryScreenCustomBannerImage: z.string().default(""),
        themeLibraryScreenCustomBannerPosition: z.string().default("50% 50%"),
        themeLibraryScreenCustomBannerOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundImage: z.string().default(""),
        themeLibraryScreenCustomBackgroundOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundBlur: z.string().default("none"),
        themeEnableMediaPageBlurredBackground: z.boolean().default(false),
        themeDisableSidebarTransparency: z.boolean().default(false),
        themeDisableLibraryScreenGenreSelector: z.boolean().default(false),
        themeDisableCarouselAutoScroll: z.boolean().default(false),
        themeMediaPageBannerType: z.string().default("default"),
        themeMediaPageBannerSize: z.string().default("default"),
        themeMediaPageBannerInfoBoxSize: z.string().default("default"),
        themeShowEpisodeCardAnimeInfo: z.boolean().default(true),
        themeAnimeLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),
        themeShowAnimeUnwatchedCount: z.boolean().default(true),
        themeHideEpisodeCardDescription: z.boolean().default(false),
        themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
        themeCustomCSS: z.string().max(20000).default(""),
        themeMobileCustomCSS: z.string().max(20000).default(""),
        themeUnpinnedMenuItems: z.array(z.string()).nullish().transform(v => v ?? []),
        themeEnableSidebarGradient: z.boolean().default(false),
        themeEnableBlurringEffects: z.boolean().default(false),
        themeEnableCinematicGrain: z.boolean().default(false),
    }).passthrough().default({}),

    notifications: z.object({
        disableNotifications: z.boolean().default(false),
        disableAutoScannerNotifications: z.boolean().default(false),
    }).passthrough().default({}),
    Platform: z.object({
        hideAudienceScore: z.boolean().default(false),
    }).passthrough().default({}),
}).passthrough()

export type SettingsFormValues = z.infer<typeof settingsSchema>

interface SettingsSearchParams {
    tab?: string
}

export const Route = createFileRoute("/settings/")({
    validateSearch: (search: Record<string, unknown>): SettingsSearchParams => ({
        tab: typeof search.tab === "string" ? search.tab : undefined,
    }),
    component: SettingsPage,
})

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

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const initialTab = search.tab && VALID_TAB_IDS.has(search.tab) ? search.tab : "appearance"
    const [activeTab, setActiveTab] = useState<string>(initialTab)

    useEffect(() => {
        if (search.tab && VALID_TAB_IDS.has(search.tab) && search.tab !== activeTab) {
            setActiveTab(search.tab)
        }
    }, [search.tab, activeTab])

    const handleSelectTab = (tabId: string) => {
        setActiveTab(tabId)
        navigate({ search: { tab: tabId }, replace: true }).catch(() => {})
    }

    // Pre-warm all lazy settings tabs sequentially in background during idle time (eliminates chunk stall without network contention)
    useEffect(() => {
        let isCancelled = false
        // Excluir el tab activo inicial para no competir con el montaje actual
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
    }, [])

    // KameHouse backdrop for settings
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
    useEffect(() => {
        setBackdropUrl(null)
        return () => { setBackdropUrl(null) }
    }, [setBackdropUrl])

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: (serverSettings || {}) as unknown as SettingsFormValues,
        mode: "onBlur",
        shouldUnregister: false,
    })

    const { control, handleSubmit, formState: { isDirty }, reset } = form

    useEffect(() => {
        if (serverSettings && !isDirty) {
            reset(serverSettings as unknown as SettingsFormValues, { keepDirtyValues: true })
        }
    }, [serverSettings, reset, isDirty])

    const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
        try {
            await saveSettings(data as unknown as SaveSettings_Variables)
            toast.success("Ajustes guardados con éxito")
            reset(data)
        } catch {
            toast.error("Error al guardar los ajustes")
        }
    }

    const onFormError = (errors: import("react-hook-form").FieldErrors<SettingsFormValues>) => {
        console.error("Form Validation Errors:", errors)
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
                                "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95",
                                isActive ? "text-zinc-950 font-black" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeMobileTabIndicator"
                                    transition={mobileTabSpring}
                                    className="absolute inset-0 bg-white rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.5)]"
                                />
                            )}
                            <Icon className={cn("w-4 h-4 shrink-0 relative z-10", isActive ? "text-zinc-950" : "text-zinc-400")} />
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
                            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">
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
                            <motion.button
                                key={pillar.id}
                                type="button"
                                whileHover={{ scale: 1.015, x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                transition={desktopPillarSpring}
                                onMouseEnter={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onFocus={() => tabLoaders[pillar.id as keyof typeof tabLoaders]?.()}
                                onClick={() => handleSelectTab(pillar.id)}
                                className={cn(
                                    "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-left transition-all duration-200 group relative shrink-0 overflow-hidden",
                                    isActive
                                        ? "text-zinc-950 font-bold"
                                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeDesktopPillarIndicator"
                                        transition={desktopIndicatorSpring}
                                        className="absolute inset-0 bg-white rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.5)]"
                                    />
                                )}
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 relative z-10",
                                    isActive
                                        ? "bg-zinc-950/10 border-zinc-950/20 text-zinc-950"
                                        : "bg-white/5 border-white/10 text-zinc-400 group-hover:text-white group-hover:bg-white/10"
                                )}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                    <span className={cn(
                                        "text-xs sm:text-sm block leading-snug transition-colors duration-200",
                                        isActive ? "font-black text-zinc-950" : "font-semibold text-zinc-200 group-hover:text-white"
                                    )}>
                                        {pillar.label}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] block mt-0.5 font-normal truncate transition-colors duration-200",
                                        isActive ? "text-zinc-700 font-medium" : "text-zinc-500 group-hover:text-zinc-400"
                                    )}>
                                        {pillar.desc}
                                    </span>
                                </div>
                            </motion.button>
                        )
                    })}
                </div>
            </nav>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Content header */}
                <header className="shrink-0 px-6 sm:px-8 lg:px-10 pt-5 md:pt-20 pb-5 border-b border-white/[0.06] sectionbar sectionbar-minimal">
                    <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-center">
                            {React.createElement(activePillar.icon, { className: "h-3.5 w-3.5 text-brand-accent" })}
                        </div>
                        <span className="text-label-sm uppercase tracking-widest text-on-surface-variant font-mono">
                            {activePillar.shortLabel}
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-display tracking-wider text-on-surface leading-tight uppercase">
                        {activePillar.label}
                    </h2>
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
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
                                        transition={tabContentSpring}
                                    >
                                        {activeTab === "appearance"  && <AppearanceTab control={control} />}
                                        {activeTab === "playback"    && <PlaybackTab control={control} />}
                                        {activeTab === "library"     && <LibraryTab control={control} />}
                                        {activeTab === "performance" && <PerformanceTab control={control} />}
                                        {activeTab === "system"      && <SystemTab control={control} />}
                                    </motion.div>
                                </AnimatePresence>
                            </Suspense>
                        </form>
                    </FormProvider>
                </div>
            </main>

            {/* ── Floating Save Bar ────────────────────────────────────────────── */}
            <AnimatePresence>
                {isDirty && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 50, x: "-50%" }}
                        transition={saveBarSpring}
                        className={cn(
                            "fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50",
                            "flex items-center gap-4 sm:gap-6",
                            "sectionbar sectionbar-strong rounded-full px-5 py-2.5",
                            "max-w-[calc(100vw-2rem)] w-max"
                        )}
                    >
                        <div className="flex items-center gap-2.5 pl-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]" />
                            </span>
                            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                                Cambios pendientes
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => reset()}
                                className="text-xs font-semibold text-zinc-400 hover:text-white transition-all px-3.5 py-1.5 rounded-full hover:bg-white/10 active:scale-95 cursor-pointer"
                            >
                                Descartar
                            </button>
                            <button
                                type="submit"
                                form="settings-form"
                                disabled={isSaving}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2 rounded-full text-xs font-black transition-all duration-200 select-none cursor-pointer uppercase tracking-wider",
                                    "bg-white text-zinc-950 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]",
                                    "hover:bg-zinc-100 hover:scale-102 active:scale-95 disabled:opacity-50"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <span>Guardar Ajustes</span>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
