import { errorText } from "@/api/client/error-messages"
import React, { useEffect } from "react"
import { type Control, Controller, useFormContext, useFormState, useWatch } from "react-hook-form"
import { m } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { type SettingsFormInput } from "../index"
import { usePerformanceStore, type PerformanceProfile } from "@/lib/hardware/performance-store"
import { useShallow } from "zustand/react/shallow"
import { useGetFFmpegStatus, useInstallFFmpeg } from "@/api/hooks/mediastream.hooks"
import {
    IconStatusSparkles,
    IconStatusZap,
    IconStatusActivity,
    IconUiShield,
    IconUiRefresh,
    IconStatusServer,
    IconUiSpinner,
    IconUiDownload,
    IconMediaGauge,
    IconUiCheck,
} from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { RadioCardGroup } from "@/components/settings/radio-card-group"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { OsToggle, DirtyOsSelect, DirtyOsInput, DirtyPill } from "../components"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

interface PerformanceTabProps {
    control: Control<SettingsFormInput>
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

type MediastreamValues = SettingsFormInput["mediastream"] | undefined

function policyOf(m: MediastreamValues): PlaybackPolicy {
    if (m?.directPlayOnly) return "direct-only"
    if (m?.transcodeEnabled && m?.disableAutoSwitchToDirectPlay) return "transcode-strict"
    return "auto"
}

export const PerformanceTab = React.memo(function PerformanceTab({ control }: PerformanceTabProps) {
    const reduceMotion = useReducedMotion()
    const transcodeHwAccel = useWatch({ control, name: "mediastream.transcodeHwAccel" })
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
    const cardSpring = useSpringPreset("entrance")

    return (
        <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-base pb-4 sm:pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. DIAGNÓSTICO DE HARDWARE Y PERFIL PRINCIPAL
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="hardware-profile"
                label="Perfil de rendimiento y telemetría"
                description="Equilibrio entre fidelidad visual y consumo de recursos en tu equipo."
                icon={IconStatusZap}
                badge={
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-status-warning px-2.5 py-0.5 rounded-full bg-status-warning/10 border border-status-warning/25 whitespace-nowrap">
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
                collapsible
                defaultOpen={true}
            >
                <div className="space-y-4">
                    {/* Tarjetas de Telemetría */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3.5 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-1">
                            <span className="text-xs font-semibold text-label-2 block">GPU</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums" title={hardwareSpecs?.gpuRenderer || "GPU"}>
                                {hardwareSpecs?.gpuRenderer || "No detectada"}
                            </p>
                            <span className="text-xs font-mono font-bold text-status-success flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                {hardwareSpecs?.isDedicatedGpu ? "Dedicada" : "Integrada"}
                            </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-1">
                            <span className="text-xs font-semibold text-label-2 block">CPU</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums">
                                {hardwareSpecs?.cpuCores ? `${hardwareSpecs.cpuCores} ${hardwareSpecs.cpuCores === 1 ? "núcleo" : "núcleos"}` : "No detectada"}
                            </p>
                            <span className="text-xs text-brand-accent-readable font-medium">Hilos automáticos</span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-1">
                            <span className="text-xs font-semibold text-label-2 block">RAM</span>
                            <p className="text-xs font-bold text-on-surface truncate tabular-nums">
                                {hardwareSpecs?.deviceMemoryGB ? `${hardwareSpecs.deviceMemoryGB} GB` : "No detectada"}
                            </p>
                            <span className="text-xs text-brand-accent-readable font-medium">Búfer optimizado</span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] transition-[border-color,background-color] duration-fast ease-smooth-out space-y-1">
                            <span className="text-xs font-semibold text-label-2 block">Perfil activo</span>
                            <p key={performanceProfile} className="text-xs font-bold text-on-surface truncate animate-text-swap-in">
                                {PROFILES.find((p) => p.id === performanceProfile)?.label.split(" (")[0] ?? performanceProfile}
                            </p>
                            <span className="text-xs text-status-warning font-bold">En uso</span>
                        </div>
                    </div>

                    {/* Selector de Perfiles */}
                    <Controller
                        control={control}
                        name="mediastream.performanceProfile"
                        render={({ field }) => {
                            const activeProfile = field.value || performanceProfile || "auto"
                            return (
                                <div role="radiogroup" aria-label="Perfil de rendimiento" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {PROFILES.map((p) => {
                                        const isSelected = activeProfile === p.id
                                        const ProfileIcon = p.icon
                                        return (
                                            <m.button
                                                key={p.id}
                                                type="button"
                                                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                                transition={cardSpring}
                                                onClick={() => {
                                                    field.onChange(p.id)
                                                    setPerformanceProfile(p.id)
                                                }}
                                                role="radio"
                                                aria-checked={isSelected}
                                                className={cn(
                                                    "flex flex-col justify-between p-4 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer outline-none border-t-[var(--glass-border-top)]",
                                                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                                                    isSelected
                                                        ? "bg-[var(--neutral-elev-3)] border-[var(--selected-bg)] ring-1 ring-[color-mix(in_srgb,var(--selected-bg)_40%,transparent)] shadow-[shadow:var(--double-bezel-ring)]"
                                                        : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] shadow-[shadow:var(--double-bezel-ring)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-xl flex items-center justify-center border transition-[background-color,border-color,color,box-shadow] duration-fast ease-smooth-out",
                                                        isSelected
                                                            ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)] font-bold shadow-[shadow:var(--double-bezel-ring)]"
                                                            : "bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)] text-on-surface-variant"
                                                    )}>
                                                        <ProfileIcon className="w-4 h-4" />
                                                    </div>
                                                    {isSelected ? (
                                                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--selected-bg)]/15 text-label-1 border border-[var(--selected-bg)]/30">
                                                            <IconUiCheck className="w-3 h-3 text-[var(--selected-bg)]" />
                                                            En uso
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">{p.badge}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={cn("text-xs font-bold truncate", isSelected ? "text-label-1" : "text-on-surface")}>
                                                        {p.label}
                                                    </p>
                                                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5 leading-snug">{p.desc}</p>
                                                </div>
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
                                    description="Desactiva la transparencia solo si la app detecta sobrecarga sostenida y la recupera al mejorar la fluidez."
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
                2. MOTOR DE VIDEO Y TRANSCODIFICACIÓN
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="video-engine"
                label="Motor de video y transcodificación"
                description="Política de reproducción original/convertido, aceleración por GPU y velocidad de compresión."
                icon={IconStatusSparkles}
                badge={
                    <span className="flex items-center gap-1.5">
                        <DirtyPill show={engineDirty || policyDirty} />
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/20 font-bold">
                            {transcodeHwAccel?.toUpperCase() || "AUTO"}
                        </span>
                    </span>
                }
                collapsible
                defaultOpen={true}
            >
                <div className="space-y-4">
                    {/* Selector de Política de Reproducción */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-label-1">Política de reproducción</span>
                            <span className="text-xs text-label-2">Formato de salida del reproductor</span>
                        </div>
                        <PlaybackPolicyPicker control={control} />
                    </div>

                    <div className="pt-2 border-t border-[var(--neutral-separator)] space-y-4">
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
                                    description="Qué tan rápido convierte FFmpeg el video. Más rápido usa menos CPU; más lento comprime con mayor calidad."
                                    icon={IconMediaGauge}
                                />
                            )}
                        />
                    </div>
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. BINARIOS DEL SISTEMA (FFMPEG)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="system-binaries"
                label="Binarios y herramientas (FFmpeg)"
                description="Herramientas del sistema que usa el servidor para leer, demuxear y convertir video."
                icon={IconStatusServer}
                collapsible
                defaultOpen={false}
            >
                <div className="space-y-4">
                    <FFmpegStatusSection />

                    <div className="sectionbar-divide rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] overflow-hidden">
                        <Controller
                            control={control}
                            name="mediastream.ffmpegPath"
                            render={({ field }) => (
                                <DirtyOsInput
                                    control={control}
                                    name="mediastream.ffmpegPath"
                                    label="Ruta personalizada de FFmpeg"
                                    description="Opcional. Por seguridad solo se acepta el binario de la carpeta bin de KameHouse o el del PATH del sistema."
                                    placeholder="Vacío: se detecta automáticamente"
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
                                    description="Opcional. Lee las pistas de audio, video y subtítulos. Mismas reglas que FFmpeg."
                                    placeholder="Vacío: se detecta automáticamente"
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
})

function PlaybackPolicyPicker({ control }: { control: Control<SettingsFormInput> }) {
    const reduceMotion = useReducedMotion()
    const { setValue } = useFormContext<SettingsFormInput>()
    const mediastream = useWatch({ control, name: "mediastream" })
    const current = policyOf(mediastream)
    const cardSpring = useSpringPreset("entrance")

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
        <div role="radiogroup" aria-label="Política de reproducción" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {POLICY_OPTIONS.map((opt) => {
                const isSelected = current === opt.value
                return (
                    <m.button
                        key={opt.value}
                        type="button"
                        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                        transition={cardSpring}
                        onClick={() => setPolicy(opt.value)}
                        role="radio"
                        aria-checked={isSelected}
                        className={cn(
                            "flex flex-col justify-between p-4 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer outline-none border-t-[var(--glass-border-top)]",
                            "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                            isSelected
                                ? "bg-[var(--neutral-elev-3)] border-[var(--selected-bg)] ring-1 ring-[color-mix(in_srgb,var(--selected-bg)_40%,transparent)] shadow-[shadow:var(--double-bezel-ring)]"
                                : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] shadow-[shadow:var(--double-bezel-ring)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={cn("text-xs font-bold", isSelected ? "text-label-1" : "text-on-surface")}>{opt.label}</span>
                            {isSelected ? (
                                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--selected-bg)]/15 text-label-1 border border-[var(--selected-bg)]/30">
                                    <IconUiCheck className="w-3 h-3 text-[var(--selected-bg)]" />
                                    En uso
                                </span>
                            ) : (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">
                                    {opt.badge}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-label-2 line-clamp-3 leading-snug">{opt.desc}</p>
                    </m.button>
                )
            })}
        </div>
    )
}

function FFmpegStatusSection() {
    const { data: ffmpegStatus, isLoading, refetch } = useGetFFmpegStatus()
    const { mutate: installFFmpeg, isPending: isInstalling } = useInstallFFmpeg()
    const downloading = !!ffmpegStatus?.isDownloading || isInstalling
    const downloadProgress = Math.min(100, Math.max(0, ffmpegStatus?.downloadProgress ?? 0))
    const [sawDownloading, setSawDownloading] = React.useState(false)
    if (downloading && !sawDownloading) {
        setSawDownloading(true)
    }

    const handleInstall = () => {
        installFFmpeg(undefined, {
            onSuccess: (data) => {
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
            <div className="p-4 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] flex items-center gap-3">
                <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                <span className="text-xs text-on-surface-variant">Buscando binarios de FFmpeg…</span>
            </div>
        )
    }

    const isInstalled = ffmpegStatus?.ffmpegAvailable ?? false

    return (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Estado de FFmpeg</span>
                    {isInstalled ? (
                        <span key="ok" className={cn("text-xs px-2 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/20 font-bold flex items-center gap-1", sawDownloading && "animate-success-pop")}>
                            <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                            Detectado
                        </span>
                    ) : (
                        <span key="missing" className="text-xs px-2 py-0.5 rounded-full bg-status-error/10 text-status-error border border-status-error/20 font-bold">
                            No instalado
                        </span>
                    )}
                </div>
                <p className="text-xs text-on-surface-variant font-mono truncate max-w-md">
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
                        <div aria-hidden="true" className="w-full h-1.5 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden">
                            <div
                                className="w-full h-1.5 bg-brand-accent rounded-full origin-left transition-transform duration-slow ease-smooth-out"
                                style={{ transform: `scaleX(${downloadProgress / 100})` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
