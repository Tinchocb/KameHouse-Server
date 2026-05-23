import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { Switch } from "@/components/ui/switch"

export function PlayerTab({ control }: { control: Control<SettingsFormValues> }) {
    const defaultPlayer = useWatch({ control, name: "mediaPlayer.defaultPlayer" })
    
    // Background Music Store Preferences (Direct Zustand binding to prevent DB schema conflicts)
    const bgMusicEnabled = useAppStore(state => state.bgMusicEnabled)
    const setBgMusicEnabled = useAppStore(state => state.setBgMusicEnabled)
    const bgMusicVolume = useAppStore(state => state.bgMusicVolume)
    const setBgMusicVolume = useAppStore(state => state.setBgMusicVolume)

    return (
        <TabsContent value="player" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
            {/* ── Header ── */}
            <header className="space-y-2">
                <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                    MOTOR DE <span className="text-zinc-500">REPRODUCCIÓN</span>
                </h1>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl">
                    Optimiza la fluidez de tus transmisiones y selecciona tu método de visualización preferido.
                </p>
            </header>

            {/* ── 1. Default Player Selection ── */}
            <Section label="Visualizador Principal">
                <Card>
                    <OsSelect
                        control={control}
                        name="mediaPlayer.defaultPlayer"
                        label="Reproductor Predeterminado"
                        desc="El motor que KameHouse utilizará para proyectar el video. Los reproductores locales permiten reproducir subtítulos complejos (.ASS) sin transcodificar."
                        options={[
                            { value: "web", label: "Navegador Web (Reproductor Integrado)" },
                            { value: "mpv", label: "MPV Player (Local)" },
                            { value: "vlc", label: "VLC Media Player (Local)" },
                            { value: "iina", label: "IINA Player (macOS Local)" },
                        ]}
                    />
                </Card>
            </Section>

            {/* ── 2. Conditional Local Player Configuration ── */}
            <AnimatePresence mode="wait">
                {defaultPlayer === "mpv" && (
                    <motion.div
                        key="mpv"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Section label="Ajustes de MPV Player">
                            <Card>
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.mpvPath"
                                    label="Ruta Ejecutable de MPV"
                                    desc="Dirección del archivo binario ejecutable de MPV en tu sistema."
                                    placeholder="Ej. C:\Program Files\mpv\mpv.exe o /usr/bin/mpv"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.mpvSocket"
                                    label="Socket / Pipe IPC de MPV"
                                    desc="Dirección para comunicación de API de control de reproducción."
                                    placeholder="Ej. \\.\pipe\mpv-socket o /tmp/mpv-socket"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.mpvArgs"
                                    label="Argumentos de Lanzamiento"
                                    desc="Argumentos de línea de comandos pasados a MPV al iniciar un video."
                                    placeholder="Ej. --geometry=50% --ontop"
                                    isMono
                                />
                            </Card>
                        </Section>
                    </motion.div>
                )}

                {defaultPlayer === "vlc" && (
                    <motion.div
                        key="vlc"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Section label="Ajustes de VLC Media Player">
                            <Card>
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.vlcPath"
                                    label="Ruta Ejecutable de VLC"
                                    desc="Dirección del archivo binario ejecutable de VLC en tu sistema."
                                    placeholder="Ej. C:\Program Files\VideoLAN\VLC\vlc.exe o /usr/bin/vlc"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.vlcPort"
                                    label="Puerto HTTP de VLC"
                                    desc="Puerto de la Web UI para control remoto (usualmente 8080)."
                                    type="number"
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.vlcUsername"
                                    label="Usuario HTTP VLC"
                                    desc="Usuario configurado en el Web UI (dejar en blanco para VLC 3.x)."
                                    placeholder="Dejar en blanco"
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.vlcPassword"
                                    label="Contraseña Web UI VLC"
                                    desc="La clave requerida por VLC para controlar la reproducción remotamente."
                                    placeholder="Ingresa tu contraseña de VLC"
                                    isSecure
                                    isMono
                                />
                            </Card>
                        </Section>
                    </motion.div>
                )}

                {defaultPlayer === "iina" && (
                    <motion.div
                        key="iina"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Section label="Ajustes de IINA (macOS)">
                            <Card>
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.iinaPath"
                                    label="Ruta de la App IINA"
                                    desc="Ubicación de IINA.app en tu carpeta de Aplicaciones de macOS."
                                    placeholder="Ej. /Applications/IINA.app/Contents/MacOS/IINA"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.iinaSocket"
                                    label="Socket IPC de IINA"
                                    desc="Socket del controlador interno para control de reproducción."
                                    placeholder="Ej. /tmp/iina-socket"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="mediaPlayer.iinaArgs"
                                    label="Argumentos Adicionales"
                                    desc="Parámetros adicionales de comando pasados a la app IINA."
                                    placeholder="--mpv-ontop"
                                    isMono
                                />
                            </Card>
                        </Section>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 3. Automatización de Reproducción ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Section label="Automatización">
                    <Card>
                        <OsToggle
                            control={control}
                            name="library.autoPlayNextEpisode"
                            label="Reproducción Automática"
                            desc="Reproducir el siguiente episodio automáticamente al terminar el actual."
                        />
                        <OsToggle
                            control={control}
                            name="library.enableWatchContinuity"
                            label="Saltar Intros (AniSkip)"
                            desc="Sincronizar con servidores AniSkip para saltar openings/endings de anime automáticamente."
                        />
                    </Card>
                </Section>

                <Section label="Transmisión & Buffer">
                    <Card>
                        <OsToggle
                            control={control}
                            name="mediastream.transcodeEnabled"
                            label="Transcodificación HW"
                            desc="Usar aceleración de hardware por GPU en el servidor para convertir video sobre la marcha."
                        />
                        <OsToggle
                            control={control}
                            name="mediastream.preTranscodeEnabled"
                            label="Pre-Transcodificado"
                            desc="Comenzar a procesar y almacenar en buffer el video antes de que comience la reproducción."
                        />
                    </Card>
                </Section>
            </div>

            {/* ── 4. Música de Fondo (Retro) ── */}
            <Section label="Música de Fondo (Retro)">
                <Card>
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-all duration-300 gap-10 group/toggle">
                        <div className="space-y-1 flex-1">
                            <p className="text-base font-bold text-zinc-100 group-hover/toggle:text-white transition-colors tracking-tight">Activar Música de Fondo</p>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">Reproducir banda sonora clásica en bucle mientras exploras tu biblioteca.</p>
                        </div>
                        <Switch
                            value={bgMusicEnabled}
                            onValueChange={setBgMusicEnabled}
                            className="scale-110 origin-right transition-all duration-300 data-[state=checked]:bg-primary"
                        />
                    </div>
                    {bgMusicEnabled && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 hover:bg-white/[0.01] transition-all duration-300 gap-6 group/input border-t border-white/[0.02]"
                        >
                            <div className="space-y-1 flex-1 max-w-xl">
                                <p className="text-base font-bold text-zinc-100 group-hover/input:text-white transition-colors tracking-tight">Volumen de la Música</p>
                                <p className="text-xs text-zinc-500 leading-relaxed font-medium">Ajusta el nivel de ganancia del reproductor de fondo retro.</p>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-80">
                                <span className="text-xs font-bold text-zinc-400 w-8 text-right tabular-nums">{Math.round(bgMusicVolume * 100)}%</span>
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full relative">
                                    <div 
                                        className="absolute left-0 h-full bg-brand-orange rounded-full transition-all duration-75"
                                        style={{ width: `${bgMusicVolume * 100}%` }}
                                    />
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.05"
                                        value={bgMusicVolume}
                                        onChange={(e) => setBgMusicVolume(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </Card>
            </Section>

            {/* ── 5. Servidor Multimedia (FFmpeg) ── */}
            <Section label="Optimización del Servidor Multimedia (FFmpeg)">
                <Card>
                    <OsSelect
                        control={control}
                        name="mediastream.transcodeHwAccel"
                        label="Acelerador por Hardware"
                        desc="El motor gráfico de hardware instalado en el servidor para el procesamiento óptimo de video."
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
                        desc="Número de núcleos que FFmpeg puede emplear para codificar video simultáneamente (0 para auto)."
                        type="number"
                    />
                    <OsInput
                        control={control}
                        name="mediastream.ffmpegPath"
                        label="Ruta de FFmpeg"
                        desc="Dirección del binario ejecutable de FFmpeg en el sistema operativo del servidor."
                        placeholder="Ej. C:\ffmpeg\bin\ffmpeg.exe o /usr/bin/ffmpeg"
                        isMono
                    />
                    <OsInput
                        control={control}
                        name="mediastream.ffprobePath"
                        label="Ruta de FFprobe"
                        desc="Dirección del binario ejecutable de FFprobe en el sistema operativo del servidor."
                        placeholder="Ej. C:\ffmpeg\bin\ffprobe.exe o /usr/bin/ffprobe"
                        isMono
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
