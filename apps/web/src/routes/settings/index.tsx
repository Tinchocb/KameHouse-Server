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
import { PlayerTab } from "./tabs/player-tab"
import { DownloadsTab } from "./tabs/downloads-tab"
import { ScannerTab } from "./tabs/scanner-tab"
import { IntegrationsTab } from "./tabs/integrations-tab"
import { SystemTab } from "./tabs/system-tab"

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

export const Route = createFileRoute("/settings/")({
    component: SettingsPage,
})

const NAV_ITEMS = [
    { id: "library", label: "Biblioteca", icon: LucideRadar },
    { id: "player", label: "Reproducción", icon: LucidePlay },
    { id: "downloads", label: "Descargas", icon: LucideHardDrive },
    { id: "scanner", label: "Escáner", icon: LucideRefreshCw },
    { id: "integrations", label: "Integraciones", icon: LucideCloud },
    { id: "system", label: "Sistema", icon: LucideSettings },
]

function TabsTriggerActiveIndicator() {
    return (
        <motion.div 
            layoutId="active-nav-bg"
            className="absolute inset-y-1.5 inset-x-0 border-l-[3px] border-primary bg-white/[0.02] -z-10 shadow-[inset_1px_0_0_rgba(255,255,255,0.02)]"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
    )
}

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [activeTab, setActiveTab] = useState<string>("library")

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: (serverSettings || {}) as unknown as SettingsFormValues,
        mode: "onChange",
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

    if (isLoading) return <LoadingOverlayWithLogo />

    return (
        <div className="flex h-full w-full bg-gradient-to-br from-[#09090b] via-[#121215] to-[#09090b] text-white selection:bg-primary/20 overflow-hidden relative">
            <header className="fixed top-0 left-0 lg:left-24 right-0 h-16 border-b border-white/[0.02] bg-[#09090b]/85 backdrop-blur-xl z-40 flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center p-1.5 shadow-md">
                        <LucideHardDrive className="text-black" size={14} />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.25em] uppercase text-white/90 font-mono">
                        KAMEHOUSE <span className="text-primary font-bold">AJUSTES</span>
                    </span>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex h-full pt-16 relative">
                <aside className="w-[280px] h-full border-r border-white/[0.02] bg-[#09090b]/40 backdrop-blur-xl flex flex-col p-6 space-y-8 z-10 overflow-y-auto relative pt-10">
                    <div className="space-y-3 relative z-10">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 px-3">Configuración</p>
                        <TabsList className="bg-transparent border-0 flex flex-col items-stretch h-auto p-0 gap-1.5">
                            {NAV_ITEMS.map((item) => (
                                <TabsTrigger
                                    key={item.id}
                                    value={item.id}
                                    className={cn(
                                        "relative flex items-center justify-start gap-4 px-4 py-3 rounded-xl text-sm font-bold text-zinc-500",
                                        "transition-all duration-300 group/nav outline-none hover:text-zinc-300 hover:bg-white/[0.01]",
                                        "data-[state=active]:text-white border border-transparent"
                                    )}
                                >
                                    <item.icon size={18} className="shrink-0 transition-transform duration-300 group-hover/nav:scale-105 group-hover/nav:text-white data-[state=active]:text-white" />
                                    <span className="relative z-10 tracking-tight font-medium">{item.label}</span>
                                    <TabsTriggerActiveIndicator />
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="pt-6 space-y-4 border-t border-white/[0.03] mt-auto relative z-10">
                        <div className="glass-panel-premium mx-1 p-5 rounded-2xl bg-white/[0.01] border border-white/5 relative overflow-hidden group/premium transition-all hover:bg-white/[0.02] hover:border-white/10">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/premium:opacity-20 transition-all duration-700 ease-spring group-hover/premium:scale-110 group-hover/premium:rotate-6">
                                <LucideCrown size={36} className="text-white" />
                            </div>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">KameHouse Engine</p>
                            <p className="text-xs text-white/80 mt-1 font-mono tracking-tight">ALPHA VERSION 3.5.0</p>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 h-full overflow-y-auto bg-black/5 scrollbar-hide py-8 px-10">
                    <form onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)} className="w-full pb-36 max-w-5xl">
                        {activeTab === "library" && <LibraryTab control={control} />}
                        {activeTab === "player" && <PlayerTab control={control} />}
                        {activeTab === "downloads" && <DownloadsTab control={control} />}
                        {activeTab === "scanner" && <ScannerTab />}
                        {activeTab === "integrations" && <IntegrationsTab control={control} />}
                        {activeTab === "system" && <SystemTab control={control} />}
                    </form>
                </main>

                <AnimatePresence>
                    {isDirty && (
                         <motion.div
                            initial={{ opacity: 0, y: 40, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 40, x: "-50%" }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="fixed bottom-8 left-[calc(50%_+_140px)] -translate-x-1/2 z-50"
                        >
                            <div className="bg-[#09090b]/80 border border-white/10 backdrop-blur-md px-6 py-3.5 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(235,94,40,0.05)] flex items-center gap-10 min-w-[480px]">
                                <div className="flex items-center gap-3">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Ajustes Modificados</span>
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => reset()}
                                        className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent transition-all active:scale-95"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                                        className="bg-primary text-black hover:bg-primary/90 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] disabled:opacity-50 flex items-center gap-2 transition-all font-bold active:scale-95 shadow-[0_4px_15px_rgba(235,94,40,0.15)]"
                                    >
                                        {isSaving ? <LucideRefreshCw className="animate-spin" size={12} /> : <LucideSave size={12} />}
                                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Tabs>
        </div>
    )
}
