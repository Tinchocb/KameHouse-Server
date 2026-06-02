import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { StatusCard, Section, Card, OsToggle } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"

interface SystemTabProps {
    control: Control<SettingsFormValues>
}

// Custom simple icons to replace Lucide
const CrownIcon = () => (
    <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
        <path d="M5 20h14" />
    </svg>
)

const HardDriveIcon = () => (
    <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="14" x2="6.01" y2="14" />
        <line x1="10" y1="14" x2="10.01" y2="14" />
    </svg>
)

const CheckCircleIcon = () => (
    <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
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
    const handleResetCache = () => {
        toast.success("Caché de metadatos restablecida con éxito")
    }

    return (
        <TabsContent value="system" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
             {/* Header */}
             <header className="space-y-3 pt-2">
                 <div className="flex items-center gap-3 mb-1">
                     <div className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/15">
                         <svg className="h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                             <circle cx="12" cy="12" r="3" />
                             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                         </svg>
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">NÚCLEO · PARÁMETROS DEL SISTEMA</span>
                 </div>
                 <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                     NÚCLEO DEL <span className="text-zinc-600">SISTEMA</span>
                 </h1>
                 <div className="h-[2px] w-12 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full" />
                 <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                     Información técnica sobre el servidor, estado de los recursos de la base de datos y opciones de red.
                 </p>
             </header>

            {/* Información Técnica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard label="Versión" value="3.5.0-ALPHA" icon={CrownIcon} />
                <StatusCard label="Database" value="SQLite (WAL)" icon={HardDriveIcon} />
                <StatusCard label="Entorno" value="Producción" icon={CheckCircleIcon} />
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

            {/* Zona de Peligro */}
            <Section label="Zona de Peligro">
                <div className="border border-red-950/40 bg-red-950/[0.03] backdrop-blur-md rounded-2xl p-6 space-y-6 relative overflow-hidden group/danger shadow-[inset_0_0_20px_rgba(239,68,68,0.01)]">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/80">
                            <AlertIcon />
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
                                <p className="text-xs text-zinc-500">Elimina las portadas y sinopsis cacheadas localmente, forzando una nueva descarga limpia desde TMDB.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleResetCache}
                                className="text-red-400 hover:text-red-300 font-bold uppercase text-xs tracking-wider transition-all duration-300 active:scale-95 shrink-0 px-4 py-2 border border-red-950/40 hover:border-red-900/60 bg-red-500/5 hover:bg-red-500/10 rounded-xl"
                            >
                                Limpiar Caché
                            </button>
                        </div>
                    </div>
                </div>
            </Section>
        </TabsContent>
    )
}
