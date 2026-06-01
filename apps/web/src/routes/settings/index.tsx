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
        <div className="flex h-full w-full bg-black text-white selection:bg-cyan-500/30 overflow-hidden relative font-sans">
            <style dangerouslySetInnerHTML={{ __html: `
                .cc-grid-overlay {
                    position: absolute;
                    inset: 0;
                    background-image: 
                        linear-gradient(rgba(6, 182, 212, 0.015) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(6, 182, 212, 0.015) 1px, transparent 1px);
                    background-size: 40px 40px;
                    pointer-events: none;
                    z-index: 1;
                }
                .ambient-glow {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(180px);
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.35;
                    animation: float-glow 15s infinite alternate ease-in-out;
                }
                @keyframes float-glow {
                    0% { transform: scale(1) translate(0px, 0px); }
                    100% { transform: scale(1.15) translate(40px, -50px); }
                }
                .glass-panel {
                    background: rgba(10, 11, 14, 0.3) !important;
                    backdrop-filter: blur(100px) saturate(160%) !important;
                    -webkit-backdrop-filter: blur(100px) saturate(160%) !important;
                    border: 1px solid rgba(6, 182, 212, 0.05) !important;
                    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.01), 0 25px 60px rgba(0, 0, 0, 0.8) !important;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }
                .glass-panel:hover {
                    background: rgba(14, 16, 22, 0.4) !important;
                    border-color: rgba(6, 182, 212, 0.25) !important;
                    box-shadow: inset 0 1px 2px rgba(6, 182, 212, 0.1), 0 30px 60px rgba(6, 182, 212, 0.03) !important;
                }
            ` }} />

            {/* CRT scanlines overlay */}
            <div className="absolute inset-0 pointer-events-none z-[49] opacity-[0.012] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />

            {/* Blueprint grid overlay */}
            <div className="cc-grid-overlay" />

            {/* Ambient glows */}
            <div className="ambient-glow bg-cyan-500/20 w-[900px] h-[600px] top-[-20%] left-[-15%]" />
            <div className="ambient-glow bg-orange-600/15 w-[800px] h-[800px] top-[25%] right-[-15%]" style={{ animationDelay: "-4s" }} />
            <div className="ambient-glow bg-zinc-800/40 w-[1000px] h-[600px] bottom-[-15%] left-[10%]" style={{ animationDelay: "-8s" }} />

            {/* ── Topbar ─────────────────────────────────────────────────────── */}
            <header className="fixed top-0 left-0 lg:left-24 right-0 h-14 border-b border-white/[0.04] bg-[#000000]/80 backdrop-blur-xl z-40 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    {/* CC Logo badge */}
                    <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center font-black text-xs tracking-tighter shrink-0 select-none bg-zinc-950 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                        <span className="text-white">C</span><span className="text-cyan-400 -ml-0.5">C</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[9px] font-black tracking-[0.3em] uppercase text-white/50 font-mono">CAPSULE CORP</span>
                        <span className="text-[9px] font-black tracking-[0.3em] uppercase text-cyan-400 font-mono">CONTROL PANEL</span>
                    </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-3">
                    <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase bg-zinc-950/80 px-2.5 py-1 rounded border border-white/5">SYS_STATUS: NOMINAL</span>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex h-full pt-14 relative z-10">

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <aside className="w-[260px] h-full border-r border-white/[0.04] bg-zinc-950/40 backdrop-blur-2xl flex flex-col z-10 overflow-hidden relative shrink-0">
                    <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:4px_4px] opacity-[0.12] pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none" />

                    <div className="flex flex-col h-full relative z-10 py-8 px-4 space-y-1">
                        <p className="text-[8px] font-mono font-black uppercase tracking-[0.35em] text-zinc-600 px-3 mb-4">
                            — CAPSULE MODULES —
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
                                                ? "text-white border-cyan-500/10 bg-cyan-500/10"
                                                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.025]"
                                        )}
                                    >
                                        {/* Left accent bar */}
                                        <div className={cn(
                                            "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r-full transition-all duration-300",
                                            isActive
                                                ? "h-8 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.7)]"
                                                : "h-0"
                                        )} />

                                        {/* Icon */}
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200",
                                            isActive
                                                ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
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
                                            <span className="text-[8px] font-black tracking-[0.2em] text-zinc-600 mt-0.5 font-mono leading-none">
                                                {item.sublabel}
                                            </span>
                                        </div>

                                        {/* Active glow */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-glow"
                                                className="absolute inset-0 rounded-xl bg-cyan-500/[0.03] -z-10"
                                                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                            />
                                        )}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>

                        <div className="flex-1" />

                        {/* Bottom Barcode */}
                        <div className="border-t border-white/[0.04] pt-5 space-y-3 mx-1">
                            <div className="relative rounded-xl border border-white/[0.05] bg-black/40 p-4 overflow-hidden group/info">
                                <p className="text-[7px] text-zinc-600 uppercase tracking-[0.3em] font-black font-mono">CC_OS_SYS_LINK</p>
                                <p className="text-[10px] font-black text-white/30 font-mono mt-0.5 tracking-wider">CC-908_OS // ENG</p>
                                <svg className="mt-3 w-full h-3 text-zinc-800" viewBox="0 0 200 20" fill="currentColor">
                                    <rect x="0"   y="0" width="3"  height="20" />
                                    <rect x="6"   y="0" width="1"  height="20" />
                                    <rect x="10"  y="0" width="4"  height="20" />
                                    <rect x="17"  y="0" width="2"  height="20" />
                                    <rect x="22"  y="0" width="1"  height="20" />
                                    <rect x="26"  y="0" width="3"  height="20" />
                                    <rect x="32"  y="0" width="2"  height="20" />
                                    <rect x="41"  y="0" width="5"  height="20" />
                                    <rect x="49"  y="0" width="1"  height="20" />
                                    <rect x="58"  y="0" width="3"  height="20" />
                                    <rect x="68"  y="0" width="4"  height="20" />
                                    <rect x="80"  y="0" width="1"  height="20" />
                                    <rect x="84"  y="0" width="3"  height="20" />
                                    <rect x="95"  y="0" width="5"  height="20" />
                                    <rect x="107" y="0" width="3"  height="20" />
                                    <rect x="118" y="0" width="4"  height="20" />
                                    <rect x="129" y="0" width="5"  height="20" />
                                    <rect x="142" y="0" width="1"  height="20" />
                                    <rect x="157" y="0" width="4"  height="20" />
                                    <rect x="168" y="0" width="3"  height="20" />
                                    <rect x="179" y="0" width="5"  height="20" />
                                    <rect x="191" y="0" width="3"  height="20" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ── Main content ─────────────────────────────────────────── */}
                <main className="flex-1 h-full overflow-y-auto scrollbar-hide relative px-10 pb-36 max-w-5xl">
                    <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent z-20 pointer-events-none" />

                    {/* Epic Capsule Corp Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8 pt-8 mb-10 relative z-10">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 text-[9px] font-mono tracking-[0.4em] text-cyan-400 uppercase">
                                <span>Capsule Corp. Engineering Division</span>
                                <span className="text-zinc-700">//</span>
                                <span className="text-zinc-500">Model CC-908_OS</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                                <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center font-black text-base tracking-tighter shrink-0 select-none bg-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                    <span className="text-white">C</span><span className="text-cyan-400 -ml-1">C</span>
                                </div>
                                <div>
                                    <h1 className="font-bebas text-5xl md:text-6xl tracking-wider text-white leading-none">PANEL DE CONTROL</h1>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mt-1">
                                        Sistemas de almacenamiento automatizado e inyección de metadatos multimedia.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Capsule Corp Metric Cards */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 relative z-10">
                        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                            <div className="flex justify-between items-start">
                                <span className="text-[9px] font-mono text-cyan-500 uppercase tracking-widest">Capsule Storage Vol.04</span>
                                <span className="px-2 py-0.5 text-[8px] font-mono tracking-widest uppercase bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">INDEX_OK</span>
                            </div>
                            <div className="font-bebas text-4xl text-white tracking-wide mt-3">1.240 CAPÍTULOS</div>
                            <p className="text-[11px] text-zinc-500 mt-1 font-mono">Hash rate allocation: HEAD/TAIL O(1)</p>
                        </div>
                        
                        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                            <div className="flex justify-between items-start">
                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Memory Matrix Allocation</span>
                                <span className="text-[10px] font-mono font-bold text-cyan-400">4.2 / 5.0 TB</span>
                            </div>
                            <div className="w-full bg-zinc-900/40 rounded-full h-1 mt-5 overflow-hidden border border-white/5">
                                <div className="bg-cyan-500 h-full rounded-full shadow-[0_0_10px_#06b6d4]" style={{ width: "84%" }}></div>
                            </div>
                            <p className="text-[9px] font-mono text-zinc-600 mt-3 uppercase tracking-wider">Storage efficiency at 98.4%</p>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                            <div className="flex justify-between items-start">
                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">External Data Link</span>
                                <span className="px-2 py-0.5 text-[8px] font-mono tracking-widest uppercase bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">CONNECTED</span>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <div className="w-8 h-8 rounded-xl bg-zinc-900/60 flex items-center justify-center font-bold text-xs text-cyan-400 border border-white/5">T</div>
                                <div>
                                    <div className="text-xs font-bold text-zinc-300">TMDB API Connection</div>
                                    <p className="text-[10px] font-mono text-zinc-500">ID Node: Connected</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <form
                        onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>)}
                        className="w-full relative z-10"
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
                            <div className="relative bg-[#0c0e12]/95 border border-cyan-500/10 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(6,182,212,0.04)] flex items-center gap-8 overflow-hidden">
                                <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_3px]" />
                                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_left,rgba(6,182,212,0.06),transparent_60%)]" />

                                <div className="flex items-center gap-2.5 relative z-10">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
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
                                        className="bg-cyan-500 text-black hover:bg-cyan-400 px-5 py-2 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 shadow-[0_4px_20px_rgba(6,182,212,0.3)] font-mono font-bold"
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
