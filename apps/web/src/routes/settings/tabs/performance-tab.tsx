import { errorText } from "@/api/client/error-messages"
import React, { useEffect } from "react"
import { type Control, Controller, useFormContext, useFormState, useWatch } from "react-hook-form"
import { m } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { usePerformanceStore, type PerformanceProfile } from "@/lib/hardware/performance-store"
import { useShallow } from "zustand/react/shallow"
import { useGetFFmpegStatus, useInstallFFmpeg } from "@/api/hooks/mediastream.hooks"
import { IconStatusSparkles, IconStatusZap, IconStatusActivity, IconUiShield, IconUiRefresh, IconMediaPlay, IconStatusServer, IconUiSpinner, IconUiDownload, IconMediaGauge } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { RadioCardGroup } from "@/components/settings/radio-card-group"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { OsToggle, DirtyOsSelect, DirtyOsInput, DirtyPill } from "../components"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

interface PerformanceTabProps {
    control: Control<SettingsFormValues>
    searchQuery?: string
}

const PROFILES: { id: PerformanceProfile; label: string; desc: string; icon: React.ElementType; badge: string }[] = [
    { id: "auto", label: "Automático", desc: "Elige el perfil según las capacidades de tu equipo.", icon: IconStatusSparkles, badge: "Recomendado" },
    { id: "ultra", label: "Ultra (alto rendimiento)", desc: "Todos los efectos visuales, con vidrio y aceleración por GPU.", icon: IconStatusZap, badge: "Máximo" },
    { id: "balanced", label: "Equilibrado", desc: "Equilibrio entre efectos visuales y fluidez (60 FPS estables).", icon: IconStatusActivity, badge: "Medio" },
    { id: "eco", label: "Ahorro (equipo modesto)", desc: "Sin desenfoques pesados y con menos uso de memoria y batería.", icon: IconUiShield, badge: "Mínimo" },
]

const TIER_LABELS: Record<string, string> = {
    high: "alto",
    balanced: "medio",
    low_power: "bajo consumo",
}

const HW_ACCEL_OPTIONS = [
    { value: "auto", label: "Automático (recomendado)", desc: "Detecta NVENC, QuickSync, VAAPI y AMF", badge: "AUTO" },
    { value: "nvenc", label: "NVIDIA NVENC", desc: "GeForce GTX y RTX", badge: "NVENC" },
    { value: "qsv", label: "Intel QuickSync (QSV)", desc: "Gráficos Intel (6.ª generación o posterior)", badge: "QSV" },
    { value: "amf", label: "AMD AMF", desc: "AMD Radeon (RDNA y serie RX)", badge: "AMF" },
    { value: "videotoolbox", label: "VideoToolbox (macOS)", desc: "Apple Silicon (M1/M2/M3/M4)", badge: "APPLE" },
    { value: "disabled", label: "Desactivado (CPU)", desc: "Convierte con el procesador, sin usar la GPU", badge: "CPU" },
]

const PRESET_OPTIONS = [
    { value: "ultrafast", label: "Ultrarrápido", desc: "Mínimo consumo de CPU", badge: "Poca CPU" },
    { value: "fast", label: "Rápido", desc: "Equilibrio entre calidad y rendimiento", badge: "Recomendado" },
    { value: "medium", label: "Medio", desc: "Calidad estándar", badge: "Calidad" },
    { value: "slow", label: "Lento", desc: "Máxima compresión", badge: "Compacto" },
]

type PlaybackPolicy = "auto" | "direct-only" | "transcode-strict"

const POLICY_OPTIONS: { value: PlaybackPolicy; label: string; desc: string; badge: string }[] = [
    { value: "auto", label: "Automático (recomendado)", desc: "Reproduce el archivo tal cual y solo lo convierte si tu dispositivo no puede reproducirlo.", badge: "Auto" },
    { value: "direct-only", label: "Solo original", desc: "Nunca convierte el video. Si tu dispositivo no puede reproducirlo, no se reproducirá.", badge: "Original" },
    { value: "transcode-strict", label: "Siempre convertido", desc: "Convierte siempre a H.264 para que funcione en cualquier dispositivo.", badge: "Convertido" },
]

