import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { StatusCard, Section, Card, OsToggle } from "../components"
import { LucideCrown, LucideHardDrive, LucideCheckCircle2, LucideAlertTriangle, LucideCpu } from "lucide-react"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"

export function SystemTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="system" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
             {/* ── Header ── */}
             <header className="space-y-3 pt-2">
                 <div className="flex items-center gap-3 mb-1">
                     <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                         <LucideCpu className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">NÚCLEO · PARÁMETROS DEL SISTEMA</span>
                     <span className="relative flex h-1.5 w-1.5">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                     </span>
                 </div>
                 <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                     NÚCLEO DEL <span className="text-zinc-600">SISTEMA</span>
                 </h1>
                 <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                 <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                     Información técnica sobre el servidor, estado de los recursos de la base de datos y opciones de red.
                 </p>
             </header>

            {/* ── 1. Información Técnica ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard label="Versión" value="3.5.0-ALPHA" icon={LucideCrown} />
                <StatusCard label="Database" value="SQLite (WAL)" icon={LucideHardDrive} />
                <StatusCard label="Entorno" value="Producción" icon={LucideCheckCircle2} />
            </div>

            {/* ── 2. Preferencias de la Plataforma ── */}
            <Section label="Comportamiento de la Plataforma">
                <Card>
                    <OsToggle
                        control={control}
                        name="Platform.hideAudienceScore"
                        label="Ocultar Calificaciones Públicas"
                        desc="Oculta las puntuaciones y valoraciones promedio de TMDB o AniList en las tarjetas de anime, series y películas."
                    />
                    <OsToggle
                        control={control}
                        name="Platform.disableCacheLayer"
                        label="Desactivar Capa de Caché"
                        desc="Deshabilita la caché intermedia en memoria para metadatos del servidor. Forzará consultas en vivo (no recomendado en producción)."
                    />
                </Card>
            </Section>

            {/* ── 3. Gestión de Notificaciones ── */}
            <Section label="Notificaciones de la Aplicación">
                <Card>
                    <OsToggle
                        control={control}
                        name="notifications.disableNotifications"
                        label="Desactivar Notificaciones Globales"
                        desc="Deshabilita por completo todos los avisos y alertas flotantes del sistema en la interfaz de usuario."
                    />
                    <OsToggle
                        control={control}
                        name="notifications.disableAutoScannerNotifications"
                        label="Desactivar Avisos del Escáner"
                        desc="No mostrar notificaciones toast en tiempo real cuando se encuentren, indexen o enriquezcan archivos nuevos."
                    />
                </Card>
            </Section>

            {/* ── 4. Zona de Peligro ── */}
            <Section label="Zona de Peligro">
                <div className="border border-red-950/40 bg-red-950/[0.03] backdrop-blur-md rounded-2xl p-6 space-y-6 relative overflow-hidden group/danger shadow-[inset_0_0_20px_rgba(239,68,68,0.01)]">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/80">
                            <LucideAlertTriangle size={18} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-red-400/90 tracking-tight">Zona de Riesgo Crítico</h3>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Operaciones administrativas destructivas que alteran permanentemente los datos del servidor.
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-white/[0.02]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 first:pt-0 last:pb-0">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-white/90">Restablecer Caché de Metadatos</h4>
                                <p className="text-xs text-zinc-500">Elimina las portadas y sinopsis cacheadas localmente, forzando una nueva descarga limpia desde TMDB/AniList.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => toast.success("Caché restablecida con éxito")}
                                className="px-4 py-2 border border-red-900/30 hover:border-red-900/60 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 shrink-0"
                            >
                                Limpiar Caché
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 last:pb-0">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-white/90">Reiniciar Configuración de Fábrica</h4>
                                <p className="text-xs text-zinc-500">Restablece de forma irreversible todos los valores de este formulario a sus parámetros por defecto iniciales.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => toast.error("Función restringida en entorno demo")}
                                className="px-4 py-2 border border-red-900/30 hover:border-red-900/60 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 shrink-0"
                            >
                                Restablecer Ajustes
                            </button>
                        </div>
                    </div>
                </div>
            </Section>
        </TabsContent>
    )
}
