import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"

interface SystemTabProps {
    control: Control<SettingsFormValues>
}

// Custom simple icons to replace Lucide
const HardDriveIcon = () => (
    <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="14" x2="6.01" y2="14" />
        <line x1="10" y1="14" x2="10.01" y2="14" />
    </svg>
)

const AlertIcon = () => (
    <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
)

export function SystemTab({ control }: SystemTabProps) {
    const {
        bgMusicEnabled,
        setBgMusicEnabled,
        bgMusicVolume,
        setBgMusicVolume,
        uiSoundsEnabled,
        setUiSoundsEnabled
    } = useAppStore()

    const handleBackup = () => {
        toast.success("Respaldo de base de datos generado con éxito")
    }

    const handleClearCache = () => {
        toast.success("Caché de imágenes restablecida con éxito")
    }

    return (
        <TabsContent value="system" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Header */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-[#ff6e3a]/10 border border-[#ff6e3a]/15">
                        <svg className="h-3.5 w-3.5 text-[#ff6e3a]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-650 font-mono">SISTEMA · PLATFORMA CORE</span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    CONFIGURACIÓN DEL <span className="text-zinc-650">SISTEMA</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-[#ff6e3a]/50 to-transparent rounded-full" />
                <p className="text-zinc-550 text-sm font-medium leading-relaxed max-w-2xl">
                    Administración global del servidor SQLite, bases de datos internas, logs y notificaciones técnicas.
                </p>
            </header>

            {/* User preferences & Core DB Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {/* Preferencias de Usuario */}
                <div className="bg-white/[0.01] border border-white/5 backdrop-blur-xl rounded-3xl p-6 md:col-span-2 space-y-5 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                    <h4 className="text-xs font-bold text-[#ff6e3a] uppercase tracking-wide">Preferencias de Usuario</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name="library.dohProvider"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Admin Username</label>
                                    <input
                                        type="text"
                                        value={field.value || "Martín"}
                                        onChange={field.onChange}
                                        className="w-full bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-[#ff6e3a]/40 focus:border-transparent transition-all"
                                    />
                                </div>
                            )}
                        />
                        <Controller
                            control={control}
                            name="library.tmdbLanguage"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Idioma de Preferencia</label>
                                    <select
                                        value={field.value || "es-MX"}
                                        onChange={field.onChange}
                                        className="w-full bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-350 focus:outline-none focus:ring-[#ff6e3a]/40 focus:border-transparent transition-all cursor-pointer [&>option]:bg-zinc-950 [&>option]:text-white"
                                    >
                                        <option value="es-MX">Español Latino (Intertrack)</option>
                                        <option value="es-ES">Español (España)</option>
                                        <option value="en-US">English</option>
                                    </select>
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* Base de Datos Core */}
                <div className="bg-white/[0.01] border border-white/5 backdrop-blur-xl rounded-3xl p-6 flex flex-col justify-between shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                            <HardDriveIcon /> Base de Datos Core
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-550 block">Engine: SQLite 3</span>
                    </div>
                    <div className="pt-5 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={handleBackup}
                            className="w-full py-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 rounded-xl transition-all active:scale-[0.98]"
                        >
                            Respaldar DB
                        </button>
                        <button
                            type="button"
                            onClick={handleClearCache}
                            className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-[10px] font-bold uppercase tracking-wider text-red-400 rounded-xl transition-all active:scale-[0.98]"
                        >
                            Limpiar Caché Imágenes
                        </button>
                    </div>
                </div>
            </div>

            {/* Gestión de Notificaciones */}
            <Section label="Notificaciones de la Aplicación">
                <Card className="divide-y divide-white/[0.03]">
                    <Controller
                        control={control}
                        name="notifications.disableNotifications"
                        render={({ field }) => (
                            <OsToggle
                                label="Desactivar Notificaciones Globales"
                                description="Evita que se muestren alertas toast de eventos del sistema."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="notifications.disableAutoScannerNotifications"
                        render={({ field }) => (
                            <OsToggle
                                label="Desactivar Avisos del Escáner"
                                description="No mostrar notificaciones toast en tiempo real cuando se encuentren, indexen o enriquezcan archivos nuevos."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Audio y Efectos */}
            <Section label="Audio y Efectos">
                <Card className="divide-y divide-white/[0.03]">
                    <OsToggle
                        label="Efectos de Sonido"
                        description="Habilita los sonidos de interacción al pasar el cursor o hacer clic sobre tarjetas y menús."
                        checked={uiSoundsEnabled}
                        onChange={setUiSoundsEnabled}
                    />
                    <OsToggle
                        label="Música de Fondo"
                        description="Habilita la reproducción de música ambiental de fondo mientras navegas por KameHouse."
                        checked={bgMusicEnabled}
                        onChange={setBgMusicEnabled}
                    />
                    {bgMusicEnabled && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-white/[0.015] transition-all duration-200 gap-5">
                            <div className="space-y-0.5 flex-1 max-w-xl">
                                <p className="text-sm font-semibold text-zinc-200">Volumen de la Música</p>
                                <p className="text-xs text-zinc-500 font-medium">Ajusta el volumen general de la música de fondo.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-72">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={bgMusicVolume}
                                    onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
                                    className="w-full accent-[#ff6e3a] bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono text-zinc-400 w-8 text-right shrink-0">
                                    {Math.round(bgMusicVolume * 100)}%
                                </span>
                            </div>
                        </div>
                    )}
                </Card>
            </Section>

            {/* Zona de Peligro */}
            <Section label="Zona de Peligro">
                <div className="border border-red-950/30 bg-red-950/[0.01] backdrop-blur-xl rounded-3xl p-6 space-y-6 relative overflow-hidden group/danger shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/80">
                            <AlertIcon />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-red-400/90 tracking-tight">Zona de Riesgo Crítico</h3>
                            <p className="text-xs text-zinc-550 leading-relaxed font-medium">
                                Operaciones destructivas que alteran permanentemente los datos del servidor KameHouse.
                            </p>
                        </div>
                    </div>
                </div>
            </Section>
        </TabsContent>
    )
}
