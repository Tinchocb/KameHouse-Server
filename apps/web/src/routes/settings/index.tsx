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
import { DirectorySelector } from "@/components/shared/directory-selector"
import { ScannerProgress } from "@/components/ui/scanner-progress"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import {
    LucideLibrary, LucidePlay, LucideCloud, LucideDownload,
    LucidePalette, LucideFolder, LucideTrash2,
    LucideSave, LucideRefreshCw, LucideCheckCircle2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

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
        tmdbLanguage: z.string().default(""),
        scannerUseLegacyMatching: z.boolean().default(false),
        scannerConfig: z.string().default(""),
        scannerStrictStructure: z.boolean().default(false),
        scannerProvider: z.string().default(""),
        disableLocalScanning: z.boolean().default(false),
        disableTorrentStreaming: z.boolean().default(false),
        disableDebridService: z.boolean().default(false),
        disableTorrentProvider: z.boolean().default(false),
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
    debrid: z.object({
        enabled: z.boolean().default(false),
        provider: z.string().default(""),
        apiKey: z.string().default(""),
        includeDebridStreamInLibrary: z.boolean().default(false),
        streamAutoSelect: z.boolean().default(false),
        streamPreferredResolution: z.string().default(""),
        torrentioUrl: z.string().default(""),
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
        disableIPV6: z.boolean().default(false),
        downloadDir: z.string().default(""),
        addToLibrary: z.boolean().default(false),
    }).default({}),
    theme: z.object({
        enableColorSettings: z.boolean().default(false),
        backgroundColor: z.string().default(""),
        accentColor: z.string().default(""),
        expandSidebarOnHover: z.boolean().default(true),
        hideTopNavbar: z.boolean().default(false),
        enableMediaCardBlurredBackground: z.boolean().default(true),
        enableMediaPageBlurredBackground: z.boolean().default(true),
        enableBlurringEffects: z.boolean().default(true),
    }).default({}),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/settings/")({
    component: SettingsPage,
})

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
    { value: "library",    icon: LucideLibrary,  label: "Biblioteca"      },
    { value: "playback",   icon: LucidePlay,     label: "Reproducción"    },
    { value: "streaming",  icon: LucideCloud,    label: "Debrid & Cloud"  },
    { value: "torrent",    icon: LucideDownload, label: "Torrents"        },
    { value: "appearance", icon: LucidePalette,  label: "Apariencia"      },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
    const { data: settings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
    const [isDirty, setIsDirty] = useState(false)

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: settingsSchema.parse({}) as SettingsFormValues,
    })

    useEffect(() => {
        if (settings) form.reset(settingsSchema.parse(settings) as SettingsFormValues)
    }, [settings, form])

    // track dirty state
    useEffect(() => {
        const sub = form.watch(() => setIsDirty(true))
        return () => sub.unsubscribe()
    }, [form])

    const onSubmit: SubmitHandler<SettingsFormValues> = useCallback(async (values) => {
        setSaveState("saving")
        try {
            await saveSettings(values as unknown as SaveSettings_Variables)
            setSaveState("saved")
            setIsDirty(false)
            setTimeout(() => setSaveState("idle"), 2500)
        } catch {
            toast.error("Error al guardar")
            setSaveState("idle")
        }
    }, [saveSettings])

    const commitToggle = useCallback(async () => {
        const values = form.getValues()
        await onSubmit(values)
    }, [form, onSubmit])

    if (isLoading) return <LoadingOverlayWithLogo />

    return (
        <>


            <div className="flex h-screen w-full bg-background overflow-hidden relative">
                <Tabs defaultValue="library" className="flex w-full h-full">
                    {/* Sidebar */}
                    <TabsList 
                        className={cn(
                            "w-64 h-full glass-panel border-r border-white/5 rounded-none flex flex-col p-6 gap-2 items-stretch bg-black/20",
                            "hidden lg:flex"
                        )}
                    >
                        <div className="mb-8 px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Configuración</h2>
                        </div>
                        {NAV_ITEMS.map(item => (
                            <TabsTrigger 
                                key={item.value} 
                                value={item.value} 
                                className={cn(
                                    "justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]",
                                    "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                )}
                            >
                                <item.icon size={16} />
                                <span className="text-[13px] font-semibold tracking-tight">{item.label}</span>
                            </TabsTrigger>
                        ))}
                        <div className="mt-auto px-2 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-3 text-[10px] font-bold text-green-500/80 uppercase tracking-widest">
                                <div className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </div>
                                Servidor Activo
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-2 uppercase tracking-[0.1em] font-black">KameHouse v3.5.0</p>
                        </div>
                    </TabsList>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto pb-48 pt-12 px-6 md:px-16 scroll-smooth">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-16">
                            
                            {/* ── Biblioteca ── */}
                            <TabsContent value="library" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <header className="space-y-2">
                                    <h1 className="text-3xl font-black tracking-tighter text-white">Biblioteca</h1>
                                    <p className="text-zinc-500 text-sm">Administrá tus carpetas de contenido y configurá el escáner.</p>
                                </header>

                                <div className="space-y-8">
                                    <ScannerProgress />
                                    
                                    <Section label="Carpetas de contenido">
                                        <LibraryPathsManager form={form} />
                                    </Section>

                                    <Section label="Metadatos">
                                        <Card>
                                            <InputRow label="TMDB API Key" desc="Requerido para obtener información de películas y series.">
                                                <Input {...form.register("library.tmdbApiKey")} className="bg-white/5 border-white/10" placeholder="Ingresá tu clave de TMDB..." />
                                            </InputRow>
                                        </Card>
                                    </Section>

                                    <Section label="Comportamiento">
                                        <Card>
                                            <OsToggle control={form.control} name="library.autoScan"
                                                label="Escaneo automático"
                                                desc="Detecta cambios en carpetas y escanea automáticamente."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="library.useFallbackMetadataProvider"
                                                label="Proveedor de metadatos alternativo"
                                                desc="Usa fuentes secundarias si el principal falla."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="library.refreshLibraryOnStart"
                                                label="Actualizar biblioteca al iniciar"
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>
                                </div>
                            </TabsContent>

                            {/* ── Reproducción ── */}
                            <TabsContent value="playback" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <header className="space-y-2">
                                    <h1 className="text-3xl font-black tracking-tighter text-white">Reproducción</h1>
                                    <p className="text-zinc-500 text-sm">Controlá cómo se reproduce el contenido en tu biblioteca.</p>
                                </header>

                                <div className="space-y-8">
                                    <Section label="General">
                                        <Card>
                                            <OsToggle control={form.control} name="library.autoPlayNextEpisode"
                                                label="Auto-play siguiente episodio"
                                                desc="Reproduce el próximo automáticamente al terminar uno."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="library.enableWatchContinuity"
                                                label="Continuar viendo"
                                                desc="Recuerda desde dónde dejaste cada episodio."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="library.disableAnimeCardTrailers"
                                                label="Desactivar trailers en catálogo"
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>

                                    <Section label="Transcodificación">
                                        <Card>
                                            <OsToggle control={form.control} name="mediastream.transcodeEnabled"
                                                label="Activar transcodificación"
                                                desc="El servidor procesa archivos incompatibles en tiempo real."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="mediastream.directPlayOnly"
                                                label="Solo reproducción directa"
                                                desc="Nunca transcodifica — puede fallar en algunos formatos."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="mediastream.preTranscodeEnabled"
                                                label="Pre-transcodificar"
                                                desc="Procesa el archivo antes de que empiece la reproducción."
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>
                                </div>
                            </TabsContent>

                            {/* ── Debrid ── */}
                            <TabsContent value="streaming" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <header className="space-y-2">
                                    <h1 className="text-3xl font-black tracking-tighter text-white">Debrid & Cloud</h1>
                                    <p className="text-zinc-500 text-sm">Conectá servicios externos para streaming instantáneo.</p>
                                </header>

                                <div className="space-y-8">
                                    <Section label="Servicio Debrid" right={<span className={cn("os-pill", form.watch("debrid.enabled") ? "os-pill-green" : "os-pill-gray")}>{form.watch("debrid.enabled") ? "Activo" : "Inactivo"}</span>}>
                                        <Card>
                                            <OsToggle control={form.control} name="debrid.enabled"
                                                label="Activar servicio"
                                                desc="Habilita la integración con Real-Debrid u otros proveedores."
                                                onSave={commitToggle} />
                                            <InputRow label="API Token">
                                                <Input {...form.register("debrid.apiKey")} type="password" placeholder="Real-Debrid / AllDebrid token..." />
                                            </InputRow>
                                            <OsToggle control={form.control} name="debrid.streamAutoSelect"
                                                label="Selección automática del stream"
                                                desc="Elige el mejor stream disponible sin intervención manual."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="debrid.includeDebridStreamInLibrary"
                                                label="Incluir en biblioteca"
                                                onSave={commitToggle} />
                                            <InputRow label="Torrentio Addon URL">
                                                <Input {...form.register("debrid.torrentioUrl")} placeholder="https://torrentio.strem.fun/..." />
                                            </InputRow>
                                        </Card>
                                    </Section>
                                </div>
                            </TabsContent>

                            {/* ── Torrent ── */}
                            <TabsContent value="torrent" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <header className="space-y-2">
                                    <h1 className="text-3xl font-black tracking-tighter text-white">Torrents</h1>
                                    <p className="text-zinc-500 text-sm">Configurá tu cliente de descargas local.</p>
                                </header>

                                <div className="space-y-8">
                                    <Section label="qBittorrent">
                                        <Card>
                                            <InputRow label="Host">
                                                <Input {...form.register("torrent.qbittorrentHost")} placeholder="http://localhost" />
                                            </InputRow>
                                            <div className="grid grid-cols-2 gap-4 px-4 py-3">
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">Usuario</p>
                                                    <Input {...form.register("torrent.qbittorrentUsername")} placeholder="admin" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">Contraseña</p>
                                                    <Input {...form.register("torrent.qbittorrentPassword")} type="password" placeholder="••••••" />
                                                </div>
                                            </div>
                                            <OsToggle control={form.control} name="torrent.showActiveTorrentCount"
                                                label="Mostrar contador de descargas activas"
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="torrent.hideTorrentList"
                                                label="Ocultar lista de torrents"
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>
                                </div>
                            </TabsContent>

                            {/* ── Apariencia ── */}
                            <TabsContent value="appearance" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <header className="space-y-2">
                                    <h1 className="text-3xl font-black tracking-tighter text-white">Apariencia</h1>
                                    <p className="text-zinc-500 text-sm">Personalizá los efectos visuales y el comportamiento de la interfaz.</p>
                                </header>

                                <div className="space-y-8">
                                    <Section label="Efectos">
                                        <Card>
                                            <OsToggle control={form.control} name="theme.enableBlurringEffects"
                                                label="Efectos de desenfoque"
                                                desc="Activa el backdrop-blur en toda la interfaz."
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="theme.enableMediaCardBlurredBackground"
                                                label="Fondo difuminado en tarjetas"
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="theme.enableMediaPageBlurredBackground"
                                                label="Fondo difuminado en páginas de detalle"
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>

                                    <Section label="Navegación">
                                        <Card>
                                            <OsToggle control={form.control} name="theme.expandSidebarOnHover"
                                                label="Sidebar se expande al pasar el cursor"
                                                onSave={commitToggle} />
                                            <OsToggle control={form.control} name="theme.hideTopNavbar"
                                                label="Ocultar barra superior"
                                                desc="Más espacio en pantalla, menos elementos de navegación."
                                                onSave={commitToggle} />
                                        </Card>
                                    </Section>
                                </div>
                            </TabsContent>
                        </form>
                    </div>

                    {/* ── Save bar (Premium Floating Toast) ── */}
                    <AnimatePresence>
                        {isDirty && (
                            <motion.div 
                                initial={{ y: 100, opacity: 0, scale: 0.9 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 100, opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50"
                            >
                                <div className="glass-panel-premium px-8 py-4 flex items-center gap-10 rounded-[2rem] border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    <div className="flex flex-col">
                                        <span className={cn(
                                            "text-xs font-black uppercase tracking-widest",
                                            saveState === "saved" ? "text-green-500" : "text-primary"
                                        )}>
                                            {saveState === "saved" ? "Sincronizado" : "Cambios Pendientes"}
                                        </span>
                                        <span className="text-[11px] text-zinc-400 font-medium">
                                            {saveState === "saved" ? "Tus ajustes están al día" : "Tenés cambios sin guardar en tu perfil"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={saveState === "saving"}
                                        onClick={form.handleSubmit(onSubmit)}
                                        className={cn(
                                            "flex items-center gap-2.5 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300",
                                            saveState === "saving" 
                                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                                                : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95"
                                        )}
                                    >
                                        {saveState === "saving" ? (
                                            <LucideRefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <LucideSave size={14} />
                                        )}
                                        {saveState === "saving" ? "Guardando" : "Guardar"}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Tabs>
            </div>
        </>
    )
}

// ─── OS Components ────────────────────────────────────────────────────────────

function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
                {right}
            </div>
            {children}
        </div>
    )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("glass-panel overflow-hidden bg-white/[0.02] border-white/5", className)}>
            {children}
        </div>
    )
}

function InputRow({ label, children, desc }: { label: string; children: React.ReactNode; desc?: string }) {
    return (
        <div className="px-4 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">{label}</p>
            {children}
            {desc && <p className="mt-2 px-1 text-[11px] text-zinc-600 leading-relaxed">{desc}</p>}
        </div>
    )
}

function OsToggle({ control, name, label, desc, onSave }: any) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors gap-8">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-200 tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-500 leading-normal max-w-md">{desc}</p>}
                    </div>
                    <Switch
                        value={!!field.value}
                        onValueChange={(v) => {
                            field.onChange(v)
                            onSave?.()
                        }}
                    />
                </div>
            )}
        />
    )
}

