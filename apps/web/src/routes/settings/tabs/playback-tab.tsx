import { errorText } from "@/api/client/error-messages"
import React, { useState } from "react"
import { type Control, Controller, useFormContext } from "react-hook-form"
import { AnimatePresence, m } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { usePlayerStore, useUIStore, type BackgroundMusicTrack } from "@/lib/store"
import { ApiError, buildApiQuery } from "@/api/client/requests"
import { useWebSocket } from "@/hooks/use-websocket"
import { useApiWebSocketUrl } from "@/api/client/use-api-websocket-url"
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
import { useTransientFlag } from "@/components/ui/kinetics/icon-swap"
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
    // Fase "terminado": la barra se llena y queda un momento antes de plegarse.
    const [justDone, triggerDone] = useTransientFlag(1500)
    const collapseSpring = useSpringPreset("tabContent")

    const wsUrl = useApiWebSocketUrl()
    useWebSocket(wsUrl, React.useCallback((data: WebSocketMessage) => {
        if (data?.type !== WSEvents.SKIP_SCAN_STATUS) return
        const p = data.payload
        if (!p || p.mediaId !== BATCH_SCAN_MEDIA_ID) return
        setMessage(p.message ?? "")
        if (typeof p.percent === "number") setPercent(p.percent)
        if (p.status === "done") {
            setStatus("done")
            triggerDone()
        } else if (p.status === "error") setStatus("error")
        else setStatus("running")
    }, [triggerDone]))

    const handleScan = async () => {
        if (status === "running") return
        setStatus("running")
        setMessage("Iniciando el análisis…")
        setPercent(0)
        try {
            await buildApiQuery<unknown>({
                endpoint: API_ENDPOINTS.MEDIASTREAM.ScanAllSkipTimes.endpoint,
                method: API_ENDPOINTS.MEDIASTREAM.ScanAllSkipTimes.methods[0],
            })
        } catch (err) {
            // Ya hay uno corriendo (p. ej. se inició antes de recargar la página):
            // no es un error, se sigue su progreso por WebSocket.
            if (err instanceof ApiError && err.status === 409) {
                setMessage("Ya hay un análisis en curso. Mostrando su progreso…")
                return
            }
            setStatus("error")
            setMessage("No se pudo iniciar el análisis. Inténtalo de nuevo.")
        }
    }

    const running = status === "running"
    const showBar = running || (justDone && status === "done")

    return (
        <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 max-w-lg">
                    <p className="text-xs font-bold text-on-surface">Buscar intros y créditos en toda la biblioteca</p>
                    <p className={cn("text-2xs leading-tight", status === "error" ? "text-status-error" : "text-label-2")}>
                        {status === "idle"
                            ? "Analiza las series locales y marca dónde empiezan la intro y los créditos."
                            : (message || "Buscando intros y créditos…")}
                    </p>
                </div>
                <Button
                    intent="primary"
                    size="md"
                    onClick={handleScan}
                    loading={running}
                    leftIcon={!running ? <IconMediaWand className="w-3.5 h-3.5" /> : undefined}
                    iconSpacing="0.375rem"
                    className="shrink-0"
                >
                    {running ? "Analizando…" : "Analizar ahora"}
                </Button>
            </div>
            {/* El espacio sobre la barra va dentro del colapso (pt-3), no como space-y del padre. */}
            <AnimatePresence initial={false}>
                {showBar && (
                    <m.div
                        key="skip-scan-bar"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={collapseSpring}
                        className="overflow-hidden"
                    >
                        <div className="pt-3">
                            <div className="w-full h-1.5 bg-[var(--neutral-elev-3)] rounded-full relative overflow-hidden">
                                <div
                                    className="w-full h-full bg-brand-accent rounded-full origin-left transition-transform duration-slow ease-smooth-out"
                                    style={{ transform: `scaleX(${status === "done" ? 1 : Math.min(100, Math.max(2, percent)) / 100})` }}
                                />
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const AUDIO_PROFILES = [
    { id: "latino" as const, flag: "🇲🇽", title: "Español latino", desc: "Mario Castañeda, René García, etc." },
    { id: "castellano" as const, flag: "🇪🇸", title: "Castellano", desc: "Doblaje oficial de España." },
    { id: "japanese" as const, flag: "🇯🇵", title: "Japonés (original)", desc: "Audio original con subtítulos." },
    { id: "english" as const, flag: "🇺🇸", title: "Inglés", desc: "Doblaje de Funimation y Crunchyroll." },
]

export function PlaybackTab({ control }: PlaybackTabProps) {
    const cardSpring = useSpringPreset("cardHover")
    // Colapso de los bloques que dependen de un switch (mismo resorte que SectionBar).
    const collapseSpring = useSpringPreset("tabContent")
    const {
        preferredAudioProfile,
        setPreferredAudioProfile,
        autoSkipIntro,
        setAutoSkipIntro,
        autoSkipOutro,
        setAutoSkipOutro,
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
            toast.warning("Elige primero la carpeta de música")
            return
        }
        setIsScanningMusic(true)
        try {
            type MusicScanPayload = { data?: { tracks?: BackgroundMusicTrack[] }; tracks?: BackgroundMusicTrack[] }
            const payload = await buildApiQuery<MusicScanPayload, { dir: string }>({
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
            toast.success(`${tracks.length} ${tracks.length === 1 ? "pista encontrada" : "pistas encontradas"}`)
        } catch (err) {
            toast.error(errorText(err, "No se pudo leer la carpeta de música"))
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
                variant="content"
                id="audio-profile"
                label="Doblaje e idioma principal"
                description="Qué pista de audio se elige sola cuando el archivo trae varias."
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
                                            whileTap={{ scale: 0.96 }}
                                            transition={cardSpring}
                                            onClick={() => {
                                                field.onChange(p.id)
                                                setPreferredAudioProfile(p.id)
                                            }}
                                            aria-pressed={isSelected}
                                            className={cn(
                                                "flex flex-col p-3.5 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                                                isSelected
                                                    ? "bg-[var(--neutral-elev-3)] border-[var(--selected-bg)] ring-1 ring-[color-mix(in_srgb,var(--selected-bg)_40%,transparent)]"
                                                    : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xl select-none">{p.flag}</span>
                                                {isSelected && <span className="w-2 h-2 rounded-full bg-[var(--selected-bg)] animate-success-pop" />}
                                            </div>
                                            <span className={cn("text-xs font-bold truncate", isSelected ? "text-label-1 font-black" : "text-on-surface")}>
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

                <div className="pt-2 border-t border-[var(--neutral-separator)]">
                    <Controller
                        control={control}
                        name="library.autoDisableSubtitlesWhenDubbed"
                        render={({ field }) => (
                            <OsToggle
                                label="Ocultar subtítulos si el audio está doblado"
                                description="Apaga los subtítulos al reproducir en español latino o castellano."
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
                variant="content"
                id="smart-skip"
                label="Saltos automáticos"
                description="Salta intros y créditos, y detecta dónde están en segundo plano."
                icon={IconMediaSkipNext}
                badge={
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/25">
                        {[autoSkipIntro, autoSkipOutro].filter(Boolean).length === 1 ? "1 activo" : `${[autoSkipIntro, autoSkipOutro].filter(Boolean).length} activos`}
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
                            label="Saltar intro automáticamente"
                            description="Omite la canción de apertura (Cha-La Head-Cha-La, Dan Dan…) sin pulsar ningún botón."
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
                            label="Saltar créditos automáticamente"
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
                    name="library.autoDetectSkipTimes"
                    render={({ field }) => (
                        <DirtyOsToggle
                            control={control}
                            name="library.autoDetectSkipTimes"
                            label="Detectar intros y créditos en segundo plano"
                            description="Analiza el audio y los subtítulos para ubicar las intros y los créditos."
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
                variant="content"
                id="playback-continuity"
                label="Continuidad de reproducción"
                description="Qué pasa al terminar un episodio y cómo se guarda tu progreso."
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
                            label="Reproducir el siguiente episodio solo"
                            description="Empieza el siguiente episodio al terminar el actual."
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
                            label="Guardar tu progreso"
                            description="Recuerda el punto exacto para que continúes donde lo dejaste, en cualquier dispositivo."
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
                variant="content"
                id="ui-audio"
                label="Sonidos de la interfaz y música de fondo"
                description="Sonidos al usar los menús y música de fondo mientras exploras."
                icon={IconStatusMusic}
                badge={
                    <span title="Solo este dispositivo" className="text-3xs px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/20">
                        Local
                    </span>
                }
                collapsible
                defaultOpen={true}
            >
                {/* Cada switch va con su bloque dependiente en un div propio: así el bloque
                    animado no es hijo directo de .sectionbar-divide y su margen y su borde
                    viajan dentro del colapso en vez de saltar. */}
                <div>
                    <Controller
                        control={control}
                        name="theme.uiSoundsEnabled"
                        render={({ field }) => (
                            <OsToggle
                                label="Sonidos de la interfaz"
                                description="Sonidos suaves al pulsar, abrir menús o elegir opciones."
                                checked={field.value !== undefined ? !!field.value : uiSoundsEnabled}
                                onChange={(v) => {
                                    field.onChange(v)
                                    setUiSoundsEnabled(v)
                                    persistThemePatch({ uiSoundsEnabled: v })
                                }}
                            />
                        )}
                    />
                    <AnimatePresence initial={false}>
                        {uiSoundsEnabled && (
                            <m.div
                                key="ui-sounds"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={collapseSpring}
                                className="overflow-hidden"
                            >
                                <div className="mt-3.5 border-t border-white/[0.07]">
                                    <Controller
                                        control={control}
                                        name="theme.uiSoundsVolume"
                                        render={({ field }) => (
                                            <RangeSlider
                                                label="Volumen de los sonidos"
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
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>

                <div>
                    <Controller
                        control={control}
                        name="theme.bgMusicEnabled"
                        render={({ field }) => (
                            <OsToggle
                                label="Música de fondo"
                                description="Reproduce música ambiental mientras navegas por KameHouse."
                                checked={field.value !== undefined ? !!field.value : bgMusicEnabled}
                                onChange={(v) => {
                                    field.onChange(v)
                                    setBgMusicEnabled(v)
                                    persistThemePatch({ bgMusicEnabled: v })
                                }}
                            />
                        )}
                    />
                    <AnimatePresence initial={false}>
                        {bgMusicEnabled && (
                            <m.div
                                key="bg-music"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={collapseSpring}
                                className="overflow-hidden"
                            >
                                <div className="mt-3.5 border-t border-white/[0.07] space-y-3.5 sectionbar-divide">
                                    <Controller
                                        control={control}
                                        name="theme.seriesSoundtrackMode"
                                        render={({ field }) => (
                                            <OsToggle
                                                label="Banda sonora según la serie"
                                                description="Reproduce el opening japonés de cada serie en versión instrumental, sin voz, al expandir su tarjeta o explorar sus episodios."
                                                checked={field.value !== undefined ? !!field.value : seriesSoundtrackMode}
                                                onChange={(v) => {
                                                    field.onChange(v)
                                                    setSeriesSoundtrackMode(v)
                                                    persistThemePatch({ seriesSoundtrackMode: v })
                                                }}
                                            />
                                        )}
                                    />
                                    <div className="pb-5 space-y-1">
                                        <Controller
                                            control={control}
                                            name="theme.bgMusicVolume"
                                            render={({ field }) => (
                                                <RangeSlider
                                                    label="Volumen de la música de fondo"
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
                                        <div className="mx-5 p-4 bg-[var(--neutral-elev-2)] rounded-xl border border-[var(--neutral-separator)] space-y-2.5">
                                            <p className="text-xs font-bold text-on-surface">Carpeta de música</p>
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
                                                                placeholder="Carpeta con archivos MP3, FLAC u OGG"
                                                            />
                                                        )}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={handleScanMusic}
                                                    disabled={isScanningMusic}
                                                    className="shrink-0"
                                                >
                                                    {isScanningMusic ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconMediaVolume2 className="w-3.5 h-3.5" />}
                                                    <span>{isScanningMusic ? "Buscando…" : "Buscar pistas"}</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                5. MODOS DE EXPERIENCIA (MARATÓN Y TV)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="experience-modes"
                label="Maratón y modo TV"
                description="Ajustes para ver muchos episodios seguidos y para usar la app en un televisor."
                icon={IconStatusTv}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.marathonMode"
                    render={({ field }) => (
                        <OsToggle
                            label="Maratón"
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
                            label="Modo TV"
                            description="Agranda los controles y se maneja con mando a distancia o teclado. Al activarlo también se activan saltar intro y créditos, y el modo Maratón."
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

