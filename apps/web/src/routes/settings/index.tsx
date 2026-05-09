import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useCallback, useState } from "react"
import { useForm, Controller, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import {
    LucidePlay, LucideCloud, LucideDownload,
    LucidePalette,
    LucideSave, LucideRefreshCw, LucideCheckCircle2,
    LucideHardDrive, LucideSettings, LucideRadar, LucideUser, LucideCrown
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"

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
    torrent: z.record(z.unknown()).default({}),
    notifications: z.record(z.unknown()).default({}),
    Platform: z.record(z.unknown()).default({}),
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

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const { mutate: scanFiles, isPending: isScanning } = useScanLocalFiles()

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: serverSettings || {},
        mode: "onChange",
    })

    const { control, handleSubmit, formState: { isDirty }, reset, watch } = form
    const currentValues = watch()

    useEffect(() => {
        if (serverSettings) {
             reset(serverSettings)
        }
    }, [serverSettings, reset])

    const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
        try {
            await saveSettings(data as unknown as SaveSettings_Variables)
            toast.success("Ajustes guardados con éxito", {
                icon: <LucideCheckCircle2 size={16} className="text-primary" />
            })
            reset(data)
        } catch (error) {
            toast.error("Error al guardar los ajustes")
        }
    }

    const handleScan = (full: boolean) => {
        scanFiles({
            enhanced: true,
            enhanceWithOfflineDatabase: true,
            skipLockedFiles: false,
            skipIgnoredFiles: true,
            fullScan: full
        } as any)
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
                {/* ─── Sidebar ─── */}
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
                    <form onSubmit={handleSubmit(onSubmit)} className="w-full pb-48">
                        {/* ─── Pestaña: Biblioteca ─── */}
                        <TabsContent value="library" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <header className="space-y-4">
                                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">BIBLIOTECA <span className="text-zinc-500">CONTROL</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Gestiona el motor de escaneo inteligente. El escaneo Delta ahorra recursos analizando solo cambios recientes.</p>
                            </header>

                            <div className="flex gap-4">
                                <ScanButton 
                                    variant="delta" 
                                    onClick={() => handleScan(false)} 
                                    loading={isScanning} 
                                />
                                <ScanButton 
                                    variant="full" 
                                    onClick={() => handleScan(true)} 
                                    loading={isScanning} 
                                />
                            </div>

                            <ScannerDashboard />

                            <div className="space-y-5 pt-8">
                                <div className="flex items-center gap-4 px-2">
                                    <div className="h-px w-12 bg-white/20" />
                                    <p className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400">Archivos no Identificados</p>
                                </div>
                                <UnlinkedFilesPanel />
                            </div>
                        </TabsContent>

                        {/* ─── Pestaña: Reproductor ─── */}
                        <TabsContent value="player" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <header className="space-y-4">
                                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">MOTOR <span className="text-zinc-500">REPRODUCCIÓN</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Optimiza la fluidez y la automatización de tu experiencia visual.</p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <Section label="Automatización">
                                    <Card>
                                        <OsToggle control={control} name="library.autoPlayNextEpisode"
                                            label="Reproducción Automática"
                                            desc="Reproducir el siguiente episodio automáticamente al terminar." />
                                        <OsToggle control={control} name="library.enableWatchContinuity"
                                            label="Saltar Intros (AniSkip)"
                                            desc="Sincronizar con AniSkip para saltar openings/endings automáticamente." />
                                    </Card>
                                </Section>

                                <Section label="Transmisión & HW">
                                    <Card>
                                        <OsToggle control={control} name="mediastream.transcodeEnabled"
                                            label="Transcodificación HW"
                                            desc="Usar aceleración por hardware para el streaming de video." />
                                         <OsToggle control={control} name="mediastream.preTranscodeEnabled"
                                            label="Pre-Transcodificado"
                                            desc="Preparar el buffer antes de iniciar la reproducción." />
                                    </Card>
                                </Section>
                            </div>
                        </TabsContent>

                        {/* ─── Pestaña: Integraciones ─── */}
                        <TabsContent value="integrations" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                             <header className="space-y-4">
                                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">ECOSISTEMA <span className="text-zinc-500">EXTERNO</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Conecta con servicios de tracking para mantener tu lista sincronizada en la nube.</p>
                            </header>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <IntegrationCard name="AniList" status="Disponible" connected={false} />
                                <IntegrationCard name="MyAnimeList" status="Próximamente" connected={false} disabled />
                                <IntegrationCard name="TMDB" status="Conectado" connected={true} />
                            </div>
                        </TabsContent>

                        {/* ─── Pestaña: Sistema ─── */}
                        <TabsContent value="system" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                             <header className="space-y-4">
                                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">NÚCLEO <span className="text-zinc-500">SISTEMA</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Información técnica sobre el servidor y estado de los recursos.</p>
                            </header>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <StatusCard label="Versión" value="3.5.0-ALPHA" icon={LucideCrown} />
                                <StatusCard label="Database" value="SQLite (WAL)" icon={LucideHardDrive} />
                                <StatusCard label="Entorno" value="Producción" icon={LucideCheckCircle2} />
                            </div>
                        </TabsContent>
                    </form>
                </main>

                {/* ─── Save Bar ─── */}
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
                                        onClick={handleSubmit(onSubmit)}
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

function ScanButton({ variant, onClick, loading }: { variant: "delta" | "full", onClick: () => void, loading?: boolean }) {
    const isDelta = variant === "delta"
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={cn(
                "flex-1 flex items-center justify-between p-6 rounded-none border transition-all duration-500",
                isDelta ? "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{isDelta ? "Rápido" : "Profundo"}</p>
                <p className="text-xl font-bebas tracking-widest uppercase">{isDelta ? "Escaneo Delta" : "Escaneo Completo"}</p>
            </div>
            <LucideRefreshCw size={24} className={cn(isDelta ? "text-primary" : "text-white", loading && "animate-spin")} />
        </button>
    )
}

function IntegrationCard({ name, status, connected, disabled }: { name: string; status: string; connected: boolean; disabled?: boolean }) {
    return (
        <div className={cn(
            "p-8 border border-white/5 bg-white/[0.02] flex flex-col items-center text-center gap-4 transition-all duration-500",
            disabled ? "opacity-40 grayscale" : "hover:border-white/20 hover:bg-white/[0.05]"
        )}>
            <div className="w-16 h-16 bg-white/5 flex items-center justify-center">
                <LucideCloud size={32} className={connected ? "text-primary" : "text-zinc-500"} />
            </div>
            <div>
                <p className="font-bebas text-2xl tracking-widest uppercase">{name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">{status}</p>
            </div>
        </div>
    )
}

function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
    return (
        <div className="p-8 border border-white/5 bg-white/[0.02] flex items-center gap-6">
            <div className="w-12 h-12 bg-white/5 flex items-center justify-center text-zinc-400">
                <Icon size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
                <p className="text-xl font-bebas tracking-widest uppercase text-white">{value}</p>
            </div>
        </div>
    )
}

function TabsTriggerActiveIndicator() {
    return (
         <motion.div 
            layoutId="active-nav-bg"
            className="absolute inset-0 bg-white/10 rounded-none -z-10 border border-white/20"
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
        />
    )
}

function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-4">
                    <div className="h-px w-12 bg-white/20" />
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400">{label}</p>
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
         <div className={cn(
            "overflow-hidden bg-white/[0.02] border border-white/5 rounded-none",
            "transition-all duration-700 hover:bg-white/[0.04] hover:border-white/10",
            className
        )}>
            {children}
        </div>
    )
}


interface OsToggleProps {
    control: import("react-hook-form").Control<SettingsFormValues>
    name: import("react-hook-form").FieldPath<SettingsFormValues>
    label: string
    desc?: string
    onSave?: () => void
}

function OsToggle({ control, name, label, desc, onSave }: OsToggleProps) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex items-center justify-between px-8 py-8 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-all duration-500 gap-16 group/toggle">
                    <div className="space-y-2 focus-within:ring-0 flex-1">
                        <p className="text-xl font-bold text-zinc-100 tracking-tight group-hover/toggle:text-white transition-colors">{label}</p>
                        {desc && <p className="text-base text-zinc-500 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <Switch
                        value={!!field.value}
                        onValueChange={(v) => {
                            field.onChange(v)
                            onSave?.()
                        }}
                        className="scale-125 origin-right"
                    />
                </div>
            )}
        />
    )
}
