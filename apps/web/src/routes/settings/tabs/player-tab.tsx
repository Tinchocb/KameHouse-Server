import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { LucidePlay, LucideZap, LucideSliders, LucideCpu } from "lucide-react"

export function PlayerTab({ control }: { control: Control<SettingsFormValues> }) {

    return (
        <TabsContent value="player" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* ── Header ── */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                        <LucidePlay className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">REPRODUCCIÓN · STREAMING</span>
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                    </span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    MOTOR DE <span className="text-zinc-600">REPRODUCCIÓN</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                    Ajusta los parámetros de reproducción en tiempo real, acelera el procesamiento de tus videos por hardware y configura la automatización del reproductor integrado.
                </p>
            </header>

            {/* ── 1. Automatización & Transmisión Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Bento Card: Automatización */}
                <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
                                <LucideZap size={16} />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Automatización</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                            Mejora la comodidad automatizando tareas comunes en el reproductor.
                        </p>
                    </div>
                    <div className="divide-y divide-white/[0.02] pt-2">
                        <OsToggle
                            control={control}
                            name="library.autoPlayNextEpisode"
                            label="Reproducción Automática"
                            desc="Reproduce el siguiente episodio automáticamente al terminar el actual."
                        />
                        <OsToggle
                            control={control}
                            name="library.enableWatchContinuity"
                            label="Saltar Intros (AniSkip)"
                            desc="Sincroniza con servidores AniSkip para saltar openings/endings automáticamente."
                        />
                    </div>
                </Card>

                {/* Bento Card: Transmisión & Buffer */}
                <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
                                <LucideSliders size={16} />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Transmisión & Buffer</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                            Ajusta el rendimiento y almacenamiento intermedio del flujo de video.
                        </p>
                    </div>
                    <div className="divide-y divide-white/[0.02] pt-2">
                        <OsToggle
                            control={control}
                            name="mediastream.transcodeEnabled"
                            label="Transcodificación HW"
                            desc="Usa aceleración de hardware (GPU) para convertir videos en tiempo real."
                        />
                        <OsToggle
                            control={control}
                            name="mediastream.preTranscodeEnabled"
                            label="Pre-Transcodificado"
                            desc="Almacena en buffer los videos antes de que inicie la reproducción."
                        />
                        <OsToggle
                            control={control}
                            name="mediastream.directPlayOnly"
                            label="Forzar Solo Reproducción Directa"
                            desc="Deshabilita por completo la conversión de video (ahorra recursos)."
                        />
                    </div>
                </Card>
            </div>

            {/* ── 2. Servidor Multimedia (FFmpeg) ── */}
            <Section label="Optimización del Servidor Multimedia (FFmpeg)">
                <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
                                <LucideCpu size={16} />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Motor FFmpeg</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                            Define cómo interactúa el servidor de KameHouse con las herramientas de transcodificación del sistema operativo.
                        </p>
                    </div>

                    <div className="divide-y divide-white/[0.02] pt-2">
                        <OsSelect
                            control={control}
                            name="mediastream.transcodeHwAccel"
                            label="Acelerador por Hardware"
                            desc="El motor gráfico físico instalado en el servidor para el procesamiento de video."
                            options={[
                                { value: "", label: "Desactivado (Solo CPU)" },
                                { value: "auto", label: "Aceleración Automática (Recomendado)" },
                                { value: "cuda", label: "NVIDIA (CUDA / NVDEC)" },
                                { value: "vaapi", label: "Intel / AMD (VAAPI / Linux)" },
                                { value: "qsv", label: "Intel QuickSync (QSV)" },
                                { value: "videotoolbox", label: "Apple Silicon / macOS (VideoToolbox)" },
                            ]}
                        />
                        <OsSelect
                            control={control}
                            name="mediastream.transcodePreset"
                            label="Preset del Transcodificador"
                            desc="Define la relación velocidad/calidad. Presets rápidos consumen menos recursos pero bajan la fidelidad."
                            options={[
                                { value: "", label: "Por Defecto (Rápido)" },
                                { value: "ultrafast", label: "Ultrarrápido (Menor uso de CPU/GPU)" },
                                { value: "superfast", label: "Superrápido" },
                                { value: "veryfast", label: "Muy Rápido" },
                                { value: "faster", label: "Más Rápido" },
                                { value: "fast", label: "Rápido" },
                                { value: "medium", label: "Medio (Equilibrado)" },
                                { value: "slow", label: "Lento (Mejor calidad)" },
                            ]}
                        />
                        <OsInput
                            control={control}
                            name="mediastream.transcodeThreads"
                            label="Hilos de CPU del Transcodificador"
                            desc="Número de núcleos que FFmpeg puede emplear simultáneamente (0 para automático)."
                            type="number"
                        />
                        <OsInput
                            control={control}
                            name="mediastream.ffmpegPath"
                            label="Ruta de FFmpeg"
                            desc="Dirección del ejecutable de FFmpeg en el sistema."
                            placeholder="Ej. C:\ffmpeg\bin\ffmpeg.exe"
                            isMono
                        />
                        <OsInput
                            control={control}
                            name="mediastream.ffprobePath"
                            label="Ruta de FFprobe"
                            desc="Dirección del ejecutable de FFprobe en el sistema."
                            placeholder="Ej. C:\ffmpeg\bin\ffprobe.exe"
                            isMono
                        />
                    </div>
                </Card>
            </Section>
        </TabsContent>
    )
}
