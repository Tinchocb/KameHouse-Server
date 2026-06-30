import React from "react"
import { Section, Card, OsToggle } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { useAppStore } from "@/lib/store"

interface PlayerTabProps {
    control: Control<SettingsFormValues>
}

export function PlayerTab({ control }: PlayerTabProps) {
    const { marathonMode, setMarathonMode } = useAppStore()
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuración de Player */}
                <div className="bg-surface-container rounded-container p-6 shadow-elevation-1 space-y-5">
                    <h3 className="text-sm font-bold text-[#ff6e3a] uppercase tracking-wide">Reproductor por Defecto</h3>

                    <Controller
                        control={control}
                        name="mediaPlayer.defaultPlayer"
                        render={({ field }) => (
                            <div className="space-y-3 pt-2">
                                {[
                                    { id: "vlc", label: "VLC Media Player", desc: "Reproductor multimedia multiplataforma" },
                                    { id: "mpc", label: "MPC-HC / MPC-BE", desc: "Media Player Classic (Windows)" },
                                    { id: "mpv", label: "MPV", desc: "Reproductor ligero de línea de comandos" },
                                    { id: "iina", label: "IINA", desc: "Reproductor nativo de macOS" },
                                ].map((player) => (
                                    <div
                                        key={player.id}
                                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                                            field.value === player.id
                                                ? "border-[#ff6e3a]/30 bg-[#ff6e3a]/[0.03] bg-[radial-gradient(ellipse_at_left,rgba(255,110,58,0.04),transparent_70%)]"
                                                : "border-outline-variant hover:border-outline-variant hover:bg-surface-container-high"
                                        }`}
                                        onClick={() => field.onChange(player.id)}
                                    >
                                        <input
                                            id={`player-radio-${player.id}`}
                                            type="radio"
                                            name="defaultPlayer"
                                            value={player.id}
                                            checked={field.value === player.id}
                                            onChange={() => field.onChange(player.id)}
                                            className="mt-1 accent-[#ff6e3a]"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="-mt-0.5">
                                            <label
                                                htmlFor={`player-radio-${player.id}`}
                                                className="text-xs font-bold text-on-surface block tracking-tight cursor-pointer"
                                            >
                                                {player.label}
                                            </label>
                                            <span className="text-[10px] text-on-surface-variant block mt-0.5">{player.desc}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    />
                </div>

                {/* Configuración VLC */}
                <div className="bg-surface-container rounded-container p-6 shadow-elevation-1 space-y-5">
                    <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">Conexión VLC</h3>

                    <Controller
                        control={control}
                        name="mediaPlayer.host"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Host / IP</label>
                                <input
                                    type="text"
                                    value={field.value || "localhost"}
                                    onChange={field.onChange}
                                    placeholder="localhost o 192.168.1.x"
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name="mediaPlayer.vlcPort"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Puerto</label>
                                    <input
                                        type="number"
                                        value={field.value || 8080}
                                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                    />
                                </div>
                            )}
                        />
                        <Controller
                            control={control}
                            name="mediaPlayer.vlcUsername"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Usuario</label>
                                    <input
                                        type="text"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="(vacío = sin auth)"
                                        className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                    />
                                </div>
                            )}
                        />
                    </div>

                    <Controller
                        control={control}
                        name="mediaPlayer.vlcPassword"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Contraseña</label>
                                <input
                                    type="password"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="(vacío = sin auth)"
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />

                    <Controller
                        control={control}
                        name="mediaPlayer.vlcPath"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">Ruta VLC (opcional)</label>
                                <input
                                    type="text"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Ej. C:\Program Files\VideoLAN\VLC\vlc.exe"
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />
                </div>
            </div>

            {/* Reproducción */}
            <Section label="Comportamiento de Reproducción">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="library.autoPlayNextEpisode"
                        render={({ field }) => (
                            <OsToggle
                                label="Reproducción Continua"
                                description="Inicia automáticamente el siguiente episodio de la cola al finalizar el actual."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.enableWatchContinuity"
                        render={({ field }) => (
                            <OsToggle
                                label="Habilitar Continuidad de Reproducción"
                                description="Guarda el progreso en segundo plano para continuar viendo desde donde lo dejaste."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.autoUpdateProgress"
                        render={({ field }) => (
                            <OsToggle
                                label="Actualización Automática de Progreso"
                                description="Actualiza el progreso de visualización automáticamente en Platform/AniList."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Traducción */}
            <Section label="Voice Control / Traducción">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="mediaPlayer.vcTranslate"
                        render={({ field }) => (
                            <OsToggle
                                label="Habilitar Voice Control Translate"
                                description="Permite traducir audio en tiempo real durante la reproducción."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* MPC / MPV Paths */}
            <Section label="Rutas de Reproductores Alternativos">
                <Card className="divide-y divide-outline-variant/4">
                    <Controller
                        control={control}
                        name="mediaPlayer.mpcPath"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label className="text-sm font-semibold text-on-surface tracking-tight">Ruta MPC-HC / MPC-BE</label>
                                    <p className="text-xs text-on-surface-variant font-medium">Ubicación del binario MPC en Windows.</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="C:\Program Files\MPC-HC\mpc-hc64.exe"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)]"
                                />
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediaPlayer.mpvPath"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label className="text-sm font-semibold text-on-surface tracking-tight">Ruta MPV</label>
                                    <p className="text-xs text-on-surface-variant font-medium">Ubicación del binario MPV.</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ej. /usr/bin/mpv o C:\mpv\mpv.exe"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)]"
                                />
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediaPlayer.mpvSocket"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label className="text-sm font-semibold text-on-surface tracking-tight">Socket IPC MPV</label>
                                    <p className="text-xs text-on-surface-variant font-medium">Ruta del socket para comunicación con MPV.</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ej. \\.\pipe\mpv_ipc (Windows) o /tmp/mpv_socket (Linux)"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)]"
                                />
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="mediaPlayer.iinaPath"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-surface-variant/[0.01] transition-all duration-200 gap-5">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label className="text-sm font-semibold text-on-surface tracking-tight">Ruta IINA (macOS)</label>
                                    <p className="text-xs text-on-surface-variant font-medium">Ubicación del binario IINA en macOS.</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="/Applications/IINA.app/Contents/MacOS/iina-cli"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 w-full md:w-72 text-on-surface placeholder:text-on-surface-variant/60 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)]"
                                />
                            </div>
                        )}
                    />
                </Card>
            </Section>
        </div>
    )
}
