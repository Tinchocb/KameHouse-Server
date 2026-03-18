import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useCallback, useState } from "react"
import { useForm, Controller, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
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
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

// ─── Schema ───────────────────────────────────────────────────────────────────

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

    if (isLoading) return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100vh", background: "#111113", gap: 12,
            color: "rgba(255,255,255,0.35)", fontSize: 13,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
            <LucideRefreshCw size={16} style={{ animation: "os-spin 1s linear infinite", color: "#f97316" }} />
            Cargando ajustes...
        </div>
    )

    return (
        <>
            <style>{`
                @keyframes os-spin { to { transform: rotate(360deg); } }
                @keyframes os-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

                /* ── Reset / Base ── */
                .os-page {
                    flex: 1;
                    width: 100%;
                    min-height: 100vh;
                    background: #111113;
                    color: #e8e8ea;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif;
                    font-size: 14px;
                    -webkit-font-smoothing: antialiased;
                    overflow-y: auto;
                    padding-bottom: 80px;
                }

                /* ── Shell ── */
                .os-shell {
                    display: flex;
                    height: 100%;
                    min-height: 100vh;
                }

                /* ── Sidebar ── */
                .os-sidebar {
                    width: 220px;
                    flex-shrink: 0;
                    background: #18181b;
                    border-right: 1px solid rgba(255,255,255,0.06);
                    padding: 28px 12px 24px;
                    display: flex;
                    flex-direction: column;
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    overflow-y: auto;
                }

                .os-sidebar-title {
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.2);
                    padding: 0 10px;
                    margin-bottom: 10px;
                    margin-top: 4px;
                }

                .os-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border-radius: 7px;
                    cursor: pointer;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.45);
                    transition: background 140ms, color 140ms;
                    border: none;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                    margin-bottom: 1px;
                }
                .os-nav-item:hover:not([data-state="active"]) {
                    background: rgba(255,255,255,0.05);
                    color: rgba(255,255,255,0.7);
                }
                .os-nav-item[data-state="active"] {
                    background: rgba(249,115,22,0.12);
                    color: #fff;
                }
                .os-nav-item[data-state="active"] .os-nav-icon {
                    color: #f97316;
                }
                .os-nav-icon {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                    color: rgba(255,255,255,0.3);
                    transition: color 140ms;
                }

                .os-sidebar-footer {
                    margin-top: auto;
                    padding: 12px 10px 0;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
                .os-version {
                    font-size: 11px;
                    color: rgba(255,255,255,0.15);
                    font-weight: 500;
                }
                .os-online {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(34,197,94,0.7);
                    margin-top: 4px;
                }
                .os-online-dot {
                    width: 5px; height: 5px;
                    border-radius: 50%;
                    background: #22c55e;
                }

                /* ── Main ── */
                .os-main {
                    flex: 1;
                    min-width: 0;
                    padding: 36px 48px 32px;
                    max-width: 740px;
                }
                @media (max-width: 900px) { .os-main { padding: 28px 24px; } }

                /* ── Page heading ── */
                .os-heading {
                    margin-bottom: 28px;
                    animation: os-fadein 220ms ease both;
                }
                .os-heading h1 {
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    color: #fff;
                    margin: 0 0 4px;
                }
                .os-heading p {
                    font-size: 13px;
                    color: rgba(255,255,255,0.3);
                    margin: 0;
                    font-weight: 400;
                }

                /* ── Group ── */
                .os-group {
                    margin-bottom: 28px;
                    animation: os-fadein 240ms ease both;
                }
                .os-group-label {
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.25);
                    margin-bottom: 8px;
                    padding: 0 2px;
                }

                /* ── Card ── */
                .os-card {
                    background: #1c1c1f;
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 12px;
                    overflow: hidden;
                }

                /* ── Row ── */
                .os-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 13px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    gap: 16px;
                    transition: background 120ms;
                }
                .os-row:last-child { border-bottom: none; }
                .os-row:hover { background: rgba(255,255,255,0.02); }

                .os-row-left { flex: 1; min-width: 0; }
                .os-row-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #e8e8ea;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .os-row-desc {
                    font-size: 12px;
                    color: rgba(255,255,255,0.28);
                    margin-top: 2px;
                    line-height: 1.4;
                }

                /* ── Input row ── */
                .os-input-row {
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .os-input-row:last-child { border-bottom: none; }
                .os-input-label {
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.25);
                    margin-bottom: 6px;
                }
                .os-input-row input {
                    width: 100%;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.05) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    border-radius: 8px !important;
                    color: #e8e8ea !important;
                    font-size: 13px !important;
                    font-family: inherit !important;
                    outline: none !important;
                    transition: border-color 160ms, box-shadow 160ms !important;
                    box-sizing: border-box;
                }
                .os-input-row input:focus {
                    border-color: rgba(249,115,22,0.5) !important;
                    box-shadow: 0 0 0 3px rgba(249,115,22,0.08) !important;
                }
                .os-input-row input::placeholder { color: rgba(255,255,255,0.18) !important; }

                /* ── Input grid ── */
                .os-input-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .os-input-grid:last-child { border-bottom: none; }

                /* ── Pill badge ── */
                .os-pill {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 3px 9px;
                    border-radius: 999px;
                    letter-spacing: 0.04em;
                }
                .os-pill-green {
                    background: rgba(34,197,94,0.1);
                    color: #4ade80;
                    border: 1px solid rgba(34,197,94,0.2);
                }
                .os-pill-gray {
                    background: rgba(255,255,255,0.05);
                    color: rgba(255,255,255,0.3);
                    border: 1px solid rgba(255,255,255,0.07);
                }

                /* ── Path items ── */
                .os-paths { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
                .os-path {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 10px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    transition: border-color 140ms;
                }
                .os-path:hover { border-color: rgba(255,255,255,0.1); }
                .os-path-name {
                    flex: 1;
                    font-size: 12px;
                    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
                    color: rgba(255,255,255,0.45);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .os-path-del {
                    width: 24px; height: 24px;
                    border-radius: 6px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: background 120ms, color 120ms;
                    padding: 0;
                }
                .os-path-del:hover { background: rgba(239,68,68,0.15); color: #f87171; }

                .os-paths-empty {
                    padding: 20px 16px;
                    font-size: 13px;
                    color: rgba(255,255,255,0.2);
                    text-align: center;
                    font-style: italic;
                }

                .os-paths-footer {
                    padding: 8px 12px 12px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                /* ── Scan button ── */
                .os-scan-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 7px;
                    border: 1px solid rgba(249,115,22,0.25);
                    background: rgba(249,115,22,0.07);
                    color: rgba(249,115,22,0.8);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 160ms;
                    font-family: inherit;
                }
                .os-scan-btn:hover:not(:disabled) {
                    background: rgba(249,115,22,0.14);
                    color: #f97316;
                    border-color: rgba(249,115,22,0.4);
                }
                .os-scan-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                /* ── Save bar ── */
                .os-save-bar {
                    position: fixed;
                    bottom: 0; left: 220px; right: 0;
                    z-index: 50;
                    height: 56px;
                    background: rgba(17,17,19,0.92);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-top: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 0 48px;
                    gap: 12px;
                }
                @media (max-width: 900px) { .os-save-bar { left: 0; padding: 0 24px; } }

                .os-save-hint {
                    font-size: 12px;
                    color: rgba(255,255,255,0.2);
                }
                .os-save-hint.dirty { color: rgba(249,115,22,0.6); }

                .os-save-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    padding: 8px 20px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 180ms;
                    font-family: inherit;
                    letter-spacing: 0.01em;
                }
                .os-save-btn.idle {
                    background: #f97316;
                    color: #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(249,115,22,0.4);
                }
                .os-save-btn.idle:hover {
                    background: #fb923c;
                    box-shadow: 0 2px 8px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.5);
                }
                .os-save-btn.saving {
                    background: rgba(249,115,22,0.3);
                    color: rgba(255,255,255,0.5);
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .os-save-btn.saved {
                    background: rgba(34,197,94,0.1);
                    color: #4ade80;
                    border: 1px solid rgba(34,197,94,0.25);
                    box-shadow: none;
                }
            `}</style>

            <div className="os-page">
                <Tabs defaultValue="library">
                    <div className="os-shell">

                        {/* ── Sidebar ── */}
                        <TabsList style={{
                            display: "flex", flexDirection: "column", height: "auto",
                            background: "transparent", padding: 0, gap: 0,
                        }} className="os-sidebar">
                            <p className="os-sidebar-title">Configuración</p>

                            {NAV_ITEMS.map(item => (
                                <TabsTrigger
                                    key={item.value}
                                    value={item.value}
                                    className="os-nav-item"
                                >
                                    <item.icon size={15} className="os-nav-icon" />
                                    {item.label}
                                </TabsTrigger>
                            ))}

                            <div className="os-sidebar-footer">
                                <div className="os-online">
                                    <div className="os-online-dot" />
                                    Servidor activo
                                </div>
                                <p className="os-version">KameHouse v3.5.0</p>
                            </div>
                        </TabsList>

                        {/* ── Content ── */}
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="os-main"
                            style={{ flex: 1 }}
                        >

                            {/* ── Biblioteca ── */}
                            <TabsContent value="library" className="m-0">
                                <div className="os-heading">
                                    <h1>Biblioteca</h1>
                                    <p>Administrá tus carpetas de contenido y configurá el escáner.</p>
                                </div>

                                <div className="os-group">
                                    <ScannerProgress />
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Carpetas de contenido</p>
                                    <div className="os-card">
                                        <LibraryPathsManager form={form} />
                                    </div>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Metadatos</p>
                                    <div className="os-card">
                                        <div className="os-input-row">
                                            <p className="os-input-label">TMDB API Key</p>
                                            <Input {...form.register("library.tmdbApiKey")} placeholder="Ingresá tu clave de TMDB..." />
                                        </div>
                                    </div>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Comportamiento</p>
                                    <div className="os-card">
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
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── Reproducción ── */}
                            <TabsContent value="playback" className="m-0">
                                <div className="os-heading">
                                    <h1>Reproducción</h1>
                                    <p>Controlá cómo se reproduce el contenido en tu biblioteca.</p>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">General</p>
                                    <div className="os-card">
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
                                    </div>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Transcodificación</p>
                                    <div className="os-card">
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
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── Debrid ── */}
                            <TabsContent value="streaming" className="m-0">
                                <div className="os-heading">
                                    <h1>Debrid & Cloud</h1>
                                    <p>Conectá servicios externos para streaming instantáneo.</p>
                                </div>

                                <div className="os-group">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <p className="os-group-label" style={{ margin: 0 }}>Servicio Debrid</p>
                                        <span className={`os-pill ${form.watch("debrid.enabled") ? "os-pill-green" : "os-pill-gray"}`}>
                                            {form.watch("debrid.enabled") ? "Activo" : "Inactivo"}
                                        </span>
                                    </div>
                                    <div className="os-card">
                                        <OsToggle control={form.control} name="debrid.enabled"
                                            label="Activar servicio"
                                            desc="Habilita la integración con Real-Debrid u otros proveedores."
                                            onSave={commitToggle} />
                                        <div className="os-input-row">
                                            <p className="os-input-label">API Token</p>
                                            <Input {...form.register("debrid.apiKey")} type="password" placeholder="Real-Debrid / AllDebrid token..." />
                                        </div>
                                        <OsToggle control={form.control} name="debrid.streamAutoSelect"
                                            label="Selección automática del stream"
                                            desc="Elige el mejor stream disponible sin intervención manual."
                                            onSave={commitToggle} />
                                        <OsToggle control={form.control} name="debrid.includeDebridStreamInLibrary"
                                            label="Incluir en biblioteca"
                                            onSave={commitToggle} />
                                        <div className="os-input-row">
                                            <p className="os-input-label">Torrentio Addon URL</p>
                                            <Input {...form.register("debrid.torrentioUrl")} placeholder="https://torrentio.strem.fun/..." />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── Torrent ── */}
                            <TabsContent value="torrent" className="m-0">
                                <div className="os-heading">
                                    <h1>Torrents</h1>
                                    <p>Configurá tu cliente de descargas local.</p>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">qBittorrent</p>
                                    <div className="os-card">
                                        <div className="os-input-row">
                                            <p className="os-input-label">Host</p>
                                            <Input {...form.register("torrent.qbittorrentHost")} placeholder="http://localhost" />
                                        </div>
                                        <div className="os-input-grid">
                                            <div>
                                                <p className="os-input-label">Usuario</p>
                                                <Input {...form.register("torrent.qbittorrentUsername")} placeholder="admin" />
                                            </div>
                                            <div>
                                                <p className="os-input-label">Contraseña</p>
                                                <Input {...form.register("torrent.qbittorrentPassword")} type="password" placeholder="••••••" />
                                            </div>
                                        </div>
                                        <OsToggle control={form.control} name="torrent.showActiveTorrentCount"
                                            label="Mostrar contador de descargas activas"
                                            onSave={commitToggle} />
                                        <OsToggle control={form.control} name="torrent.hideTorrentList"
                                            label="Ocultar lista de torrents"
                                            onSave={commitToggle} />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── Apariencia ── */}
                            <TabsContent value="appearance" className="m-0">
                                <div className="os-heading">
                                    <h1>Apariencia</h1>
                                    <p>Personalizá los efectos visuales y el comportamiento de la interfaz.</p>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Efectos</p>
                                    <div className="os-card">
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
                                    </div>
                                </div>

                                <div className="os-group">
                                    <p className="os-group-label">Navegación</p>
                                    <div className="os-card">
                                        <OsToggle control={form.control} name="theme.expandSidebarOnHover"
                                            label="Sidebar se expande al pasar el cursor"
                                            onSave={commitToggle} />
                                        <OsToggle control={form.control} name="theme.hideTopNavbar"
                                            label="Ocultar barra superior"
                                            desc="Más espacio en pantalla, menos elementos de navegación."
                                            onSave={commitToggle} />
                                    </div>
                                </div>
                            </TabsContent>


                        </form>
                    </div>

                    {/* ── Save bar ── */}
                    <div className="os-save-bar">
                        <span className={`os-save-hint ${isDirty ? "dirty" : ""}`}>
                            {saveState === "saved"
                                ? "Cambios guardados"
                                : isDirty
                                    ? "Tenés cambios sin guardar"
                                    : ""}
                        </span>
                        <button
                            type="button"
                            disabled={saveState === "saving"}
                            onClick={form.handleSubmit(onSubmit)}
                            className={`os-save-btn ${saveState}`}
                        >
                            {saveState === "saved"
                                ? <><LucideCheckCircle2 size={14} /> Guardado</>
                                : saveState === "saving"
                                    ? <><LucideRefreshCw size={14} style={{ animation: "os-spin 0.8s linear infinite" }} /> Guardando...</>
                                    : <><LucideSave size={14} /> Guardar</>
                            }
                        </button>
                    </div>
                </Tabs>
            </div>
        </>
    )
}

