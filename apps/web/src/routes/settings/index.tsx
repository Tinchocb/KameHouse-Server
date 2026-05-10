import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { useForm, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"

import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import {
    LucideSave, LucideRefreshCw, LucideHardDrive, LucideSettings, LucideRadar, LucideCrown, LucideCloud, LucidePlay
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

// Import extracted tabs
import { LibraryTab } from "./tabs/library-tab"
import { PlayerTab } from "./tabs/player-tab"
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

type SettingsFormValues = z.infer<typeof settingsSchema>

export const Route = createFileRoute("/settings/")({
    component: SettingsPage,
})

const NAV_ITEMS = [
    { id: "library", label: "Biblioteca", icon: LucideRadar },
    { id: "player", label: "Reproductor", icon: LucidePlay },
    { id: "integrations", label: "Integraciones", icon: LucideCloud },
    { id: "system", label: "Sistema", icon: LucideSettings },
]

function TabsTriggerActiveIndicator() {
    return (
         <motion.div 
            layoutId="active-nav-bg"
            className="absolute inset-0 bg-white/10 rounded-none -z-10 border border-white/20"
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
        />
    )
}

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const { mutate: scanFiles, isPending: isScanning } = useScanLocalFiles()

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

    const handleScan = (_full: boolean) => {
        scanFiles({
            enhanced: true,
            enhanceWithOfflineDatabase: true,
            skipLockedFiles: false,
            skipIgnoredFiles: true,
        })
    }

    if (isLoading) return <LoadingOverlayWithLogo />

    return (
        <div className="flex h-full w-full bg-black/40 backdrop-blur-3xl overflow-hidden selection:bg-primary/30">
            <header className="fixed top-0 left-0 lg:left-24 right-0 h-16 border-b border-white/[0.03] bg-black/50 backdrop-blur-md z-40 flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center p-1.5 shadow-lg">
                        <LucideHardDrive className="text-black" size={18} />
                    </div>
                    <span className="text-sm font-black tracking-widest uppercase text-white/90 font-bebas">KameHouse <span className="text-zinc-500">Ajustes</span></span>
                </div>
            </header>

            <Tabs defaultValue="library" className="flex-1 flex h-full pt-16 relative">
                <aside className="w-[320px] h-full border-r border-white/[0.03] bg-black/30 flex flex-col p-8 space-y-10 z-10 overflow-y-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="space-y-4 mt-4 relative z-10">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Panel de Control</p>
                        <TabsList className="bg-transparent border-0 flex flex-col items-stretch h-auto p-0 gap-2">
                            {NAV_ITEMS.map((item) => (
                                <TabsTrigger
                                    key={item.id}
                                    value={item.id}
                                    className={cn(
                                        "relative flex items-center justify-start gap-5 px-5 py-4 rounded-none text-[15px] font-black text-zinc-500",
                                        "transition-all duration-500 group/nav outline-none hover:bg-white/[0.03] hover:text-zinc-300",
                                        "data-[state=active]:bg-white/[0.04] data-[state=active]:text-white data-[state=active]:border-white/10 border border-transparent"
                                    )}
                                >
                                    <item.icon size={22} className="shrink-0 transition-transform duration-500 group-hover/nav:scale-110 group-hover/nav:text-white data-[state=active]:text-white" />
                                    <span className="relative z-10 tracking-tight">{item.label}</span>
                                    <TabsTriggerActiveIndicator />
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="pt-8 space-y-5 border-t border-white/[0.03] mt-auto relative z-10">
                        <div className="glass-panel-premium mx-1 p-6 rounded-none bg-white/[0.02] border border-white/5 relative overflow-hidden group/premium">
                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/premium:opacity-40 transition-all duration-700 ease-spring group-hover/premium:scale-110 group-hover/premium:rotate-12">
                                <LucideCrown size={48} className="text-white" />
                            </div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">KameHouse Engine</p>
                            <p className="text-[12px] text-white mt-1 font-bebas">ALPHA VERSION 3.5.0</p>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 h-full overflow-y-auto bg-black/10 scrollbar-hide py-8 px-8">
                    <form onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)} className="w-full pb-48">
                        <LibraryTab isScanning={isScanning} handleScan={handleScan} control={control} />
                        <PlayerTab control={control} />
                        <IntegrationsTab />
                        <SystemTab />
                    </form>
                </main>

                <AnimatePresence>
                    {isDirty && (
                         <motion.div
                            initial={{ opacity: 0, y: 60 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 120 }}
                            className="fixed bottom-12 right-12 z-50"
                        >
                            <div className="bg-white text-black p-1 pl-8 rounded-none shadow-[20px_20px_0px_0px_rgba(255,255,255,0.1)] flex items-center gap-8 min-w-[400px]">
                                <span className="text-xs font-black uppercase tracking-widest text-black/40">Cambios pendientes</span>
                                <div className="flex gap-1 ml-auto">
                                    <button
                                        onClick={() => reset()}
                                        className="px-8 py-4 text-xs font-black uppercase tracking-widest hover:bg-black/5 transition-colors"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        disabled={isSaving}
                                        onClick={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                                        className="bg-black text-white px-10 py-4 text-xs font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-3 transition-all"
                                    >
                                        {isSaving ? <LucideRefreshCw className="animate-spin" size={16} /> : <LucideSave size={16} />}
                                        {isSaving ? "Guardando..." : "Aplicar Ajustes"}
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