// ─── Library Paths Manager ────────────────────────────────────────────────────

function LibraryPathsManager({ form }: { form: any }) {
    const { mutateAsync: saveSettings } = useSaveSettings()
    const { mutate: scanLibrary, isPending: isScanning } = useScanLocalFiles()
    
    const [newSeriesPath, setNewSeriesPath] = useState("")
    const [newMoviePath, setNewMoviePath] = useState("")
    
    const seriesPaths = form.watch("library.seriesPaths") || []
    const moviePaths = form.watch("library.moviePaths") || []

    const addPath = async (type: "series" | "movie", p: string) => {
        const paths = type === "series" ? seriesPaths : moviePaths
        const field = type === "series" ? "library.seriesPaths" : "library.moviePaths"
        if (!p || paths.includes(p)) return
        const next = [...paths, p]
        form.setValue(field, next)
        await saveSettings(form.getValues())
        toast.success("Carpeta añadida")
    }

    const removePath = async (type: "series" | "movie", p: string) => {
        const paths = type === "series" ? seriesPaths : moviePaths
        const field = type === "series" ? "library.seriesPaths" : "library.moviePaths"
        const next = paths.filter((x: string) => x !== p)
        form.setValue(field, next)
        await saveSettings(form.getValues())
        toast.info("Carpeta eliminada")
    }

    const renderPathList = (type: "series" | "movie", paths: string[], label: string, emptyText: string) => (
        <Card className="flex flex-col w-full h-full">
            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-sm font-bold text-white/90">{label}</h3>
            </div>
            {paths.length === 0
                ? <div className="px-6 py-10 flex-1 flex items-center justify-center text-center text-zinc-500 italic text-xs">{emptyText}</div>
                : <div className="p-2 space-y-1 flex-1">
                    {paths.map((p: string) => (
                        <div key={p} className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group/path shadow-sm">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover/path:scale-110 transition-transform">
                                <LucideFolder size={16} className="text-primary" />
                            </div>
                            <span className="flex-1 font-mono text-[10px] text-zinc-400 truncate tracking-tight">{p}</span>
                            <button 
                                type="button" 
                                className="p-2 rounded-xl text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all opacity-0 group-hover/path:opacity-100" 
                                onClick={() => removePath(type, p)}
                            >
                                <LucideTrash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            }
            <div className="px-4 py-3 bg-black/20 flex items-center justify-between gap-4 border-t border-white/5 mt-auto">
                <div className="flex-1">
                    <DirectorySelector
                        value={type === "series" ? newSeriesPath : newMoviePath}
                        onSelect={(p) => type === "series" ? setNewSeriesPath(p) : setNewMoviePath(p)}
                        shouldExist={true}
                        label="Añadir carpeta"
                    />
                </div>
                <button
                    type="button"
                    disabled={!(type === "series" ? newSeriesPath : newMoviePath)}
                    onClick={() => {
                        const val = type === "series" ? newSeriesPath : newMoviePath
                        if (val) {
                            addPath(type, val)
                            type === "series" ? setNewSeriesPath("") : setNewMoviePath("")
                        }
                    }}
                    className={cn(
                        "rounded-xl px-4 py-2 text-xs font-bold transition-all",
                        (type === "series" ? newSeriesPath : newMoviePath) 
                            ? "bg-primary text-black hover:bg-primary/90" 
                            : "bg-white/5 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    Añadir
                </button>
            </div>
        </Card>
    )

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {renderPathList("series", seriesPaths, "Series y Anime", "Aún no has importado descargas de series o anime.")}
                {renderPathList("movie", moviePaths, "Películas", "Aún no has importado descargas de películas.")}
            </div>
            
            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    className={cn(
                        "flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        isScanning 
                            ? "text-zinc-500 bg-white/5 cursor-wait" 
                            : "text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:scale-105 active:scale-95 shadow-lg shadow-primary/5"
                    )}
                    disabled={isScanning}
                    onClick={() => scanLibrary({ enhanced: false, enhanceWithOfflineDatabase: false, skipLockedFiles: false, skipIgnoredFiles: false })}
                >
                    <LucideRefreshCw size={16} className={cn(isScanning && "animate-spin")} />
                    {isScanning ? "Sincronizando Catálogo..." : "Regenerar Bóveda de Contenido"}
                </button>
            </div>
        </div>
    )
}