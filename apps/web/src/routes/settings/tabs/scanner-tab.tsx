import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { Section, Card, OsToggle, OsInput } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { LucideRefreshCw, LucideCpu, LucideTag, LucideHardDrive } from "lucide-react"

export function ScannerTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="scanner" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* ── Header ── */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                        <LucideRefreshCw className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">CONSOLA · MANTENIMIENTO TÉCNICO</span>
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                    </span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    MANTENIMIENTO <span className="text-zinc-600">Y ESCÁNER</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                    Supervisa el estado del motor de búsqueda en tiempo real, ejecuta escaneos profundos de metadatos o resuelve archivos que no coinciden automáticamente.
                </p>
            </header>

            {/* ── Scanner Bento Dashboard ── */}
            <div className="pt-2">
                <ScannerDashboard />
            </div>

            {/* ── Ajustes de Comportamiento del Escáner ── */}
            <Section label="Comportamiento e Inteligencia del Escáner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Escaneo Automatizado */}
                    <Card className="p-6 space-y-4 hover:border-brand-orange/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-brand-orange">
                                    <LucideRefreshCw size={16} />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Escaneo Automatizado</h3>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Monitorea los cambios de archivos y automatiza la actualización de tu catálogo local.
                            </p>
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            <OsToggle
                                control={control}
                                name="library.autoScan"
                                label="Auto-Escaneo de Directorios"
                                desc="Ejecuta escaneos incrementales automáticos al añadir o modificar archivos."
                            />
                            <OsToggle
                                control={control}
                                name="library.refreshLibraryOnStart"
                                label="Escanear al Iniciar"
                                desc="Lanza un escaneo rápido del disco al arrancar el servidor."
                            />
                        </div>
                    </Card>

                    {/* Card 2: Algoritmos de Coincidencia */}
                    <Card className="p-6 space-y-4 hover:border-brand-orange/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-brand-orange">
                                    <LucideCpu size={16} />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Algoritmos de Coincidencia</h3>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Ajusta la sensibilidad y las reglas del analizador al procesar nombres de archivos complejos.
                            </p>
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            <OsToggle
                                control={control}
                                name="library.scannerStrictStructure"
                                label="Estructura Estricta"
                                desc="Asume carpetas estructuradas rígidamente (Ej. Temporada/Episodio)."
                            />
                            <OsToggle
                                control={control}
                                name="library.scannerUseLegacyMatching"
                                label="Algoritmo Legacy"
                                desc="Usa el motor de búsqueda antiguo para títulos muy complejos."
                            />
                        </div>
                    </Card>

                    {/* Card 3: Metadatos & Sensibilidad */}
                    <Card className="p-6 space-y-4 hover:border-brand-orange/20 transition-all duration-300 flex flex-col justify-between md:col-span-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-brand-orange">
                                    <LucideTag size={16} />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Metadatos & Sensibilidad</h3>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Modifica el comportamiento de descarga de metadatos e imágenes.
                            </p>
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                            <OsToggle
                                control={control}
                                name="library.useFallbackMetadataProvider"
                                label="Proveedor de Metadatos Alternativo"
                                desc="Usa fuentes secundarias en caso de fallos del proveedor principal."
                            />
                            <OsInput
                                control={control}
                                name="library.scannerMatchingThreshold"
                                label="Umbral de Similitud (%)"
                                desc="Similitud mínima requerida del nombre para autovincular con TMDB (0 para auto-calibrar)."
                                type="number"
                            />
                        </div>
                    </Card>

                    {/* Card 4: Aislamiento de Disco */}
                    <Card className="p-6 space-y-4 hover:border-brand-orange/20 transition-all duration-300 md:col-span-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-red-500">
                                <LucideHardDrive size={16} />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Aislamiento de Disco</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                            Configura si el servidor debe omitir la lectura del disco duro.
                        </p>
                        <div className="pt-2">
                            <OsToggle
                                control={control}
                                name="library.disableLocalScanning"
                                label="Desactivar Escaneo Físico Local"
                                desc="Ideal si solo consumes contenido en la nube (Online Stream)."
                            />
                        </div>
                    </Card>
                </div>
            </Section>

            {/* ── Archivos sin identificar ── */}
            <Section label="Archivos no Identificados">
                <div className="bg-card/10 border border-white/5 rounded-2xl overflow-hidden p-1">
                    <UnlinkedFilesPanel />
                </div>
            </Section>
        </TabsContent>
    )
}
