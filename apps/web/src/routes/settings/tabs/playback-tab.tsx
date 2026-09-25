import React, { useState } from "react"
import { type Control, Controller, useFormContext } from "react-hook-form"
import { m } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { usePlayerStore, useUIStore, type BackgroundMusicTrack } from "@/lib/store"
import { buildSeaQuery } from "@/api/client/requests"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { WSEvents, type WebSocketMessage } from "@/lib/server/ws-events"
import { toast } from "sonner"
import { RangeSlider } from "@/components/settings/range-slider"
import { DirectorySelector } from "@/components/shared/directory-selector"
import { Button } from "@/components/ui/button"
import { IconUiSpinner, IconMediaWand, IconStatusHeadphones, IconMediaSkipNext, IconMediaQueue, IconStatusMusic, IconMediaVolume2, IconStatusTv } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { OsToggle, DirtyOsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useShallow } from "zustand/react/shallow"
import { persistThemePatch } from "@/lib/server/persist-settings"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

interface PlaybackTabProps {
    control: Control<SettingsFormValues>
}

const BATCH_SCAN_MEDIA_ID = -1

function LibrarySkipScanRow() {
    const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle")
    const [message, setMessage] = useState("")
    const [percent, setPercent] = useState(0)

    const wsUrl = React.useMemo(() => getApiWebSocketUrl(), [])
    useWebSocket(wsUrl, React.useCallback((data: WebSocketMessage) => {
        if (data?.type !== WSEvents.SKIP_SCAN_STATUS) return
        const p = data.payload
        if (!p || p.mediaId !== BATCH_SCAN_MEDIA_ID) return
        setMessage(p.message ?? "")
        if (typeof p.percent === "number") setPercent(p.percent)
        if (p.status === "done") setStatus("done")
        else if (p.status === "error") setStatus("error")
        else setStatus("running")
    }, []))

    const handleScan = async () => {
        if (status === "running") return
        setStatus("running")
        setMessage("Iniciando escaneo de biblioteca...")
        setPercent(0)
        try {
            await buildSeaQuery<unknown>({
                endpoint: API_ENDPOINTS.MEDIASTREAM.ScanAllSkipTimes.endpoint,
                method: API_ENDPOINTS.MEDIASTREAM.ScanAllSkipTimes.methods[0],
            })
        } catch {
            setStatus("error")
            setMessage("No se pudo iniciar el escaneo.")
        }
    }

    const running = status === "running"

    return (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 max-w-lg">
                    <p className="text-xs font-bold text-on-surface">Escanear marcas de Skip en toda la biblioteca</p>
                    <p className={cn("text-2xs leading-tight", status === "error" ? "text-red-400" : "text-on-surface-variant/70")}>
                        {status === "idle"
                            ? "Analiza todas las series locales para detectar marcas de Openings y Endings automáticamente."
                            : (message || "Detectando marcas de skip...")}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleScan}
                    disabled={running}
                    className={cn(
                        "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-[background-color,border-color,color,filter,transform] duration-fast ease-smooth-out active:scale-95",
                        running
                            ? "bg-brand-accent/10 border border-brand-accent/20 text-brand-accent cursor-not-allowed"
                            : "bg-brand-accent hover:brightness-110 text-on-primary shadow-sm"
                    )}
                >
                    {running ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconMediaWand className="w-3.5 h-3.5" />}
                    <span>{running ? "ESCANEANDO..." : "ESCANEAR AHORA"}</span>
                </button>
            </div>
            {running && (
                <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                    <div
                        className="absolute left-0 h-full bg-brand-accent rounded-full transition-[width] duration-slow ease-smooth-out"
                        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                    />
                </div>
            )}
        </div>
    )
}

const AUDIO_PROFILES = [
    { id: "latino" as const, flag: "🇲🇽", title: "Español Latino", desc: "Mario Castañeda, René García, etc." },
    { id: "castellano" as const, flag: "🇪🇸", title: "Castellano", desc: "Doblaje oficial de España." },
    { id: "japanese" as const, flag: "🇯🇵", title: "Japonés (Original)", desc: "Pistas con subtítulos automáticos." },
    { id: "english" as const, flag: "🇺🇸", title: "Inglés", desc: "Funimation / Crunchyroll." },
]

