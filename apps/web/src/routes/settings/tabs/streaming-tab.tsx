import React from "react"
import { Section, Card, OsToggle, OsSelect } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { useAppStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"

interface StreamingTabProps {
    control: Control<SettingsFormValues>
}

const HW_ACCEL_OPTIONS = [
    { value: "", label: "Automático (Recomendado)", desc: "Detecta Nvidia NVENC, Intel QuickSync, VAAPI, AMD AMF" },
    { value: "nvenc", label: "NVIDIA NVENC", desc: "Tarjetas GeForce GTX/RTX series" },
    { value: "qsv", label: "Intel QuickSync (QSV)", desc: "Gráficos integrados Intel (6th gen+)" },
    { value: "vaapi", label: "VAAPI (AMD/Intel)", desc: "Linux: AMD Radeon, Intel integrado" },
    { value: "amf", label: "AMD AMF", desc: "Tarjetas AMD Radeon (RDNA/RDNA2)" },
    { value: "videotoolbox", label: "VideoToolbox (macOS)", desc: "Apple Silicon / macOS nativo" },
    { value: "cuda", label: "CUDA (NVIDIA)", desc: "Decode/Encode via CUDA cores" },
    { value: "none", label: "Desactivado (CPU)", desc: "Solo software, mayor uso de CPU" },
]

const PRESET_OPTIONS = [
    { value: "ultrafast", label: "Ultrafast", desc: "Máxima velocidad, menor compresión" },
    { value: "superfast", label: "Superfast" },
    { value: "veryfast", label: "Veryfast" },
    { value: "faster", label: "Faster" },
    { value: "fast", label: "Fast (Recomendado)", desc: "Balance velocidad/calidad" },
    { value: "medium", label: "Medium", desc: "Default FFmpeg" },
    { value: "slow", label: "Slow", desc: "Mejor compresión" },
    { value: "slower", label: "Slower" },
    { value: "veryslow", label: "Veryslow", desc: "Mejor calidad, muy lento" },
]

export function StreamingTab({ control }: StreamingTabProps) {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Transcodificación por Hardware */}
            <Section label="Transcodificación por Hardware (GPU)">
                <Card className="space-y-6 p-6">
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-[#ff6e3a] uppercase tracking-wide">Aceleración por Hardware</h3>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Asigna el procesamiento de codecs pesados (HEVC 10-bit, AV1, VP9) directo al chip de video de tu GPU.
                        </p>
                    </div>

                    <Controller
                        control={control}
                        name="mediastream.transcodeHwAccel"
                        render={({ field }) => (
                            <div className="space-y-3">
                                {HW_ACCEL_OPTIONS.map((gpu) => (
                                    <div
                                        key={gpu.value}
                                        className={cn(
                                            "flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer group",
                                            field.value === gpu.value || (!field.value && gpu.value === "")
                                                ? "border-[#ff6e3a]/30 bg-[#ff6e3a]/[0.03] bg-[radial-gradient(ellipse_at_left,rgba(255,110,58,0.04),transparent_70%)]"
                                                : "border-outline-variant hover:border-outline-variant hover:bg-surface-container-high"
                                        )}
                                        onClick={() => field.onChange(gpu.value)}
                                    >
                                        <input
                                            id={`hw-accel-radio-${gpu.value || "auto"}`}
                                            type="radio"
                                            name="transcodeHwAccel"
                                            value={gpu.value}
                                            checked={field.value === gpu.value || (!field.value && gpu.value === "")}
                                            onChange={() => field.onChange(gpu.value)}
                                            className="mt-1 accent-[#ff6e3a] group-hover:opacity-100 opacity-0 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex-1 -mt-0.5">
                                            <label
                                                htmlFor={`hw-accel-radio-${gpu.value || "auto"}`}
                                                className="text-xs font-bold text-on-surface block tracking-tight cursor-pointer group-hover:text-[#ff6e3a] transition-colors"
                                            >
                                                {gpu.label}
                                            </label>
                                            <span className="text-[10px] text-on-surface-variant block mt-0.5">{gpu.desc}</span>
                                        </div>
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black uppercase tracking-wider shrink-0",
                                            field.value === gpu.value || (!field.value && gpu.value === "")
                                                ? "bg-[#ff6e3a]/20 text-[#ff6e3a] border border-[#ff6e3a]/30"
                                                : "bg-surface-container text-on-surface-variant border border-outline-variant"
                                        )}>
                                            {gpu.value === "" ? "AUTO" : gpu.value.toUpperCase().slice(0, 4)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    />

                    <hr className="border-outline-variant my-2" />

                    {/* Preset de calidad */}
                    <Controller
                        control={control}
                        name="mediastream.transcodePreset"
                        render={({ field }) => (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">
                                    <span>Preset de Calidad (velocidad vs compresión)</span>
                                    <span className="text-[#ff6e3a] font-bold">{field.value || "fast"}</span>
                                </div>
                                <OsSelect
                                    value={field.value || "fast"}
                                    onChange={field.onChange}
                                    options={PRESET_OPTIONS}
                                    label="Preset de Transcodificación"
                                    description="Presets más lentos = mejor calidad y menor tamaño, pero mayor uso de CPU/GPU"
                                />
                            </div>
                        )}
                    />

                    {/* Threads */}
                    <Controller
                        control={control}
                        name="mediastream.transcodeThreads"
                        render={({ field }) => (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-mono font-bold text-on-surface-variant">
                                    <span>Hilos de Transcodificación (Threads)</span>
                                    <span className="text-[#ff6e3a]">{field.value || 0} (0 = automático)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="16"
                                    value={field.value || 0}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-surface-container rounded-lg appearance-none cursor-pointer accent-brand-secondary mt-2"
                                />
                                <p className="text-[10px] text-on-surface-variant mt-1">0 = automático (usa todos los núcleos lógicos disponibles)</p>
                            </div>
                        )}
                    />

                    {/* Configuración personalizada HW Accel */}
                    <Controller
                        control={control}
                        name="mediastream.transcodeHwAccelCustomSettings"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="hw-custom-settings" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Parámetros Personalizados (Avanzado)</label>
                                <input
                                    id="hw-custom-settings"
                                    type="text"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Ej: -preset p4 -tune hq -rc vbr"
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                                <p className="text-[10px] text-on-surface-variant">Parámetros extra pasados al encoder de hardware (solo para usuarios avanzados)</p>
                            </div>
                        )}
                    />
                </Card>
            </Section>

            {/* Pre-transcodificación */}
            <Section label="Pre-Transcodificación (Background)">
                <Card className="divide-y divide-outline-variant/4">
                    <Controller
                        control={control}
                        name="mediastream.preTranscodeEnabled"
                        render={({ field }) => (
                            <OsToggle
                                label="Habilitar Pre-Transcodificación"
                                description="Transcodifica media en segundo plano para reproducción instantánea. Requiere espacio en disco."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediastream.preTranscodeLibraryDir"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="pretranscode-dir" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Directorio de Pre-Transcodificación</label>
                                    <p className="text-xs text-on-surface-variant leading-relaxed font-medium">Carpeta donde se guardan los archivos pre-transcodificados.</p>
                                </div>
                                <input
                                    id="pretranscode-dir"
                                    type="text"
                                    placeholder="Ej. /mnt/cache/pretranscode o D:\\Cache\\Pretranscode"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs focus:outline-none focus:border-[#ff6e3a]/50 font-mono"
                                />
                            </div>
                        )}
                    />
                </Card>
            </Section>

            {/* Configuración General de Streaming */}
            <Section label="Configuración General">
                <Card className="divide-y divide-outline-variant/4">
                    <Controller
                        control={control}
                        name="mediastream.transcodeEnabled"
                        render={({ field }) => (
                            <OsToggle
                                label="Habilitar Transcodificación"
                                description="Permite al servidor transcodificar video/audio cuando el cliente no soporta el codec nativo."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediastream.directPlayOnly"
                        render={({ field }) => (
                            <OsToggle
                                label="Solo Reproducción Directa (Direct Play)"
                                description="Fuerza reproducción nativa sin transcodificar. Fallará si el dispositivo no soporta el codec."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediastream.disableAutoSwitchToDirectPlay"
                        render={({ field }) => (
                            <OsToggle
                                label="Desactivar Cambio Automático a Direct Play"
                                description="Evita que el servidor intente cambiar a reproducción directa si la transcodificación falla."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Rutas FFmpeg/FFprobe */}
            <Section label="Binarios del Sistema">
                <Card className="divide-y divide-outline-variant/4">
                    <Controller
                        control={control}
                        name="mediastream.ffmpegPath"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="ffmpeg-path-stream" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Ruta Ejecutable FFmpeg</label>
                                    <p className="text-xs text-on-surface-variant leading-relaxed font-medium">Ubicación del binario ffmpeg (requerido para transcodificación).</p>
                                </div>
                                <input
                                    id="ffmpeg-path-stream"
                                    type="text"
                                    placeholder="Ej. /usr/bin/ffmpeg o C:\\ffmpeg\\ffmpeg.exe"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs focus:outline-none focus:border-[#ff6e3a]/50 font-mono"
                                />
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediastream.ffprobePath"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="ffprobe-path-stream" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Ruta Ejecutable FFprobe</label>
                                    <p className="text-xs text-on-surface-variant leading-relaxed font-medium">Ubicación del binario ffprobe (análisis de metadatos de video).</p>
                                </div>
                                <input
                                    id="ffprobe-path-stream"
                                    type="text"
                                    placeholder="Ej. /usr/bin/ffprobe o C:\\ffmpeg\\ffprobe.exe"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs focus:outline-none focus:border-[#ff6e3a]/50 font-mono"
                                />
                            </div>
                        )}
                    />
                </Card>
            </Section>

            {/* Estado del Motor de Streaming */}
            <Section label="Estado del Motor">
                <Card className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-container bg-surface-container border border-outline-variant rounded-container">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-on-surface-variant font-mono mb-2">Transcodificación</p>
                            <p className="text-2xl font-bebas text-on-surface">ACTIVO</p>
                            <p className="text-[10px] text-on-surface-variant mt-1">Hardware: Auto-detect</p>
                        </div>
                        <div className="p-4 rounded-container bg-surface-container border border-outline-variant rounded-container">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-on-surface-variant font-mono mb-2">Pre-Transcodificación</p>
                            <p className="text-2xl font-bebas text-on-surface">INACTIVO</p>
                            <p className="text-[10px] text-on-surface-variant mt-1">Directorio no configurado</p>
                        </div>
                        <div className="p-4 rounded-container bg-surface-container border border-outline-variant rounded-container">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-on-surface-variant font-mono mb-2">Direct Play</p>
                            <p className="text-2xl font-bebas text-on-surface">DISPONIBLE</p>
                            <p className="text-[10px] text-on-surface-variant mt-1">Compatible con la mayoría de clientes</p>
                        </div>
                    </div>
                </Card>
            </Section>
        </div>
    )
}