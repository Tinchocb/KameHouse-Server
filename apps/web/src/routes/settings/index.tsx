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
    { id: "player",       label: "Reproducción", sublabel: "MULTIMEDIA",       icon: LucidePlay },
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

    if (isLoading && !serverSettings) return <LoadingOverlayWithLogo />

    return (
        <div className="flex h-full w-full bg-[#06080d] text-white selection:bg-brand-orange/20 overflow-hidden relative">

            {/* CRT scanlines overlay — matches Series page */}
            <div className="absolute inset-0 pointer-events-none z-[49] opacity-[0.012] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />

            {/* Global ambient glow behind active tab */}
            <div className="absolute top-0 left-[280px] right-0 h-[300px] pointer-events-none z-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(235,94,40,0.06),transparent_60%)]" />
            </div>

            {/* ── Topbar ─────────────────────────────────────────────────────── */}
            <header className="fixed top-0 left-0 lg:left-24 right-0 h-14 border-b border-white/[0.04] bg-[#06080d]/90 backdrop-blur-xl z-40 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    {/* Icon badge */}
                    <div className="w-7 h-7 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center shadow-[0_0_12px_rgba(235,94,40,0.15)]">
                        <LucideHardDrive className="text-brand-orange" size={13} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/60 font-mono">KAMEHOUSE</span>
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-brand-orange font-mono">AJUSTES</span>
                    </div>
                </div>

                {/* Version pill */}
                <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/[0.05] rounded-full">
                    <LucideCrown size={10} className="text-brand-orange/60" />
                    <span className="text-[9px] font-black tracking-[0.2em] text-zinc-500 font-mono uppercase">ALPHA 3.5.0</span>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex h-full pt-14 relative">

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <aside className="w-[260px] h-full border-r border-white/[0.04] bg-[#0a0c10]/80 backdrop-blur-2xl flex flex-col z-10 overflow-hidden relative shrink-0">

                    {/* Subtle side texture */}
                    <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:4px_4px] opacity-[0.12] pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-brand-orange/10 to-transparent pointer-events-none" />

                    <div className="flex flex-col h-full relative z-10 py-8 px-4 space-y-1">

                        {/* Section label */}
                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-zinc-700 px-3 mb-4 font-mono">
                            — CONFIGURACIÓN —
                        </p>

                        <TabsList className="bg-transparent border-0 flex flex-col items-stretch h-auto p-0 gap-0.5">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activeTab === item.id
                                return (
                                    <TabsTrigger
                                        key={item.id}
                                        value={item.id}
                                        className={cn(
                                            "relative flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition-all duration-200 group/nav outline-none border",
                                            isActive
                                                ? "text-white border-brand-orange/10 bg-brand-orange/[0.06]"
                                                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.025]"
                                        )}
                                    >
                                        {/* Left accent bar */}
                                        <div className={cn(
                                            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300",
                                            isActive
                                                ? "h-8 bg-brand-orange shadow-[0_0_10px_rgba(235,94,40,0.7)]"
                                                : "h-0"
                                        )} />

                                        {/* Icon */}
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200",
                                            isActive
                                                ? "bg-brand-orange/10 border-brand-orange/25 text-brand-orange"
                                                : "bg-white/[0.02] border-white/[0.04] text-zinc-600 group-hover/nav:text-zinc-400 group-hover/nav:border-white/[0.07]"
                                        )}>
                                            <item.icon size={14} />
                                        </div>

                                        {/* Text */}
                                        <div className="flex flex-col min-w-0">
                                            <span className={cn(
                                                "text-xs font-bold tracking-tight leading-none transition-colors",
                                                isActive ? "text-white" : "text-zinc-400 group-hover/nav:text-zinc-200"
                                            )}>
                                                {item.label}
                                            </span>
                                            <span className="text-[8px] font-black tracking-[0.2em] text-zinc-700 mt-0.5 font-mono leading-none">
                                                {item.sublabel}
                                            </span>
                                        </div>

                                        {/* Active glow */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-glow"
                                                className="absolute inset-0 rounded-xl bg-brand-orange/[0.03] -z-10"
                                                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                            />
                                        )}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Bottom: divider + info */}
                        <div className="border-t border-white/[0.04] pt-5 space-y-3 mx-1">
                            {/* VHS-style info panel */}
                            <div className="relative rounded-xl border border-white/[0.05] bg-black/40 p-4 overflow-hidden group/info">
                                <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:3px_3px] opacity-20 pointer-events-none" />
                                <div className="absolute inset-0 opacity-0 group-hover/info:opacity-100 transition-opacity duration-700 bg-[radial-gradient(ellipse_at_bottom_right,rgba(235,94,40,0.04),transparent_70%)] pointer-events-none" />

                                <p className="text-[7px] text-zinc-700 uppercase tracking-[0.3em] font-black font-mono relative z-10">KAME-ENGINE</p>
                                <p className="text-[10px] font-black text-white/40 font-mono mt-0.5 relative z-10 tracking-wider">SYS · HG · T-128</p>

                                {/* Barcode SVG */}
                                <svg className="mt-3 w-full h-3 text-zinc-800 relative z-10" viewBox="0 0 200 20" fill="currentColor">
                                    <rect x="0"   y="0" width="3"  height="20" />
                                    <rect x="6"   y="0" width="1"  height="20" />
                                    <rect x="10"  y="0" width="4"  height="20" />
                                    <rect x="17"  y="0" width="2"  height="20" />
                                    <rect x="22"  y="0" width="1"  height="20" />
                                    <rect x="26"  y="0" width="3"  height="20" />
                                    <rect x="32"  y="0" width="2"  height="20" />
                                    <rect x="37"  y="0" width="1"  height="20" />
                                    <rect x="41"  y="0" width="5"  height="20" />
                                    <rect x="49"  y="0" width="1"  height="20" />
                                    <rect x="53"  y="0" width="2"  height="20" />
                                    <rect x="58"  y="0" width="3"  height="20" />
                                    <rect x="64"  y="0" width="1"  height="20" />
                                    <rect x="68"  y="0" width="4"  height="20" />
                                    <rect x="75"  y="0" width="2"  height="20" />
                                    <rect x="80"  y="0" width="1"  height="20" />
                                    <rect x="84"  y="0" width="3"  height="20" />
                                    <rect x="90"  y="0" width="2"  height="20" />
                                    <rect x="95"  y="0" width="5"  height="20" />
                                    <rect x="103" y="0" width="1"  height="20" />
                                    <rect x="107" y="0" width="3"  height="20" />
                                    <rect x="113" y="0" width="2"  height="20" />
                                    <rect x="118" y="0" width="4"  height="20" />
                                    <rect x="125" y="0" width="1"  height="20" />
                                    <rect x="129" y="0" width="5"  height="20" />
                                    <rect x="137" y="0" width="2"  height="20" />
                                    <rect x="142" y="0" width="1"  height="20" />
                                    <rect x="146" y="0" width="3"  height="20" />
                                    <rect x="152" y="0" width="2"  height="20" />
                                    <rect x="157" y="0" width="4"  height="20" />
                                    <rect x="164" y="0" width="1"  height="20" />
                                    <rect x="168" y="0" width="3"  height="20" />
                                    <rect x="174" y="0" width="2"  height="20" />
                                    <rect x="179" y="0" width="5"  height="20" />
                                    <rect x="187" y="0" width="1"  height="20" />
                                    <rect x="191" y="0" width="3"  height="20" />
                                    <rect x="196" y="0" width="4"  height="20" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ── Main content ─────────────────────────────────────────── */}
                <main className="flex-1 h-full overflow-y-auto scrollbar-hide relative">
                    {/* Subtle top vignette */}
                    <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#06080d] to-transparent z-20 pointer-events-none" />

                    <form
                        onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                        className="w-full px-10 pb-36 max-w-5xl -mt-8"
                    >
                        {activeTab === "library"      && <LibraryTab control={control} />}
                        {activeTab === "player"       && <PlayerTab control={control} />}
                        {activeTab === "scanner"      && <ScannerTab control={control} />}
                        {activeTab === "integrations" && <IntegrationsTab control={control} />}
                        {activeTab === "system"       && <SystemTab control={control} />}
                    </form>
                </main>

                {/* ── Floating Save Bar ────────────────────────────────────── */}
                <AnimatePresence>
                    {isDirty && (
                        <motion.div
                            initial={{ opacity: 0, y: 40, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 40, x: "-50%" }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="fixed bottom-7 left-[calc(50%_+_130px)] -translate-x-1/2 z-50"
                        >
                            <div className="relative bg-[#0c0e12]/95 border border-white/[0.08] backdrop-blur-xl px-5 py-3 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] flex items-center gap-8 overflow-hidden">
                                {/* Scanline micro-texture on bar */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_3px]" />
                                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_left,rgba(235,94,40,0.06),transparent_60%)]" />

                                <div className="flex items-center gap-2.5 relative z-10">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
                                    </span>
                                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-400 font-mono">Cambios sin guardar</span>
                                </div>

                                <div className="flex gap-2 relative z-10">
                                    <button
                                        type="button"
                                        onClick={() => reset()}
                                        className="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all active:scale-95 font-mono"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                                        className="bg-brand-orange text-black hover:bg-brand-orange/90 px-5 py-2 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 shadow-[0_4px_20px_rgba(235,94,40,0.3)] font-mono"
                                    >
                                        {isSaving ? <LucideRefreshCw className="animate-spin" size={11} /> : <LucideSave size={11} />}
                                        {isSaving ? "Guardando..." : "Guardar"}
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
