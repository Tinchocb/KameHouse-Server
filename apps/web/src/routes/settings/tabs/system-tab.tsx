import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { StatusCard, Section } from "../components"
import { LucideCrown, LucideHardDrive, LucideCheckCircle2, LucideAlertTriangle } from "lucide-react"
import { toast } from "sonner"

export function SystemTab() {
    return (
        <TabsContent value="system" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
             <header className="space-y-2">
                <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                    NÚCLEO <span className="text-zinc-500">SISTEMA</span>
                </h1>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl">
                    Información técnica sobre el servidor y estado de los recursos.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard label="Versión" value="3.5.0-ALPHA" icon={LucideCrown} />
                <StatusCard label="Database" value="SQLite (WAL)" icon={LucideHardDrive} />
                <StatusCard label="Entorno" value="Producción" icon={LucideCheckCircle2} />
            </div>

            <Section label="Zona de Peligro">
                <div className="border border-red-950/40 bg-red-950/[0.03] backdrop-blur-md rounded-2xl p-6 space-y-6 relative overflow-hidden group/danger shadow-[inset_0_0_20px_rgba(239,68,68,0.01)]">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/80">
                            <LucideAlertTriangle size={18} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-red-400/90 tracking-tight">Zona de Riesgo Crítico</h3>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Operaciones que modifican permanentemente el estado de tu biblioteca o base de datos.
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-white/[0.02]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 first:pt-0 last:pb-0">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-white/90">Restablecer Caché de Metadatos</h4>
                                <p className="text-xs text-zinc-500">Elimina todas las portadas y sinopsis cacheadas. Esto forzará una descarga limpia en el próximo escaneo.</p>
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
                                <p className="text-xs text-zinc-500">Restablece todos los ajustes a los valores iniciales por defecto. Esta acción no se puede deshacer.</p>
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
