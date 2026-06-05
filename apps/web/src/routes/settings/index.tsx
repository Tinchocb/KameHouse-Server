import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"

import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import {
    LucideSave, LucideRefreshCw, LucideHardDrive, LucideSettings, LucideRadar, LucideCrown, LucideCloud, LucidePlay
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
    library: z.object({
        seriesPaths: z.array(z.string()).nullish().transform(v => v ?? []),
        moviePaths: z.array(z.string()).nullish().transform(v => v ?? []),
        autoUpdateProgress: z.boolean().default(false),
        torrentProvider: z.string().default(""),
        autoSelectTorrentProvider: z.string().default(""),
        autoScan: z.boolean().default(false),
        enableOnlinestream: z.boolean().default(false),
        includeOnlineStreamingInLibrary: z.boolean().default(false),
        disableAnimeCardTrailers: z.boolean().default(false),
        dohProvider: z.string().default(""),
        openTorrentClientOnStart: z.boolean().default(false),
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
        disableTorrentStreaming: z.boolean().default(false),
        disableTorrentProvider: z.boolean().default(false),
        disableDebridService: z.boolean().default(false),
        primaryMetadataProvider: z.string().default("tmdb"),
        fanartApiKey: z.string().default(""),
        omdbApiKey: z.string().default(""),
        openSubsApiKey: z.string().default(""),
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
        ffmpegPath: z.string().default(""),
        ffprobePath: z.string().default(""),
    }).default({}),
    torrentstream: z.object({
        enabled: z.boolean().default(false),
        autoSelect: z.boolean().default(false),
        preferredResolution: z.string().default(""),
        torrentioUrl: z.string().default(""),
    }).default({}),
    torrent: z.object({
        defaultTorrentClient: z.string().default(""),
        qbittorrentPath: z.string().default(""),
        qbittorrentHost: z.string().default(""),
        qbittorrentPort: z.number().default(0),
        qbittorrentUsername: z.string().default(""),
        qbittorrentPassword: z.string().default(""),
        qbittorrentTags: z.string().default(""),
        qbittorrentCategory: z.string().default(""),
        transmissionPath: z.string().default(""),
        transmissionHost: z.string().default(""),
        transmissionPort: z.number().default(0),
        transmissionUsername: z.string().default(""),
        transmissionPassword: z.string().default(""),
        showActiveTorrentCount: z.boolean().default(false),
        hideTorrentList: z.boolean().default(false),
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
    { id: "system",       label: "Configuración",  icon: LucideSettings },
    { id: "library",      label: "Archivos",      icon: LucideHardDrive },
    { id: "player",       label: "Reproductor", icon: LucidePlay },
    { id: "scanner",      label: "Escáner",   icon: LucideRadar },
    { id: "integrations", label: "Integraciones",  icon: LucideCloud },
]

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [activeTab, setActiveTab] = useState<string>("system")
    const [sidebarSpotlight, setSidebarSpotlight] = useState<React.CSSProperties>({
        opacity: 0,
    })

    const handleSidebarMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setSidebarSpotlight({
            opacity: 1,
            background: `radial-gradient(180px circle at ${x}px ${y}px, rgba(255, 110, 58, 0.08), transparent 80%)`,
        })
    }

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: (serverSettings || {}) as unknown as SettingsFormValues,
        mode: "onTouched",
    })

    const { control, handleSubmit, register, formState: { isDirty }, reset } = form

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

    if (isLoading && !serverSettings) return <LoadingOverlayWithLogo />

    return (
        <div className="flex flex-col h-full w-full pt-12 md:pt-20 px-6 md:px-12 lg:px-16 bg-[#050506] text-zinc-300 selection:bg-[#ff6e3a]/30 overflow-y-auto relative">
            <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-[#ff6e3a]/5 rounded-full blur-[200px] -translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="w-full flex flex-col min-h-full relative z-10">
                <header className="mb-10 flex flex-col gap-2 relative z-10">
                    <h1 className="font-bebas text-5xl md:text-6xl tracking-wider text-white">Configuración</h1>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col md:flex-row gap-8 lg:gap-12 pb-32">
                    {/* ── Immersive Sidebar Nav ─────────────────────────────── */}
                    <aside 
                        onMouseMove={handleSidebarMouseMove}
                        onMouseLeave={() => setSidebarSpotlight({ opacity: 0 })}
                        className="w-full md:w-64 shrink-0 bg-white/[0.01] border border-white/5 backdrop-blur-[64px] rounded-3xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] h-fit relative overflow-hidden"
                    >
                        {/* Cursor spotlight overlay */}
                        <div 
                            className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-300"
                            style={sidebarSpotlight}
                        />

                        <TabsList className="bg-transparent border-0 flex flex-col items-stretch h-auto p-0 gap-1.5 relative z-10">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activeTab === item.id
                                return (
                                    <TabsTrigger
                                        key={item.id}
                                        value={item.id}
                                        className={cn(
                                            "w-full flex items-center justify-start gap-3.5 px-4 py-3 rounded-xl text-left font-bold text-xs uppercase tracking-wider transition-all duration-300 relative group outline-none border border-transparent settings-nav-btn select-none",
                                            isActive 
                                                ? "active bg-gradient-to-r from-[#ff6e3a]/12 to-[#ff6e3a]/3 border-[#ff6e3a]/15 border-l-[3px] border-l-[#ff6e3a] text-[#ff6e3a] shadow-[0_4px_12px_rgba(255,110,58,0.04)] data-[state=active]:border-y-[#ff6e3a]/15 data-[state=active]:border-r-[#ff6e3a]/15 data-[state=active]:border-l-[#ff6e3a] data-[state=active]:text-[#ff6e3a]" 
                                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] hover:-translate-x-0.5"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-4 h-4 relative z-10 transition-colors", 
                                            isActive ? "text-[#ff6e3a]" : "text-zinc-500 group-hover:text-zinc-350"
                                        )} />
                                        <div className="flex flex-col text-left">
                                            <span className="relative z-10 leading-none">{item.label}</span>
                                        </div>
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </aside>

                    {/* ── Main content ─────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 md:pl-4">
                        <form
                            id="settings-form"
                            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                            className="w-full relative z-10"
                        >
                            {activeTab === "library"      && <LibraryTab control={control} />}
                            {activeTab === "scanner"      && <ScannerTab control={control} register={register} />}
                            {activeTab === "integrations" && <IntegrationsTab control={control} register={register} />}
                            {activeTab === "system"       && <SystemTab control={control} />}
                            {activeTab === "player"       && <PlayerTab control={control} />}
                        </form>
                    </div>

                    {/* ── Floating Save Bar ────────────────────────────────────── */}
                    <AnimatePresence>
                        {isDirty && (
                            <motion.div
                                initial={{ opacity: 0, y: 40, x: "-50%" }}
                                animate={{ opacity: 1, y: 0, x: "-50%" }}
                                exit={{ opacity: 0, y: 40, x: "-50%" }}
                                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 bg-[#050506]/90 border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-xl px-6 py-4.5 backdrop-blur-[32px]"
                            >
                                <div className="flex items-center gap-3 pl-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff6e3a] opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff6e3a] shadow-[0_0_6px_#ff6e3a]"></span>
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-widest font-bold">Cambios locales detectados</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => reset()}
                                        className="text-xs font-bold text-zinc-400 hover:text-white transition-colors mr-2"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        form="settings-form"
                                        disabled={isSaving}
                                        className="bg-[#ff6e3a] hover:bg-[#ff7d4b] text-zinc-950 px-6 py-3 rounded-xl text-xs font-bold transition-all duration-300 disabled:opacity-50 font-black uppercase tracking-wider active:scale-95 shadow-lg shadow-orange-500/10"
                                    >
                                        {isSaving ? "Guardando..." : "Guardar Configuración"}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Tabs>
            </div>
        </div>
    )
}