// ─── OS Toggle Row ────────────────────────────────────────────────────────────

function OsToggle({ control, name, label, desc, onSave }: any) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="os-row">
                    <div className="os-row-left">
                        <p className="os-row-label">{label}</p>
                        {desc && <p className="os-row-desc">{desc}</p>}
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
    const paths = form.watch("library.libraryPaths") || []

    const addPath = async (p: string) => {
        if (!p || paths.includes(p)) return
        const next = [...paths, p]
        form.setValue("library.libraryPaths", next)
        await saveSettings(form.getValues())
        toast.success("Carpeta añadida")
    }

    const removePath = async (p: string) => {
        const next = paths.filter((x: string) => x !== p)
        form.setValue("library.libraryPaths", next)
        await saveSettings(form.getValues())
        toast.info("Carpeta eliminada")
    }

    return (
        <>
            {paths.length === 0
                ? <div className="os-paths-empty">No hay carpetas configuradas.</div>
                : <div className="os-paths">
                    {paths.map((p: string) => (
                        <div key={p} className="os-path">
                            <LucideFolder size={13} style={{ color: "rgba(249,115,22,0.6)", flexShrink: 0 }} />
                            <span className="os-path-name">{p}</span>
                            <button type="button" className="os-path-del" onClick={() => removePath(p)}>
                                <LucideTrash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            }
            <div className="os-paths-footer">
                <DirectorySelector
                    value=""
                    onSelect={(p) => addPath(p)}
                    shouldExist={true}
                    label="Añadir carpeta"
                />
                <button
                    type="button"
                    className="os-scan-btn"
                    disabled={isScanning}
                    onClick={() => scanLibrary({ enhanced: false, enhanceWithOfflineDatabase: false, skipLockedFiles: false, skipIgnoredFiles: false })}
                >
                    <LucideRefreshCw size={12} style={isScanning ? { animation: "os-spin 0.8s linear infinite" } : {}} />
                    {isScanning ? "Escaneando..." : "Escanear"}
                </button>
            </div>
        </>
    )
}