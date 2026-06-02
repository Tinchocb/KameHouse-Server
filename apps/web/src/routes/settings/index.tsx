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
    { id: "library",      label: "Biblioteca",   sublabel: "ALMACENAMIENTO",  icon: LucideRadar },
    { id: "scanner",      label: "Escáner",      sublabel: "INDEXACIÓN",       icon: LucideRefreshCw },
    { id: "integrations", label: "Integraciones",sublabel: "SERVICIOS EXT.",   icon: LucideCloud },
    { id: "system",       label: "Sistema",      sublabel: "PLATAFORMA",       icon: LucideSettings },
]

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [activeTab, setActiveTab] = useState<string>("library")

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
        <div className="flex flex-col h-full w-full pt-12 md:pt-20 px-6 md:px-12 lg:px-16 bg-zinc-950 text-white selection:bg-brand-orange/30 overflow-y-auto">
            <div className="w-full flex flex-col min-h-full">
                <header className="mb-10 flex flex-col gap-2 relative z-10">
                    <h1 className="font-bebas text-5xl md:text-6xl tracking-wider text-white">Configuración</h1>
                    <p className="text-sm text-zinc-400">Gestiona las preferencias y el comportamiento del servidor KameHouse.</p>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col md:flex-row gap-8 lg:gap-12 pb-32">
                    {/* ── Lightweight Sidebar Nav ─────────────────────────────── */}
                    <aside className="w-full md:w-56 shrink-0 md:border-r md:border-white/5 md:pr-6">
                        <TabsList className="bg-transparent border-0 flex flex-col items-stretch h-auto p-0 gap-1">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activeTab === item.id
                                return (
                                    <TabsTrigger
                                        key={item.id}
                                        value={item.id}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left font-medium text-xs transition-all relative group outline-none",
                                            isActive 
                                                ? "text-brand-orange bg-brand-orange/[0.06] border border-brand-orange/10" 
                                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02] border border-transparent"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-4 h-4 relative z-10 transition-colors", 
                                            isActive ? "text-brand-orange" : "text-zinc-400 group-hover:text-zinc-300"
                                        )} />
                                        <span className="relative z-10 font-semibold">{item.label}</span>
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
                                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 bg-zinc-900/90 border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] rounded-xl px-6 py-3 backdrop-blur-md"
                            >
                                <div className="flex items-center gap-3 pl-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">Cambios sin guardar</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => reset()}
                                        className="text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        form="settings-form"
                                        disabled={isSaving}
                                        className="bg-brand-orange hover:bg-brand-orange/95 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,110,58,0.25)] disabled:opacity-50"
                                    >
                                        {isSaving ? "Guardando..." : "Guardar cambios"}
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
