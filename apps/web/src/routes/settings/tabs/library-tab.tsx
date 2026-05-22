import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, PathList, OsToggle, OsInput } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { LucideFolderOpen } from "lucide-react"

export function LibraryTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="library" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
            {/* ── Header ── */}
            <header className="space-y-4">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.01)]">
                        <LucideFolderOpen className="w-6 h-6 text-white/80" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                            AJUSTES DE <span className="text-zinc-500">BIBLIOTECA</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em]">
                            Ubicación de medios y preferencias del motor del escáner
                        </p>
                    </div>
                </div>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl pt-2">
                    Configura las rutas físicas donde almacenas tu colección. El motor inteligente organizará tus archivos recursivamente y los sincronizará con metadatos.
                </p>
            </header>

            {/* ── 1. Rutas de Almacenamiento ── */}
            <Section label="Rutas de Almacenamiento">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <Card>
                        <PathList
                            control={control}
                            name="library.seriesPaths"
                            label="Directorio de Series / Anime"
                            placeholder="Ej. D:\Media\Anime o /media/anime"
                        />
                    </Card>
                    <Card>
                        <PathList
                            control={control}
                            name="library.moviePaths"
                            label="Directorio de Películas"
                            placeholder="Ej. D:\Media\Peliculas o /media/movies"
                        />
                    </Card>
                </div>
            </Section>

            {/* ── 2. Preferencias del Escáner e Identificación ── */}
            <Section label="Motor de Indexación e Inteligencia">
                <Card>
                    <OsToggle
                        control={control}
                        name="library.autoScan"
                        label="Auto-Escaneo de Directorios"
                        desc="Detecta automáticamente cuando agregas o modificas archivos en tus carpetas locales y ejecuta un escaneo incremental."
                    />
                    <OsToggle
                        control={control}
                        name="library.refreshLibraryOnStart"
                        label="Actualizar Biblioteca al Iniciar"
                        desc="Lanza un escaneo rápido incremental automáticamente al arrancar el servidor de KameHouse."
                    />
                    <OsToggle
                        control={control}
                        name="library.scannerStrictStructure"
                        label="Ordenamiento Estricto de Carpetas"
                        desc="Fuerza al analizador a asumir estructuras rígidas de nombres (ej. Temporada XX/Nombre del archivo) en lugar de analizar el archivo de forma flexible."
                    />
                    <OsToggle
                        control={control}
                        name="library.scannerUseLegacyMatching"
                        label="Algoritmo de Búsqueda Legacy"
                        desc="Activa el motor de coincidencia antiguo en caso de que los títulos complejos no se resuelvan correctamente con el nuevo motor."
                    />
                    <OsToggle
                        control={control}
                        name="library.disableLocalScanning"
                        label="Desactivar Escaneo Físico Local"
                        desc="Evita que el servidor analice el disco duro. Útil si solo reproduces contenido en la nube (Online Stream)."
                    />
                    <OsInput
                        control={control}
                        name="library.scannerMatchingThreshold"
                        label="Umbral de Coincidencia (%)"
                        desc="Porcentaje de similitud mínima del título del archivo para autovincular con TMDB (0 para auto-calibrar)."
                        type="number"
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
