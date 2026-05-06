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
    { id: "scanner", label: "Buscador", icon: LucideRadar },
    { id: "playback", label: "Reproducción", icon: LucidePlay },
    { id: "appearance", label: "Apariencia", icon: LucidePalette },
]

function SettingsPage() {
    const { data: serverSettings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()

    const form = useForm<SettingsFormValues>({
        // mismatch between inferred Zod schema and Settings payload
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: serverSettings || {},
        mode: "onChange",
    })

    const { control, handleSubmit, formState: { isDirty, isValid }, reset, watch } = form

    // Force re-render on any field change to keep the floating bar reactive
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

    const commitToggle = useCallback(() => {
        // Immediate visual feedback or debounce logic can go here
    }, [])

    const hasChanges = isDirty

    if (isLoading) return <LoadingOverlayWithLogo />

    return (
        <div className="flex h-full w-full bg-black/40 backdrop-blur-3xl overflow-hidden selection:bg-primary/30">
            <header className="fixed top-0 left-0 lg:left-24 right-0 h-16 border-b border-white/[0.03] bg-black/50 backdrop-blur-md z-40 flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center p-1.5 shadow-lg">
                        <LucideHardDrive className="text-black" size={18} />
                    </div>
                    <span className="text-sm font-black tracking-widest uppercase text-white/90">KameHouse <span className="text-zinc-500">Settings</span></span>
                </div>
            </header>

            <Tabs defaultValue="scanner" className="flex-1 flex h-full pt-16 relative">
                {/* ─── Sidebar Premium ─── */}
                <aside className="w-[320px] h-full border-r border-white/[0.03] bg-black/30 flex flex-col p-8 space-y-10 z-10 overflow-y-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="space-y-4 mt-4 relative z-10">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Núcleo Central</p>
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
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Suscripción</p>
                        <div className="glass-panel-premium mx-1 p-6 rounded-none bg-white/[0.02] border border-white/5 relative overflow-hidden group/premium">
                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/premium:opacity-40 transition-all duration-700 ease-spring group-hover/premium:scale-110 group-hover/premium:rotate-12">
                                <LucideCrown size={48} className="text-white" />
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-2 uppercase tracking-[0.1em] font-black">KameHouse v3.5.0</p>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 h-full overflow-y-auto bg-black/10 scrollbar-hide py-8 px-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="w-full pb-48">


                        {/* ─── Contenido: Buscador ─── */}
                        <TabsContent value="scanner" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <div className="space-y-10">
                                <header className="space-y-4">
                                    <h1 className="text-6xl font-black tracking-tighter text-white">Buscador <span className="text-zinc-500">Metadatos</span></h1>
                                    <p className="text-zinc-400 text-xl font-medium leading-relaxed">Conecta tu biblioteca a la inteligencia de metadatos global. Lanza el escaneo e indexa de forma inteligente. Los proveedores están pre-configurados en el núcleo.</p>
                                </header>


                            </div>

                            <ScannerDashboard />

                            {/* ─── Archivos sin vincular ─── */}
                             <div className="space-y-5 pt-4">
                                <div className="flex items-center gap-4 px-2">
                                    <div className="h-px w-12 bg-white/20" />
                                    <p className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400">Vinculación Manual</p>
                                </div>
                                <UnlinkedFilesPanel />
                            </div>
                        </TabsContent>


                        {/* ─── Contenido: Reproducción ─── */}
                        <TabsContent value="playback" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                              <header className="space-y-4">
                                <h1 className="text-6xl font-black tracking-tighter text-white">Experiencia <span className="text-zinc-500">Inmersiva</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed">Controla cada píxel. Optimiza la calidad y activa la continuidad de visionado espacial entre tus ecosistemas.</p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <Section label="Dinámica de Visión">
                                    <Card>
                                        <OsToggle control={form.control} name="library.autoPlayNextEpisode"
                                            label="Próximo capítulo auto"
                                            desc="Fluidez total: reproduce el siguiente sin interrupciones."
                                            onSave={commitToggle} />
                                        <OsToggle control={form.control} name="library.enableWatchContinuity"
                                            label="Memoria de Escena"
                                            desc="Vuelve exactamente al segundo donde lo dejaste."
                                            onSave={commitToggle} />
                                    </Card>
                                </Section>

                                <Section label="Calidad & HW">
                                    <Card>
                                        <OsToggle control={form.control} name="mediastream.transcodeEnabled"
                                            label="Aceleración HW"
                                            desc="Usa tu GPU para procesar video sin carga en CPU."
                                            onSave={commitToggle} />
                                         <OsToggle control={form.control} name="mediastream.preTranscodeEnabled"
                                            label="Búfer Dinámico"
                                            desc="Pre-procesa los primeros segundos para arranque instantáneo."
                                            onSave={commitToggle} />
                                    </Card>
                                </Section>
                            </div>
                        </TabsContent>


                        {/* ─── Contenido: Apariencia ─── */}
                        <TabsContent value="appearance" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                              <header className="space-y-4">
                                <h1 className="text-6xl font-black tracking-tighter text-white">Vibe & <span className="text-zinc-500">Estética</span></h1>
                                <p className="text-zinc-400 text-xl font-medium leading-relaxed">Define la atmósfera de tu KameHouse. Sincroniza topologías, auras volumétricas y cinemáticas.</p>
                            </header>
                            <Section label="Interfaz Premium">
                                 <Card className="p-20 flex flex-col items-center justify-center text-center space-y-8">
                                    <div className="w-32 h-32 rounded-none bg-white/5 flex items-center justify-center border border-white/10">
                                        <LucidePalette className="text-white" size={64} />
                                    </div>
                                    <h3 className="text-4xl font-black text-white tracking-tight">Motor de Diseño Antigravity v2</h3>
                                    <p className="text-zinc-400 text-lg leading-relaxed font-medium">Estás usando el motor de diseño espacial con soporte nativo para estética brutalista y micro-animaciones fluidas. Los esquemas reactivos se sincronizan armónicamente con tu entorno.</p>
                                </Card>
                            </Section>
                        </TabsContent>
                    </form>
                </main>

                {/* ─── Save Bar Premium (Bottom Right) ─── */}
                <AnimatePresence>
                    {hasChanges && (
                         <motion.div
                            initial={{ opacity: 0, y: 60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 120, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="fixed bottom-16 right-16 z-50 overflow-hidden"
                        >
                            <div className="bg-black/80 backdrop-blur-[50px] border border-white/20 p-3 rounded-none shadow-2xl flex items-center gap-2 min-w-[500px]">
                                <button
                                    onClick={() => reset()}
                                    className="px-10 py-6 rounded-none text-[13px] font-black uppercase tracking-wide"
                                >
                                    Descartar
                                </button>
                                <button
                                    disabled={isSaving}
                                    onClick={handleSubmit(onSubmit)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-4 px-10 py-6 rounded-none text-[13px] font-black uppercase tracking-widest transition-all duration-700 relative overflow-hidden group/save",
                                        "bg-white text-black hover:bg-zinc-200 active:scale-95 disabled:opacity-50"
                                    )}
                                    type="button"
                                >
                                    <div className="absolute inset-0 bg-white opacity-0 group-hover/save:opacity-10 transition-opacity" />
                                    {isSaving ? <LucideRefreshCw className="animate-spin" size={20} /> : <LucideSave size={20} />}
                                    {isSaving ? "Sincronizando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Tabs>
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


