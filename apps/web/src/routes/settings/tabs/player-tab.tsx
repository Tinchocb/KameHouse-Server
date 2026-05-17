import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"

export function PlayerTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="player" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <header className="space-y-4">
                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">MOTOR <span className="text-zinc-500">REPRODUCCIÓN</span></h1>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Optimiza la fluidez y la automatización de tu experiencia visual.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <Section label="Automatización">
                    <Card>
                        <OsToggle control={control} name="library.autoPlayNextEpisode"
                            label="Reproducción Automática"
                            desc="Reproducir el siguiente episodio automáticamente al terminar." />
                        <OsToggle control={control} name="library.enableWatchContinuity"
                            label="Saltar Intros (AniSkip)"
                            desc="Sincronizar con AniSkip para saltar openings/endings automáticamente." />
                    </Card>
                </Section>

                <Section label="Transmisión & Buffer">
                    <Card>
                        <OsToggle control={control} name="mediastream.transcodeEnabled"
                            label="Transcodificación HW"
                            desc="Usar aceleración por hardware para el streaming de video." />
                         <OsToggle control={control} name="mediastream.preTranscodeEnabled"
                            label="Pre-Transcodificado"
                            desc="Preparar el buffer antes de iniciar la reproducción." />
                    </Card>
                </Section>
            </div>

            <Section label="Optimización del Servidor Multimedia (FFmpeg)">
                <Card>
                    <OsSelect
                        control={control}
                        name="mediastream.transcodeHwAccel"
                        label="Acelerador por Hardware"
                        desc="El motor de aceleración gráfico de tu sistema para codificar y decodificar video en tiempo real."
                        options={[
                            { value: "", label: "Desactivado (Solo CPU)" },
                            { value: "cuda", label: "NVIDIA (CUDA / NVDEC)" },
                            { value: "vaapi", label: "Intel / AMD (VAAPI / Linux)" },
                            { value: "qsv", label: "Intel QuickSync (QSV)" },
                        ]}
                    />
                    <OsInput
                        control={control}
                        name="mediastream.transcodeThreads"
                        label="Hilos de CPU del Transcodificador"
                        desc="Número de núcleos que puede usar FFmpeg para procesar video (0 para auto-detectar)."
                        type="number"
                    />
                    <OsInput
                        control={control}
                        name="mediastream.ffmpegPath"
                        label="Ruta de FFmpeg"
                        desc="Ubicación ejecutable del binario FFmpeg en el sistema del servidor."
                        placeholder="Ej. C:\ffmpeg\bin\ffmpeg.exe o /usr/bin/ffmpeg"
                        isMono
                    />
                    <OsInput
                        control={control}
                        name="mediastream.ffprobePath"
                        label="Ruta de FFprobe"
                        desc="Ubicación ejecutable del binario FFprobe en el sistema del servidor."
                        placeholder="Ej. C:\ffmpeg\bin\ffprobe.exe o /usr/bin/ffprobe"
                        isMono
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