export function PlaybackTab({ control }: PlaybackTabProps) {
    const cardSpring = useSpringPreset("cardHover")
    const {
        preferredAudioProfile,
        setPreferredAudioProfile,
        autoSkipIntro,
        setAutoSkipIntro,
        autoSkipOutro,
        setAutoSkipOutro,
        autoSkipFiller,
        setAutoSkipFiller,
        autoDisableSubtitlesWhenDubbed,
        setAutoDisableSubtitlesWhenDubbed,
        marathonMode,
        setMarathonMode,
        tvMode,
        setTvMode,
    } = usePlayerStore(
        useShallow(s => ({
            preferredAudioProfile: s.preferredAudioProfile,
            setPreferredAudioProfile: s.setPreferredAudioProfile,
            autoSkipIntro: s.autoSkipIntro,
            setAutoSkipIntro: s.setAutoSkipIntro,
            autoSkipOutro: s.autoSkipOutro,
            setAutoSkipOutro: s.setAutoSkipOutro,
            autoSkipFiller: s.autoSkipFiller,
            setAutoSkipFiller: s.setAutoSkipFiller,
            autoDisableSubtitlesWhenDubbed: s.autoDisableSubtitlesWhenDubbed,
            setAutoDisableSubtitlesWhenDubbed: s.setAutoDisableSubtitlesWhenDubbed,
            marathonMode: s.marathonMode,
            setMarathonMode: s.setMarathonMode,
            tvMode: s.tvMode,
            setTvMode: s.setTvMode,
        }))
    )
    const {
        bgMusicEnabled,
        setBgMusicEnabled,
        bgMusicVolume,
        setBgMusicVolume,
        bgMusicDir,
        setBgMusicDir,
        setBgMusicTracks,
        seriesSoundtrackMode,
        setSeriesSoundtrackMode,
        uiSoundsEnabled,
        setUiSoundsEnabled,
        uiSoundsVolume,
        setUiSoundsVolume,
    } = useUIStore(
        useShallow(s => ({
            bgMusicEnabled: s.bgMusicEnabled,
            setBgMusicEnabled: s.setBgMusicEnabled,
            bgMusicVolume: s.bgMusicVolume,
            setBgMusicVolume: s.setBgMusicVolume,
            bgMusicDir: s.bgMusicDir,
            setBgMusicDir: s.setBgMusicDir,
            setBgMusicTracks: s.setBgMusicTracks,
            seriesSoundtrackMode: s.seriesSoundtrackMode,
            setSeriesSoundtrackMode: s.setSeriesSoundtrackMode,
            uiSoundsEnabled: s.uiSoundsEnabled,
            setUiSoundsEnabled: s.setUiSoundsEnabled,
            uiSoundsVolume: s.uiSoundsVolume,
            setUiSoundsVolume: s.setUiSoundsVolume,
        }))
    )

    const { setValue } = useFormContext<SettingsFormValues>()
    const [musicDirInput, setMusicDirInput] = useState(bgMusicDir)
    const [isScanningMusic, setIsScanningMusic] = useState(false)

    const handleScanMusic = async () => {
        const dir = musicDirInput.trim()
        if (!dir) {
            toast.error("Selecciona una carpeta primero")
            return
        }
        setIsScanningMusic(true)
        try {
            type MusicScanPayload = { data?: { tracks?: BackgroundMusicTrack[] }; tracks?: BackgroundMusicTrack[] }
            const payload = await buildSeaQuery<MusicScanPayload, { dir: string }>({
                endpoint: API_ENDPOINTS.MUSIC.ScanBackgroundMusic.endpoint,
                method: API_ENDPOINTS.MUSIC.ScanBackgroundMusic.methods[0],
                params: { dir },
            })
            const tracks = payload?.data?.tracks ?? payload?.tracks ?? []
            if (!tracks.length) {
                toast.error("No se encontraron archivos de audio en esa carpeta")
                setBgMusicTracks([])
                setBgMusicDir(dir)
                setValue("theme.bgMusicDir", dir, { shouldDirty: true })
                setValue("theme.bgMusicTracks", [], { shouldDirty: true })
                return
            }
            setBgMusicDir(dir)
            setBgMusicTracks(tracks)
            setValue("theme.bgMusicDir", dir, { shouldDirty: true })
            setValue("theme.bgMusicTracks", tracks, { shouldDirty: true })
            toast.success(`${tracks.length} pista(s) de música encontradas`)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al escanear la carpeta de música")
        } finally {
            setIsScanningMusic(false)
        }
    }

    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═════════════════════════════════════════════════════════════════
                1. DOBLAJE Y PERFIL DE AUDIO
               ════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="audio-profile"
                label="Doblaje e Idioma Principal"
                description="Preferencia automática de pista de audio en archivos con doblajes múltiples."
                icon={IconStatusHeadphones}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.preferredAudioProfile"
                    render={({ field }) => {
                        const currentProfile = field.value || preferredAudioProfile || "latino"
                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {AUDIO_PROFILES.map((p) => {
                                    const isSelected = currentProfile === p.id
                                    return (
                                        <m.button
                                            key={p.id}
                                            type="button"
                                            whileHover={{ scale: 1.025, y: -2 }}
                                            whileTap={{ scale: 0.97 }}
                                            transition={cardSpring}
                                            onClick={() => {
                                                field.onChange(p.id)
                                                setPreferredAudioProfile(p.id)
                                            }}
                                            className={cn(
                                                "flex flex-col p-3.5 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                                                isSelected
                                                    ? "bg-surface-container-high/80 border-white/30 border-t-white/50 shadow-[shadow:var(--glass-highlight-lg),0_8px_20px_rgba(0,0,0,0.6)] ring-1 ring-white/30"
                                                    : "bg-surface-container-lowest/60 border-white/10 border-t-white/20 hover:border-white/25 hover:bg-white/[0.04] shadow-glass-highlight-sm"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xl select-none">{p.flag}</span>
                                                {isSelected && <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-success-pop" />}
                                            </div>
                                            <span className={cn("text-xs font-bold truncate", isSelected ? "text-white font-black" : "text-on-surface")}>
                                                {p.title}
                                            </span>
                                            <span className="text-3xs text-on-surface-variant line-clamp-1 mt-0.5">{p.desc}</span>
                                        </m.button>
                                    )
                                })}
                            </div>
                        )
                    }}
                />

                <div className="pt-2 border-t border-white/[0.05]">
                    <Controller
                        control={control}
                        name="library.autoDisableSubtitlesWhenDubbed"
                        render={({ field }) => (
                            <OsToggle
                                label="Ocultar subtítulos si el audio está doblado"
                                description="Desactiva subtítulos automáticamente al reproducir en Español Latino o Castellano."
                                checked={field.value !== undefined ? !!field.value : autoDisableSubtitlesWhenDubbed}
                                onChange={(v) => {
                                    field.onChange(v)
                                    setAutoDisableSubtitlesWhenDubbed(v)
                                }}
                            />
                        )}
                    />
                </div>
            </SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                2. SALTO INTELIGENTE (SMART SKIP)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="smart-skip"
                label="Salto Inteligente (Smart Skip)"
                description="Omisión de openings, endings, relleno y detección acústica en segundo plano."
                icon={IconMediaSkipNext}
                badge={
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/25">
                        {[autoSkipIntro, autoSkipOutro, autoSkipFiller].filter(Boolean).length} activos
                    </span>
                }
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.autoSkipIntro"
                    render={({ field }) => (
                        <OsToggle
                            label="Saltar Opening (Intro) automáticamente"
                            description="Omite canciones iniciales (Cha-La Head-Cha-La, Dan Dan, etc.) sin presionar botones."
                            checked={field.value !== undefined ? !!field.value : autoSkipIntro}
                            onChange={(v) => {
                                field.onChange(v)
                                setAutoSkipIntro(v)
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.autoSkipOutro"
                    render={({ field }) => (
                        <OsToggle
                            label="Saltar Ending (Créditos) automáticamente"
                            description="Pasa directamente al siguiente episodio al iniciar los créditos finales."
                            checked={field.value !== undefined ? !!field.value : autoSkipOutro}
                            onChange={(v) => {
                                field.onChange(v)
                                setAutoSkipOutro(v)
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.autoSkipFiller"
                    render={({ field }) => (
                        <OsToggle
                            label="Saltar Relleno (Filler) automáticamente"
                            description="Avanza al siguiente episodio cuando el actual es de relleno según las marcas disponibles."
                            checked={field.value !== undefined ? !!field.value : autoSkipFiller}
                            onChange={(v) => {
                                field.onChange(v)
                                setAutoSkipFiller(v)
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.autoDetectSkipTimes"
                    render={({ field }) => (
                        <DirtyOsToggle
                            control={control}
                            name="library.autoDetectSkipTimes"
                            label="Detectar marcas Skip en segundo plano"
                            description="Analiza huellas acústicas y subtítulos para ubicar intros y otros automáticamente."
                            checked={!!field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
                <div className="p-5">
                    <LibrarySkipScanRow />
                </div>
            </SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                3. CONTINUIDAD Y COLA DE REPRODUCCIÓN
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="playback-continuity"
                label="Continuidad y Cola de Reproducción"
                description="Comportamiento al terminar un episodio y sincronización de progreso."
                icon={IconMediaQueue}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.autoPlayNextEpisode"
                    render={({ field }) => (
                        <DirtyOsToggle
                            control={control}
                            name="library.autoPlayNextEpisode"
                            label="Reproducción Continua (Autoplay)"
                            description="Inicia automáticamente el siguiente capítulo al concluir el actual."
                            checked={!!field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.enableWatchContinuity"
                    render={({ field }) => (
                        <DirtyOsToggle
                            control={control}
                            name="library.enableWatchContinuity"
                            label="Guardar Progreso en la Nube / Base de Datos"
                            description="Recuerda el segundo exacto para continuar donde lo dejaste en cualquier dispositivo."
                            checked={!!field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                4. AUDIO DE INTERFAZ Y MÚSICA AMBIENTAL
               ════════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="ui-audio"
                label="Audio de Interfaz y Música Ambiental"
                description="Efectos de sonido de menú y banda sonora de fondo mientras exploras."
                icon={IconStatusMusic}
                badge={
                    <span className="text-3xs font-mono px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                        Local
                    </span>
                }
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="theme.uiSoundsEnabled"
                    render={({ field }) => (
                        <OsToggle
                            label="Efectos de Sonido en la Interfaz"
                            description="Sonidos sutiles retro al hacer clics, abrir menús o seleccionar opciones."
                            checked={field.value !== undefined ? !!field.value : uiSoundsEnabled}
                            onChange={(v) => {
                                field.onChange(v)
                                setUiSoundsEnabled(v)
                                persistThemePatch({ uiSoundsEnabled: v })
                            }}
                        />
                    )}
                />
                {uiSoundsEnabled && (
                    <div className="p-5 bg-white/[0.01]">
                        <Controller
                            control={control}
                            name="theme.uiSoundsVolume"
                            render={({ field }) => (
                                <RangeSlider
                                    label="Volumen de Efectos"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={field.value !== undefined ? field.value : uiSoundsVolume}
                                    onChange={(v) => {
                                        field.onChange(v)
                                        setUiSoundsVolume(v)
                                        persistThemePatch({ uiSoundsVolume: v })
                                    }}
                                    formatValue={(v) => `${Math.round(v * 100)}%`}
                                />
                            )}
                        />
                    </div>
                )}

                <Controller
                    control={control}
                    name="theme.bgMusicEnabled"
                    render={({ field }) => (
                        <OsToggle
                            label="Música Ambiental de Fondo"
                            description="Reproduce pistas de audio ambiental mientras navegas por la plataforma."
                            checked={field.value !== undefined ? !!field.value : bgMusicEnabled}
                            onChange={(v) => {
                                field.onChange(v)
                                setBgMusicEnabled(v)
                                persistThemePatch({ bgMusicEnabled: v })
                            }}
                        />
                    )}
                />
                {bgMusicEnabled && (
                    <>
                        <Controller
                            control={control}
                            name="theme.seriesSoundtrackMode"
                            render={({ field }) => (
                                <OsToggle
                                    label="Soundtrack Contextual por Serie"
                                    description="Reproduce automáticamente los temas oficiales de cada serie (DB, DBZ, GT, Super, Daima) al explorar su catálogo."
                                    checked={field.value !== undefined ? !!field.value : seriesSoundtrackMode}
                                    onChange={(v) => {
                                        field.onChange(v)
                                        setSeriesSoundtrackMode(v)
                                        persistThemePatch({ seriesSoundtrackMode: v })
                                    }}
                                />
                            )}
                        />
                        <div className="p-5 space-y-4 bg-white/[0.01]">
                            <Controller
                                control={control}
                                name="theme.bgMusicVolume"
                                render={({ field }) => (
                                    <RangeSlider
                                        label="Volumen de Música Ambiental"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={field.value !== undefined ? field.value : bgMusicVolume}
                                        onChange={(v) => {
                                            field.onChange(v)
                                            setBgMusicVolume(v)
                                            persistThemePatch({ bgMusicVolume: v })
                                        }}
                                        formatValue={(v) => `${Math.round(v * 100)}%`}
                                    />
                                )}
                            />
                            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/10 space-y-2.5">
                                <p className="text-xs font-bold text-on-surface uppercase tracking-wider">Carpeta de Música Local</p>
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <div className="flex-1">
                                        <Controller
                                            control={control}
                                            name="theme.bgMusicDir"
                                            render={({ field }) => (
                                                <DirectorySelector
                                                    value={field.value !== undefined ? field.value : musicDirInput}
                                                    onSelect={(path) => {
                                                        field.onChange(path)
                                                        setMusicDirInput(path)
                                                        setBgMusicDir(path)
                                                    }}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value)
                                                        setMusicDirInput(e.target.value)
                                                        setBgMusicDir(e.target.value)
                                                    }}
                                                    placeholder="Ruta con archivos MP3 / FLAC / OGG"
                                                />
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleScanMusic}
                                        disabled={isScanningMusic}
                                        className="bg-brand-accent text-on-primary shrink-0 font-bold text-xs"
                                    >
                                        {isScanningMusic ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconMediaVolume2 className="w-3.5 h-3.5" />}
                                        <span>{isScanningMusic ? "Escaneando..." : "Escanear Pistas"}</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                5. MODOS DE EXPERIENCIA (MARATÓN Y TV)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="experience-modes"
                label="Modos de Experiencia (Maratón y TV)"
                description="Configuraciones ergonómicas para maratones intensos y televisores."
                icon={IconStatusTv}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.marathonMode"
                    render={({ field }) => (
                        <OsToggle
                            label="Modo Maratón"
                            description="Encadena episodios sin pantallas de confirmación intermedias ni pausas."
                            checked={field.value !== undefined ? !!field.value : marathonMode}
                            onChange={(v) => {
                                field.onChange(v)
                                setMarathonMode(v)
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.tvMode"
                    render={({ field }) => (
                        <OsToggle
                            label="Modo TV (Interfaz Leanback)"
                            description="Aumenta los tamaños táctiles y optimiza para control remoto o teclado a distancia. Al activarlo también habilita auto-skip y maratón."
                            checked={field.value !== undefined ? !!field.value : tvMode}
                            onChange={(v) => {
                                field.onChange(v)
                                setTvMode(v)
                                if (v) {
                                    setValue("library.autoSkipIntro", true, { shouldDirty: true })
                                    setValue("library.autoSkipOutro", true, { shouldDirty: true })
                                    setValue("library.marathonMode", true, { shouldDirty: true })
                                    setAutoSkipIntro(true)
                                    setAutoSkipOutro(true)
                                    setMarathonMode(true)
                                } else {
                                    // Al desactivar TV se revierten los flags que
                                    // el modo forzó, para no dejarlos pegados.
                                    setValue("library.autoSkipIntro", false, { shouldDirty: true })
                                    setValue("library.autoSkipOutro", false, { shouldDirty: true })
                                    setValue("library.marathonMode", false, { shouldDirty: true })
                                    setAutoSkipIntro(false)
                                    setAutoSkipOutro(false)
                                    setMarathonMode(false)
                                }
                            }}
                        />
                    )}
                />
            </SectionBar>

        </div>
    )
}

