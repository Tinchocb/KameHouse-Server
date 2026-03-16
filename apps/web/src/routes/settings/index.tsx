import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useCallback, useState, memo } from "react"
import { useForm, Controller, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DirectorySelector } from "@/components/shared/directory-selector"
import { PageHeader } from "@/components/ui/page-header/page-header"
import { ScannerProgress } from "@/components/ui/scanner-progress"
import { useGetSettings, useSaveSettings } from "@/api/hooks/settings.hooks"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"

import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"
import type { Models_Settings } from "@/api/generated/types"

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/settings/")({
    component: SettingsPage,
})

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const settingsSchema = z.object({
    library: z.object({
        libraryPath: z.string().default(""),
        libraryPaths: z.array(z.string()).nullish().transform(v => v ?? []),
        autoUpdateProgress: z.boolean().default(false),
        torrentProvider: z.string().default(""),
        autoSelectTorrentProvider: z.string().default(""),
        autoScan: z.boolean().default(false),
        enableOnlinestream: z.boolean().default(false),
        includeOnlineStreamingInLibrary: z.boolean().default(false),
        disableAnimeCardTrailers: z.boolean().default(false),
        enableManga: z.boolean().default(false),
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
        disableJellyfin: z.boolean().default(false),
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
    nakama: z.object({
        enabled: z.boolean().default(false),
        username: z.string().default(""),
        isHost: z.boolean().default(false),
        hostPassword: z.string().default(""),
        remoteServerURL: z.string().default(""),
        remoteServerPassword: z.string().default(""),
        includeNakamaAnimeLibrary: z.boolean().default(false),
        hostShareLocalAnimeLibrary: z.boolean().default(false),
        hostUnsharedAnimeIds: z.array(z.number()).nullish().transform(v => v ?? []),
        hostEnablePortForwarding: z.boolean().default(false),
    }).default({}),
    jellyfin: z.object({
        enabled: z.boolean().default(false),
        serverUrl: z.string().default(""),
        apiKey: z.string().default(""),
        username: z.string().default(""),
        password: z.string().default(""),
        scanOnItemAdd: z.boolean().default(false),
        scanDelayMs: z.number().default(0),
    }).default({}),
    // Optional sub-settings – sent as-is from the fetched data
    mediastream: z.any().optional(),
    torrentstream: z.any().optional(),
    debrid: z.any().optional(),
    theme: z.any().optional(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

// ─── Map fetched settings → form defaults ─────────────────────────────────────

function toFormValues(s: Models_Settings): SettingsFormValues {
    return settingsSchema.parse({
        library: s.library ?? {},
        mediaPlayer: s.mediaPlayer ?? {},
        torrent: s.torrent ?? {},
        manga: s.manga ?? {},
        notifications: s.notifications ?? {},
        nakama: s.nakama ?? {},
        jellyfin: s.jellyfin ?? {},
        mediastream: s.mediastream,
        torrentstream: s.torrentstream,
        debrid: s.debrid,
        theme: s.theme,
    })
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SettingsPage() {
    const { data: settings, isLoading } = useGetSettings()
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const [dirSelectorOpen, setDirSelectorOpen] = useState(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: settingsSchema.parse({}) as SettingsFormValues,
    })

    // Hydrate when data arrives (or when settings change externally)
    useEffect(() => {
        if (settings) {
            form.reset(toFormValues(settings))
        }
    }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Full-form save handler (called by Save buttons) ───────────────────────
    const onSubmit: SubmitHandler<SettingsFormValues> = useCallback(async (values: SettingsFormValues) => {
        try {
            await saveSettings(values as unknown as SaveSettings_Variables)
            toast.success("Ajustes guardados correctamente")
        } catch {
            toast.error("Error al guardar los ajustes. Intenta de nuevo.")
        }
    }, [saveSettings])

    // ── Immediate-save helper for toggles ─────────────────────────────────────
    const commitToggle = useCallback(async () => {
        const values = form.getValues()
        try {
            await saveSettings(values as unknown as SaveSettings_Variables)
            toast.success("Ajuste guardado")
        } catch {
            toast.error("No se pudo guardar el ajuste")
        }
    }, [form, saveSettings])

    // ── Library path helpers ──────────────────────────────────────────────────
    const handleAddPath = useCallback(async (path: string) => {
        const current = form.getValues("library.libraryPaths") ?? []
        if (current.includes(path)) { toast.info("La carpeta ya está añadida"); return }
        form.setValue("library.libraryPaths", [...current, path])
        await onSubmit(form.getValues())
    }, [form, onSubmit])

    const handleRemovePath = useCallback(async (dir: string) => {
        const current = form.getValues("library.libraryPaths") ?? []
        form.setValue("library.libraryPaths", current.filter((p: string) => p !== dir))
        await onSubmit(form.getValues())
    }, [form, onSubmit])

    return (
        <div className="flex-1 w-full flex flex-col bg-background text-white overflow-y-auto pb-6">
            <PageHeader title={<>CONFIGURACIÓN <span className="text-orange-500">GENERAL</span></>} />

            <div className="flex-1 w-full p-6 md:p-10">
                {isLoading ? (
                    <SettingsSkeleton />
                ) : (
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <Tabs defaultValue="library" className="w-full flex gap-8">
                            {/* ── Vertical sidebar ── */}
                            <TabsList className="flex flex-col h-auto w-64 bg-transparent space-y-2 items-start justify-start p-0">
                                {NAV_TABS.map(({ value, label }) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        className="w-full justify-start px-4 py-3 text-lg font-medium text-gray-400 data-[state=active]:bg-[#1C1C28] data-[state=active]:text-orange-400 data-[state=active]:border-l-4 data-[state=active]:border-orange-500 rounded-none transition-all"
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {/* ── Panels ── */}
                            <div className="flex-1 bg-[#151520] rounded-xl border border-white/5 p-8 shadow-2xl">

                                {/* Library */}
                                <TabsContent value="library" className="mt-0 space-y-6">
                                    <ScannerProgress />
                                    <SectionHeader title="Directorios de Biblioteca" description="Gestiona las rutas locales desde donde KameHouse leerá tu contenido y escanea para añadir nuevos medios." />
                                    <LibraryPathsManager form={form} />

                                    <div className="my-6 h-px bg-white/5" />

                                    <SettingToggle
                                        control={form.control}
                                        name="library.autoPlayNextEpisode"
                                        label="Auto-play siguiente episodio"
                                        description="Reproduce automáticamente el siguiente episodio al finalizar uno."
                                        onSave={commitToggle}
                                        disabled={isSaving}
                                    />
                                    <SettingToggle
                                        control={form.control}
                                        name="library.enableWatchContinuity"
                                        label="Continuidad de reproducción"
                                        description="Recuerda el punto exacto donde dejaste de ver cada episodio."
                                        onSave={commitToggle}
                                        disabled={isSaving}
                                    />

                                    <Button
                                        type="submit"
                                        intent="primary"
                                        className="mt-4 font-bold px-8 min-h-[48px]"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Guardando..." : "Guardar Ajustes"}
                                    </Button>
                                </TabsContent>

                                {/* Playback */}
                                <TabsContent value="playback" className="mt-0 space-y-6">
                                    <SectionHeader title="Reproductor y Calidad" description="Ajustes prioritarios para la reproducción de contenido." />
                                    <SettingToggle
                                        control={form.control}
                                        name="mediaPlayer.defaultPlayer"
                                        label="Reproductor externo por defecto (VLC)"
                                        description="Abre los archivos MKV/MP4 en VLC o el reproductor del sistema."
                                        booleanTransform={{ fromBool: (v) => v ? "vlc" : "", toBool: (v) => v === "vlc" }}
                                        onSave={commitToggle}
                                        disabled={isSaving}
                                    />
                                    <SettingToggle
                                        control={form.control}
                                        name="library.disableAnimeCardTrailers"
                                        label="Desactivar trailers en tarjetas"
                                        description="Evita que las tarjetas de anime reproduzcan trailers al pasar el cursor."
                                        onSave={commitToggle}
                                        disabled={isSaving}
                                    />

                                    {/* Mediastream sub-section */}
                                    <div className="mt-6 pt-6 border-t border-white/5">
                                        <p className="text-sm font-black uppercase tracking-widest text-orange-500/80 mb-4">Transcodificación (Mediastream)</p>
                                        <SettingToggle
                                            control={form.control}
                                            name="mediastream.transcodeEnabled"
                                            label="Activar transcodificación"
                                            description="Transcodifica archivos incompatibles directamente desde el servidor."
                                            onSave={commitToggle}
                                            disabled={isSaving}
                                        />
                                        <SettingToggle
                                            control={form.control}
                                            name="mediastream.directPlayOnly"
                                            label="Solo reproducción directa"
                                            description="Deshabilita la transcodificación y sirve el archivo tal cual."
                                            onSave={commitToggle}
                                            disabled={isSaving}
                                        />
                                    </div>
                                </TabsContent>



                                {/* Interface */}
                                <TabsContent value="interface" className="mt-0 space-y-6">
                                    <SectionHeader title="Personalización Visual" description="Ajusta el tema y opciones visuales de la app." />
                                    <div className="p-4 bg-white/5 rounded-md border border-white/5 text-gray-400 text-sm italic">
                                        Opciones de interfaz adicionales próximamente.
                                    </div>

                                    {/* Save all button */}
                                    <Button
                                        type="submit"
                                        intent="primary"
                                        className="mt-4 font-bold px-8 min-h-[48px]"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Guardando..." : "Guardar Ajustes"}
                                    </Button>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </form>
                )}
            </div>
        </div>
    )
}

// ─── Navigation tabs config ───────────────────────────────────────────────────

const NAV_TABS = [
    { value: "library", label: "Biblioteca Local" },
    { value: "playback", label: "Reproductor y Calidad" },

    { value: "interface", label: "Interfaz de Usuario" },
]

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SettingsSkeleton() {
    return (
        <div className="flex gap-8 animate-pulse">
            <div className="w-64 space-y-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-white/5" />
                ))}
            </div>
            <div className="flex-1 rounded-xl bg-white/5 h-[480px]" />
        </div>
    )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div className="mb-2">
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-gray-400 mt-1 font-medium">{description}</p>
        </div>
    )
}

// ─── Memoized setting toggle row ──────────────────────────────────────────────

interface SettingToggleProps {
    control: any
    name: string
    label: string
    description?: string
    disabled?: boolean
    onSave?: () => void
    showConnectionBadge?: boolean
    /** For fields stored as string internally (e.g. defaultPlayer "vlc") */
    booleanTransform?: {
        fromBool: (v: boolean) => any
        toBool: (v: any) => boolean
    }
}

const SettingToggle = memo(function SettingToggle({
    control,
    name,
    label,
    description,
    disabled,
    onSave,
    showConnectionBadge,
    booleanTransform,
}: SettingToggleProps) {
    return (
        <Controller
            control={control}
            name={name as any}
            render={({ field }) => {
                const checked = booleanTransform ? booleanTransform.toBool(field.value) : !!field.value
                return (
                    <div className="flex items-center justify-between p-4 bg-[#1C1C28] rounded-md border border-white/5">
                        <div>
                            <p className="font-bold text-base">{label}</p>
                            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
                        </div>
                        <div className="flex items-center gap-4">
                            {showConnectionBadge && (
                                <Badge intent={checked ? "success" : "gray-basic"} className="transition-all duration-300 pointer-events-none">
                                    {checked ? "Conectado" : "Desconectado"}
                                </Badge>
                            )}
                            <Switch
                                value={checked}
                                disabled={disabled}
                                onValueChange={(v) => {
                                    const next = booleanTransform ? booleanTransform.fromBool(v) : v
                                    field.onChange(next)
                                    onSave?.()
                                }}
                            />
                        </div>
                    </div>
                )
            }}
        />
    )
})

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
    return (
        <div className="p-4 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-md text-sm font-medium">
            {message}
        </div>
    )
}

// ─── Library Paths Manager ────────────────────────────────────────────────────

function LibraryPathsManager({ form }: { form: any }) {
    const { mutateAsync: saveSettings, isPending: isSaving } = useSaveSettings()
    const { mutate: scanLibrary, isPending: isScanning } = useScanLocalFiles()
    const [dirSelectorOpen, setDirSelectorOpen] = useState(false)

    const handleAddPath = useCallback(async (path: string) => {
        const current = form.getValues("library.libraryPaths") ?? []
        if (current.includes(path)) { toast.info("La carpeta ya está añadida"); return }
        const newPaths = [...current, path]
        form.setValue("library.libraryPaths", newPaths)
        try {
            await saveSettings(form.getValues() as unknown as SaveSettings_Variables)
            toast.success("Carpeta añadida")
        } catch {
            form.setValue("library.libraryPaths", current) // revert on error
            toast.error("Error al añadir carpeta")
        }
    }, [form, saveSettings])

    const handleRemovePath = useCallback(async (dir: string) => {
        const current = form.getValues("library.libraryPaths") ?? []
        const newPaths = current.filter((p: string) => p !== dir)
        form.setValue("library.libraryPaths", newPaths) // Optimistic update
        try {
            await saveSettings(form.getValues() as unknown as SaveSettings_Variables)
            toast.success("Carpeta eliminada")
        } catch {
            form.setValue("library.libraryPaths", current) // revert on error
            toast.error("Error al eliminar carpeta")
        }
    }, [form, saveSettings])

    const handleScan = useCallback(() => {
        scanLibrary({
            enhanced: false,
            enhanceWithOfflineDatabase: false,
            skipLockedFiles: false,
            skipIgnoredFiles: false
        })
    }, [scanLibrary])

    return (
        <div className="space-y-4">
            <Controller
                control={form.control}
                name="library.libraryPaths"
                render={({ field }) => (
                    <div className="space-y-3">
                        {field.value.length === 0 && (
                            <EmptyState message="No hay carpetas configuradas." />
                        )}
                        {field.value.map((dir: string, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-[#1C1C28] rounded-md border border-white/5 transition-colors hover:border-orange-500/20">
                                <span className="font-mono text-sm truncate mr-4 text-gray-200">{dir}</span>
                                <Button
                                    type="button"
                                    intent="alert-basic"
                                    className="hover:bg-red-500/10 hover:text-red-400 flex-shrink-0 min-h-[48px]"
                                    disabled={isSaving || isScanning}
                                    onClick={() => handleRemovePath(dir)}
                                >
                                    Eliminar
                                </Button>
                            </div>
                        ))}
                        <div className="flex gap-4 pt-2">
                            <Button
                                type="button"
                                intent="gray-basic"
                                className="font-bold px-6 min-h-[48px] bg-[#1C1C28] hover:bg-[#252536] text-white border border-white/5"
                                disabled={isSaving || isScanning}
                                onClick={() => setDirSelectorOpen(true)}
                            >
                                + Añadir Carpeta
                            </Button>
                            <Button
                                type="button"
                                intent="primary"
                                className="font-bold px-8 min-h-[48px] ml-auto shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                                disabled={isScanning || isSaving || field.value.length === 0}
                                onClick={handleScan}
                            >
                                {isScanning ? "Escaneando..." : "Escanear Librería"}
                            </Button>
                        </div>
                    </div>
                )}
            />
            <DirectorySelector
                value=""
                onSelect={(path) => { setDirSelectorOpen(false); handleAddPath(path) }}
                shouldExist={true}
                label="Seleccionar Carpeta Local"
            />
        </div>
    )
}