type MediastreamValues = SettingsFormValues["mediastream"] | undefined

function policyOf(m: MediastreamValues): PlaybackPolicy {
    if (m?.directPlayOnly) return "direct-only"
    if (m?.transcodeEnabled && m?.disableAutoSwitchToDirectPlay) return "transcode-strict"
    return "auto"
}

export function PerformanceTab({ control, searchQuery }: PerformanceTabProps) {
    const transcodeHwAccel = useWatch({ control, name: "mediastream.transcodeHwAccel" })
    // Dirty por sección para controles sin slot propio (radio, policy buttons).
    const { dirtyFields } = useFormState({ control })
    const msDirty = (dirtyFields as Record<string, Record<string, unknown> | undefined>)?.mediastream
    const engineDirty = !!(msDirty?.transcodeHwAccel || msDirty?.transcodePreset)
    const policyDirty = !!(msDirty?.transcodeEnabled || msDirty?.directPlayOnly || msDirty?.disableAutoSwitchToDirectPlay)
    const {
        hardwareSpecs,
        isDetecting,
        detectHardware,
        performanceProfile,
        setPerformanceProfile,
        autoGovernorEnabled,
        setAutoGovernorEnabled,
        getEffectiveTier,
    } = usePerformanceStore(
        useShallow((state) => ({
            hardwareSpecs: state.hardwareSpecs,
            isDetecting: state.isDetecting,
            detectHardware: state.detectHardware,
            performanceProfile: state.performanceProfile,
            setPerformanceProfile: state.setPerformanceProfile,
            autoGovernorEnabled: state.autoGovernorEnabled,
            setAutoGovernorEnabled: state.setAutoGovernorEnabled,
            getEffectiveTier: state.getEffectiveTier,
        }))
    )

    useEffect(() => {
        if (!hardwareSpecs) {
            detectHardware().catch(() => {})
        }
    }, [hardwareSpecs, detectHardware])

    const handleRefreshHardware = async () => {
        toast.loading("Analizando el hardware…", { id: "hw-probe" })
        try {
            const specs = await detectHardware(true)
            toast.success(`Hardware analizado: ${specs.isDedicatedGpu ? "GPU dedicada detectada" : "GPU integrada detectada"}`, { id: "hw-probe" })
        } catch {
            toast.error("No se pudo completar el análisis de hardware", { id: "hw-probe" })
        }
    }

    const effectiveTier = getEffectiveTier()
    const cardSpring = useSpringPreset("cardHover")

    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. DIAGNÓSTICO DE HARDWARE Y PERFIL PRINCIPAL
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="hardware-profile"
                label="Perfil de rendimiento"
                description="Equilibrio entre fidelidad visual y consumo de recursos en tu equipo."
                icon={IconStatusZap}
                badge={
                    <div className="flex items-center gap-2">
                        <span className="text-3xs font-bold text-status-warning px-2 py-0.5 rounded bg-status-warning/10 border border-status-warning/25 whitespace-nowrap">
                            Nivel {TIER_LABELS[effectiveTier] ?? effectiveTier}
                        </span>
                        <Button
                            intent="ghost"
                            size="xs"
                            onClick={handleRefreshHardware}
                            disabled={isDetecting}
                            leftIcon={<IconUiRefresh className={cn("w-3.5 h-3.5", isDetecting && "animate-spin text-brand-accent")} />}
                            iconSpacing="0.375rem"
                            hideTextOnSmallScreen
                            aria-label="Volver a analizar el hardware"
                            className="text-label-2"
                        >
                            Volver a analizar
                        </Button>
                    </div>
                }
            >
                <div className="p-5 md:p-6 space-y-5">
                    {/* Tarjetas de Telemetría */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-0.5">
                            <span className="text-2xs text-label-2 block">GPU</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums" title={hardwareSpecs?.gpuRenderer || "GPU"}>
                                {hardwareSpecs?.gpuRenderer || "No detectada"}
                            </p>
                            <span className="text-4xs font-mono text-status-success">
                                {hardwareSpecs?.isDedicatedGpu ? "Dedicada" : "Integrada"}
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-0.5">
                            <span className="text-2xs text-label-2 block">CPU</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums">
                                {hardwareSpecs?.cpuCores ? `${hardwareSpecs.cpuCores} ${hardwareSpecs.cpuCores === 1 ? "núcleo" : "núcleos"}` : "No detectada"}
                            </p>
                            <span className="text-4xs text-brand-accent-readable">Hilos automáticos</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-0.5">
                            <span className="text-2xs text-label-2 block">RAM</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums">
                                {hardwareSpecs?.deviceMemoryGB ? `${hardwareSpecs.deviceMemoryGB} GB` : "No detectada"}
                            </p>
                            <span className="text-4xs text-brand-accent-readable">Búfer automático</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-0.5">
                            <span className="text-2xs text-label-2 block">Perfil activo</span>
                            <p key={performanceProfile} className="text-xs font-bold text-on-surface truncate animate-text-swap-in">
                                {PROFILES.find((p) => p.id === performanceProfile)?.label.split(" (")[0] ?? performanceProfile}
                            </p>
                            <span className="text-4xs text-status-warning">En uso</span>
                        </div>
                    </div>

                    {/* Selector de Perfiles */}
                    <Controller
                        control={control}
                        name="mediastream.performanceProfile"
                        render={({ field }) => {
                            const activeProfile = field.value || performanceProfile || "auto"
                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                                    {PROFILES.map((p) => {
                                        const isSelected = activeProfile === p.id
                                        const ProfileIcon = p.icon
                                        return (
                                            <m.button
                                                key={p.id}
                                                type="button"
                                                whileTap={{ scale: 0.96 }}
                                                transition={cardSpring}
                                                onClick={() => {
                                                    field.onChange(p.id)
                                                    setPerformanceProfile(p.id)
                                                }}
                                                aria-pressed={isSelected}
                                                className={cn(
                                                    "flex flex-col p-3.5 rounded-xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                                                    isSelected
                                                        ? "bg-brand-accent/10 border-brand-accent ring-1 ring-brand-accent/40"
                                                        : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center border transition-[background-color,border-color,color,box-shadow] duration-fast ease-smooth-out",
                                                        isSelected ? "bg-brand-accent/20 border-brand-accent/40 text-brand-accent-readable" : "bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)] text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
                                                    )}>
                                                        <ProfileIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-4xs px-1.5 py-0.5 rounded bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">{p.badge}</span>
                                                </div>
                                                <span className={cn("text-xs font-bold truncate", isSelected ? "text-brand-accent-readable" : "text-on-surface")}>
                                                    {p.label}
                                                </span>
                                                <span className="text-2xs text-on-surface-variant line-clamp-2 mt-0.5 leading-tight">{p.desc}</span>
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
                            name="mediastream.autoGovernorEnabled"
                            render={({ field }) => (
                                <OsToggle
                                    label="Ahorro automático"
                                    description="Quita la transparencia solo si la app va lenta de forma sostenida y la recupera al mejorar."
                                    checked={field.value !== undefined ? !!field.value : autoGovernorEnabled}
                                    onChange={(v) => {
                                        field.onChange(v)
                                        setAutoGovernorEnabled(v)
                                    }}
                                />
                            )}
                        />
                    </div>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                2. MOTOR DE VIDEO Y ACELERACIÓN GPU
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="video-engine"
                label="Motor de video y aceleración por GPU"
                description="Usa la tarjeta gráfica para reproducir y convertir video. Al guardar se reinicia el motor y se cortan las conversiones en curso."
                icon={IconStatusSparkles}
                badge={
                    <span className="flex items-center gap-1.5">
                        <DirtyPill show={engineDirty} />
                        <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/20">
                            {transcodeHwAccel?.toUpperCase() || "AUTO"}
                        </span>
                    </span>
                }
            >
                <div className="p-5 md:p-6 space-y-5">
                    <Controller
                        control={control}
                        name="mediastream.transcodeHwAccel"
                        render={({ field }) => (
                            <RadioCardGroup
                                name="transcodeHwAccel"
                                label="Aceleración por GPU"
                                options={HW_ACCEL_OPTIONS}
                                value={field.value === "none" ? "disabled" : (field.value || "auto")}
                                onChange={field.onChange}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                            />
                        )}
                    />

                    <div className="pt-2 border-t border-[var(--neutral-separator)]">
                        <Controller
                            control={control}
                            name="mediastream.transcodePreset"
                            render={({ field }) => (
                                <DirtyOsSelect
                                    control={control}
                                    name="mediastream.transcodePreset"
                                    value={field.value || "fast"}
                                    onChange={field.onChange}
                                    options={PRESET_OPTIONS}
                                    label="Velocidad de conversión"
                                    description="Qué tan rápido convierte FFmpeg el video. Más rápido usa menos CPU; más lento comprime mejor."
                                    icon={IconMediaGauge}
                                />
                            )}
                        />
                    </div>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. POLÍTICA DE REPRODUCCIÓN Y DIRECT PLAY
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="playback-policy"
                label="Original o convertido"
                description="Elige si el video se envía en su formato original o se convierte (transcodifica) al reproducir."
                icon={IconMediaPlay}
                badge={<DirtyPill show={policyDirty} />}
            >
                <div className="p-5 md:p-6">
                    <PlaybackPolicyPicker control={control} />
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                4. BINARIOS DEL SISTEMA (FFMPEG)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="system-binaries"
                label="Programas de FFmpeg"
                description="Herramientas que usa el servidor para leer y convertir video."
                icon={IconStatusServer}
                collapsible
                defaultOpen={false}
                searchQuery={searchQuery}
            >
                <div className="p-5 space-y-4">
                    <FFmpegStatusSection />

                    <div className="sectionbar-divide rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] overflow-hidden">
                        <Controller
                            control={control}
                            name="mediastream.ffmpegPath"
                            render={({ field }) => (
                                <DirtyOsInput
                                    control={control}
                                    name="mediastream.ffmpegPath"
                                    label="Ruta personalizada de FFmpeg"
                                    description="Opcional. Por seguridad solo se acepta el FFmpeg de la carpeta bin de KameHouse o el instalado en el sistema (PATH); otras rutas se ignoran."
                                    placeholder="Vacío: se detecta solo"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    isMono
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="mediastream.ffprobePath"
                            render={({ field }) => (
                                <DirtyOsInput
                                    control={control}
                                    name="mediastream.ffprobePath"
                                    label="Ruta personalizada de FFprobe"
                                    description="Opcional. Lee las pistas de audio y video. Mismas reglas que FFmpeg."
                                    placeholder="Vacío: se detecta solo"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    isMono
                                />
                            )}
                        />
                    </div>
                </div>
            </SectionBar>

        </div>
    )
}

function PlaybackPolicyPicker({ control }: { control: Control<SettingsFormValues> }) {
    const { setValue } = useFormContext<SettingsFormValues>()
    const mediastream = useWatch({ control, name: "mediastream" })
    const current = policyOf(mediastream)
    const cardSpring = useSpringPreset("cardHover")

    const setPolicy = (policy: PlaybackPolicy) => {
        const flags = {
            "auto": { transcodeEnabled: true, directPlayOnly: false, disableAutoSwitchToDirectPlay: false },
            "direct-only": { transcodeEnabled: false, directPlayOnly: true, disableAutoSwitchToDirectPlay: false },
            "transcode-strict": { transcodeEnabled: true, directPlayOnly: false, disableAutoSwitchToDirectPlay: true },
        }[policy]

        setValue("mediastream.transcodeEnabled", flags.transcodeEnabled, { shouldDirty: true })
        setValue("mediastream.directPlayOnly", flags.directPlayOnly, { shouldDirty: true })
        setValue("mediastream.disableAutoSwitchToDirectPlay", flags.disableAutoSwitchToDirectPlay, { shouldDirty: true })
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {POLICY_OPTIONS.map((opt) => {
                const isSelected = current === opt.value
                return (
                    <m.button
                        key={opt.value}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        transition={cardSpring}
                        onClick={() => setPolicy(opt.value)}
                        aria-pressed={isSelected}
                        className={cn(
                            "flex flex-col p-4 rounded-xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                            isSelected
                                ? "bg-brand-accent/10 border-brand-accent ring-1 ring-brand-accent/40"
                                : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-on-surface">{opt.label}</span>
                            <span className={cn(
                                "text-4xs font-mono px-1.5 py-0.5 rounded border transition-[background-color,color,border-color] duration-fast ease-smooth-out",
                                isSelected
                                    ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)]"
                                    : "bg-[var(--neutral-elev-3)] text-on-surface-variant border-[var(--neutral-separator)]"
                            )}>
                                {opt.badge}
                            </span>
                        </div>
                        <p className="text-2xs text-label-2 line-clamp-3 leading-snug">{opt.desc}</p>
                    </m.button>
                )
            })}
        </div>
    )
}

function FFmpegStatusSection() {
    const { data: ffmpegStatus, isLoading, refetch } = useGetFFmpegStatus()
    const { mutate: installFFmpeg, isPending: isInstalling } = useInstallFFmpeg()
    // El POST solo arranca la descarga: el estado real llega por el sondeo de 1 s.
    const downloading = !!ffmpegStatus?.isDownloading || isInstalling
    const downloadProgress = Math.min(100, Math.max(0, ffmpegStatus?.downloadProgress ?? 0))
    // "Detectado" celebra solo si la instalación ocurrió con la sección montada:
    // un pop fijo se repetiría en cada apertura de la sección (empieza cerrada).
    const [sawDownloading, setSawDownloading] = React.useState(false)
    if (downloading && !sawDownloading) {
        setSawDownloading(true)
    }

    const handleInstall = () => {
        installFFmpeg(undefined, {
            onSuccess: (data) => {
                // El aviso de inicio lo da el hook (toast.info); el de fin, el servidor.
                if (data?.started) {
                    refetch()
                } else {
                    toast.error("No se pudo iniciar la instalación")
                }
            },
            onError: (err) => {
                toast.error(errorText(err, "No se pudo instalar FFmpeg"))
            }
        })
    }

    if (isLoading) {
        return (
            <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center gap-3">
                <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                <span className="text-xs text-on-surface-variant">Buscando FFmpeg…</span>
            </div>
        )
    }

    const isInstalled = ffmpegStatus?.ffmpegAvailable ?? false

    return (
        <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Estado de FFmpeg</span>
                    {isInstalled ? (
                        <span key="ok" className={cn("text-3xs px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20", sawDownloading && "animate-success-pop")}>
                            Detectado
                        </span>
                    ) : (
                        <span key="missing" className="text-3xs px-2 py-0.5 rounded bg-status-error/10 text-status-error border border-status-error/20">
                            No instalado
                        </span>
                    )}
                </div>
                <p className="text-2xs text-on-surface-variant font-mono">
                    {ffmpegStatus?.ffmpegPath || "KameHouse gestiona la ubicación automáticamente"}
                </p>
            </div>
            {!isInstalled && (
                <div className="shrink-0 space-y-2">
                    <Button
                        intent="primary"
                        size="sm"
                        onClick={handleInstall}
                        loading={downloading}
                        disabled={downloading}
                        leftIcon={<IconUiDownload className="w-3.5 h-3.5" />}
                        iconSpacing="0.375rem"
                        className="shrink-0"
                    >
                        {downloading ? `Instalando FFmpeg (${downloadProgress}%)…` : "Descargar e instalar FFmpeg"}
                    </Button>
                    {downloading && (
                        // El porcentaje ya está en el texto del botón: la barra es solo visual.
                        <div aria-hidden="true" className="w-full h-1 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden">
                            <div
                                className="w-full h-1 bg-brand-accent rounded-full origin-left transition-transform duration-slow ease-smooth-out"
                                style={{ transform: `scaleX(${downloadProgress / 100})` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

