import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm, FormProvider, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { GlassCard, GlassButton } from "@/components/ui"

import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import {
    LucideHardDrive, LucideSettings, LucideRadar, LucideCloud, LucidePlay, LucideTv, LucidePalette
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

// Import extracted tabs
import { LibraryTab } from "./tabs/library-tab"
import { ScannerTab } from "./tabs/scanner-tab"
import { IntegrationsTab } from "./tabs/integrations-tab"
import { SystemTab } from "./tabs/system-tab"
import { PlayerTab } from "./tabs/player-tab"
import { StreamingTab } from "./tabs/streaming-tab"
import { AppearanceTab } from "./tabs/appearance-tab"

// ─── Schema ───────────────────────────────────────────────────────────────────
// Matches backend Models_Settings exactly

const settingsSchema = z.object({
    library: z.object({
        seriesPaths: z.array(z.string()).nullish().transform(v => v ?? []),
        moviePaths: z.array(z.string()).nullish().transform(v => v ?? []),
        autoUpdateProgress: z.boolean().default(false),
        autoScan: z.boolean().default(false),
        enableOnlinestream: z.boolean().default(false),
        includeOnlineStreamingInLibrary: z.boolean().default(false),
        disableAnimeCardTrailers: z.boolean().default(false),
        dohProvider: z.string().default(""),
        openWebURLOnStart: z.boolean().default(false),
        refreshLibraryOnStart: z.boolean().default(false),
        autoPlayNextEpisode: z.boolean().default(true),
        enableWatchContinuity: z.boolean().default(false),
        autoSyncOfflineLocalData: z.boolean().default(false),
        scannerMatchingThreshold: z.number().default(0),
        scannerMatchingAlgorithm: z.string().default(""),
        autoSyncToLocalAccount: z.boolean().default(false),
        autoSaveCurrentMediaOffline: z.boolean().default(false),
        useFallbackMetadataProvider: z.boolean().default(false),
        tmdbApiKey: z.string().default(""),
        tmdbLanguage: z.string().default("es-MX"),
        scannerUseLegacyMatching: z.boolean().default(false),
        scannerConfig: z.string().default(""),
        scannerStrictStructure: z.boolean().default(false),
        scannerProvider: z.string().default(""),
        disableLocalScanning: z.boolean().default(false),
        disableDebridService: z.boolean().default(false),
        primaryMetadataProvider: z.string().default("tmdb"),
        fanartApiKey: z.string().default(""),
        omdbApiKey: z.string().default(""),
        openSubsApiKey: z.string().default(""),
        lastScanAt: z.string().optional(),
    }).default({}),
    mediaPlayer: z.object({
        defaultPlayer: z.string().default(""),
        host: z.string().default(""),
        vlcUsername: z.string().default(""),
        vlcPassword: z.string().default(""),
        vlcPort: z.number().default(0),
        vlcPath: z.string().default(""),
        mpcPort: z.number().default(0),
        mpcPath: z.string().default(""),
        mpvSocket: z.string().default(""),
        mpvPath: z.string().default(""),
        mpvArgs: z.string().default(""),
        iinaSocket: z.string().default(""),
        iinaPath: z.string().default(""),
        iinaArgs: z.string().default(""),
        vcTranslate: z.boolean().default(false),
        vcTranslateTargetLanguage: z.string().default(""),
        vcTranslateProvider: z.string().default(""),
        vcTranslateApiKey: z.string().default(""),
    }).default({}),
    mediastream: z.object({
        transcodeEnabled: z.boolean().default(false),
        transcodeHwAccel: z.string().default(""),
        transcodeThreads: z.number().default(0),
        transcodePreset: z.string().default(""),
        disableAutoSwitchToDirectPlay: z.boolean().default(false),
        directPlayOnly: z.boolean().default(false),
        preTranscodeEnabled: z.boolean().default(false),
        preTranscodeLibraryDir: z.string().default(""),
        transcodeHwAccelCustomSettings: z.string().default(""),
        ffmpegPath: z.string().default(""),
        ffprobePath: z.string().default(""),
    }).default({}),
    theme: z.object({
        enableColorSettings: z.boolean().default(false),
        backgroundColor: z.string().default("#070707"),
        accentColor: z.string().default("#ff6e3a"),
        sidebarBackgroundColor: z.string().default(""),
        homeItems: z.array(z.string()).default([]),
        themeAnimeEntryScreenLayout: z.string().default(""),
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
        themeUseLegacyEpisodeCard: z.boolean().default(false),
        themeDisableCarouselAutoScroll: z.boolean().default(false),
        themeMediaPageBannerType: z.string().default("default"),
        themeMediaPageBannerSize: z.string().default("default"),
        themeMediaPageBannerInfoBoxSize: z.string().default("default"),
        themeShowEpisodeCardAnimeInfo: z.boolean().default(true),
        themeContinueWatchingDefaultSorting: z.string().default("LAST_WATCHED_DESC"),
        themeAnimeLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),
        themeShowAnimeUnwatchedCount: z.boolean().default(true),
        themeHideEpisodeCardDescription: z.boolean().default(false),
        themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
        themeCustomCSS: z.string().default(""),
        themeMobileCustomCSS: z.string().default(""),
        themeUnpinnedMenuItems: z.array(z.string()).default([]),
        themeEnableBlurringEffects: z.boolean().default(true),
    }).default({}),

    notifications: z.object({
        disableNotifications: z.boolean().default(false),
        disableAutoDownloaderNotifications: z.boolean().default(false),
        disableAutoScannerNotifications: z.boolean().default(false),
    }).default({}),
    Platform: z.object({
        hideAudienceScore: z.boolean().default(false),
        disableCacheLayer: z.boolean().default(false),
    }).default({}),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>

export const Route = createFileRoute("/settings/")(({
    component: SettingsPage,
}))

const NAV_ITEMS = [
    { id: "general",      label: "General",       desc: "Sistema, audio, notificaciones",     icon: LucideSettings },
    { id: "library",      label: "Biblioteca",    desc: "Directorios, rutas de media",        icon: LucideHardDrive },
    { id: "scanner",      label: "Escáner",       desc: "Motor bayesiano, matching",          icon: LucideRadar },
    { id: "player",       label: "Reproductor",   desc: "VLC, MPC, MPV, IINA",                icon: LucidePlay },
    { id: "streaming",    label: "Streaming",     desc: "Transcodificación HLS, GPU",         icon: LucideTv },
    { id: "integrations", label: "Integraciones", desc: "TMDB, Fanart, OMDb",                 icon: LucideCloud },
    { id: "appearance",   label: "Apariencia",    desc: "Temas, colores, layout",             icon: LucidePalette },
]

const SECTION_LABELS: Record<string, string> = {
    general:      "CONFIGURACIÓN DEL SISTEMA",
    library:      "DIRECTORIOS DE BIBLIOTECA",
    player:       "MOTOR DE REPRODUCCIÓN",
    scanner:      "MOTOR ESCÁNER",
    streaming:    "MEDIASTREAM ENGINE",
    integrations: "SERVICIOS EXTERNOS",
    appearance:   "PERSONALIZACIÓN VISUAL",
}

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [activeTab, setActiveTab] = useState<string>("general")
    const [sidebarMousePos, setSidebarMousePos] = useState({ x: 0, y: 0, show: false })

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: (serverSettings || {}) as unknown as SettingsFormValues,
        mode: "onTouched",
    })

    const { control, handleSubmit, formState: { isDirty }, reset } = form

    useEffect(() => {
        if (serverSettings) {
            reset(serverSettings as unknown as SettingsFormValues)
        }
    }, [serverSettings, reset])

    const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
        try {
            await saveSettings(data as unknown as SaveSettings_Variables)
            toast.success("Ajustes guardados con éxito")
            reset(data)
        } catch {
            toast.error("Error al guardar los ajustes")
        }
    }

    const onFormError = (errors: any) => {
        console.error("Form Validation Errors:", errors)
        toast.error("Hay errores de validación en el formulario")
    }

    if (isLoading && !serverSettings) return <LoadingOverlayWithLogo />

    return (
        <div className="flex h-full w-full bg-transparent text-zinc-300 selection:bg-[#ff6e3a]/30 overflow-hidden relative">
            {/* ── Left Sidebar Nav ─────────────────────────────────────── */}
            <nav
                className="relative w-[260px] shrink-0 h-full flex flex-col border-r border-[var(--glass-strong)] bg-[var(--bg-secondary)]/80 backdrop-blur-[var(--blur-navbar)] overflow-y-auto no-scrollbar"
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setSidebarMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true })
                }}
                onMouseLeave={() => setSidebarMousePos(p => ({ ...p, show: false }))}
            >
                {/* Sidebar spotlight */}
                {sidebarMousePos.show && (
                    <div
                        className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-300"
                        style={{
                            background: `radial-gradient(240px circle at ${sidebarMousePos.x}px ${sidebarMousePos.y}px, var(--glow-dbz), transparent 80%)`,
                            opacity: 1,
                        }}
                    />
                )}

                {/* Sidebar header */}
                <div className="relative z-10 px-6 pt-8 pb-6">
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand-secondary)] shadow-[0_0_10px_var(--brand-secondary)] animate-pulse" />
                        <span className="text-[9px] font-black tracking-[0.3em] text-zinc-500 uppercase font-mono">PANEL DE CONTROL</span>
                    </div>
                    <h1 className="font-bebas text-4xl tracking-wider text-white select-none leading-none">
                        AJUSTES
                    </h1>
                    <div className="h-[2px] w-10 bg-gradient-to-r from-[var(--brand-secondary)] to-transparent rounded-full mt-3 shadow-[0_0_10px_var(--glow-dbz)]" />
                </div>

                {/* Nav items */}
                <div className="relative z-10 flex-1 px-3 pb-4 space-y-0.5">
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeTab === item.id
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-[var(--brand-secondary)]/[0.1]"
                                        : "hover:bg-[var(--bg-quaternary)]/50"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 rounded-xl bg-[var(--brand-secondary)]/[0.1] border border-[var(--brand-secondary)]/20 shadow-[0_0_20px_var(--glow-dbz)]"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <div className={cn(
                                    "relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0",
                                    isActive
                                        ? "bg-[var(--brand-secondary)]/20 text-[var(--brand-secondary)] shadow-[0_0_12px_var(--glow-dbz)]"
                                        : "bg-[var(--bg-quaternary)]/60 text-zinc-500 group-hover:text-zinc-300 group-hover:bg-[var(--bg-tertiary)]/60"
                                )}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <div className="relative z-10 flex-1 min-w-0">
                                    <span className={cn(
                                        "text-[11px] font-bold uppercase tracking-wider block transition-colors duration-200",
                                        isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                    )}>
                                        {item.label}
                                    </span>
                                    {item.desc && (
                                        <span className={cn(
                                            "text-[9px] block mt-0.5 font-mono truncate transition-colors duration-200",
                                            isActive ? "text-zinc-500" : "text-zinc-600 group-hover:text-zinc-500"
                                        )}>{item.desc}</span>
                                    )}
                                </div>
                                {isActive && (
                                    <div className="relative z-10 w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)] shadow-[0_0_8px_var(--brand-secondary)] shrink-0" />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Sidebar footer: status */}
                <div className="relative z-10 px-6 py-5 border-t border-[var(--glass-border)]">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                        <span className="text-[9px] font-mono uppercase tracking-wider">Servidor Conectado</span>
                    </div>
                </div>
            </nav>

            {/* ── Main Content Area ────────────────────────────────────── */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Content header */}
                <header className="shrink-0 px-8 md:px-12 lg:px-16 pt-8 pb-6 border-b border-[var(--glass-border)]">
                    <div className="flex items-center gap-2 mb-2">
                        {(() => {
                            const nav = NAV_ITEMS.find(n => n.id === activeTab)
                            if (!nav) return null
                            const Icon = nav.icon
                            return (
                                <>
                                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-secondary)]/10 border border-[var(--brand-secondary)]/20 flex items-center justify-center">
                                        <Icon className="h-4 w-4 text-[var(--brand-secondary)]" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-500 font-mono">
                                        {nav.label}
                                    </span>
                                </>
                            )
                        })()}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bebas tracking-wider text-white leading-none">
                        {SECTION_LABELS[activeTab] || "CONFIGURACIÓN"}
                    </h2>
                    <div className="h-[2px] w-10 bg-gradient-to-r from-[var(--brand-secondary)]/60 to-transparent rounded-full mt-3" />
                </header>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <FormProvider {...form}>
                        <form
                            id="settings-form"
                            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>, onFormError)}
                            className="px-8 md:px-12 lg:px-16 py-8 pb-32 space-y-10 min-h-full"
                        >
                            {activeTab === "general"      && <SystemTab control={control} />}
                            {activeTab === "library"      && <LibraryTab control={control} />}
                            {activeTab === "player"       && <PlayerTab control={control} />}
                            {activeTab === "scanner"      && <ScannerTab control={control} />}
                            {activeTab === "streaming"    && <StreamingTab control={control} />}
                            {activeTab === "integrations" && <IntegrationsTab control={control} />}
                            {activeTab === "appearance"   && <AppearanceTab control={control} />}
                        </form>
                    </FormProvider>
                </div>
            </main>

            {/* ── Floating Save Bar ────────────────────────────────────── */}
            <AnimatePresence>
                {isDirty && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 50, x: "-50%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 bg-[var(--glass-bg)] backdrop-blur-[var(--blur-navbar)] border border-[var(--glass-strong)] rounded-2xl px-6 py-4 shadow-[var(--shadow-elevated)]"
                    >
                        <div className="flex items-center gap-3 pl-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-secondary)] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-secondary)] shadow-[0_0_8px_var(--brand-secondary)]" />
                            </span>
                            <span className="text-[10px] font-black font-mono text-zinc-400 uppercase tracking-widest">Cambios sin guardar</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => reset()}
                                className="text-xs font-bold text-zinc-400 hover:text-white transition-all px-3 py-1.5 hover:bg-[var(--bg-quaternary)]/60 rounded-lg active:scale-95"
                            >
                                Descartar
                            </button>
                            <button
                                type="submit"
                                form="settings-form"
                                disabled={isSaving}
                                className="bg-[var(--brand-secondary)] hover:brightness-110 text-zinc-950 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 disabled:opacity-50 uppercase tracking-widest active:scale-95 shadow-[var(--shadow-brand-secondary)]"
                            >
                                {isSaving ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
