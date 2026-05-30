import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, PathList, OsToggle, OsInput } from "../components"
import { type Control, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { 
    LucideFolderOpen, LucideRefreshCw, LucideCpu, LucideTag, 
    LucideHardDrive, LucideGlobe, LucidePlayCircle, LucideRotateCw 
} from "lucide-react"

export function LibraryTab({ control }: { control: Control<SettingsFormValues> }) {
    const enableOnlinestream = useWatch({ control, name: "library.enableOnlinestream" })

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
                    <Card className="hover:border-primary/20 transition-all duration-300">
                        <PathList
                            control={control}
                            name="library.seriesPaths"
                            label="Directorio de Series / Anime"
                            placeholder="Ej. D:\Media\Anime o /media/anime"
                        />
                    </Card>
                    <Card className="hover:border-primary/20 transition-all duration-300">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 2.1: Real-time Scanning */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
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

                    {/* Card 2.2: Matching Algorithms */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
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

                    {/* Card 2.3: Metadata Providers */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between md:col-span-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
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

                    {/* Card 2.4: Physical Scanning Toggle */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 md:col-span-2">
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
            {/* ── 3. Visualización & Sincronización ── */}
            <Section label="Visualización & Sincronización">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 3.1: Card UI preferences */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
                                    <LucidePlayCircle size={16} />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Visualización e Interfaz</h3>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Modifica el comportamiento estético e interactivo del catálogo.
                            </p>
                        </div>
                        <div className="pt-2">
                            <OsToggle
                                control={control}
                                name="library.disableAnimeCardTrailers"
                                label="Desactivar Trailers en Portadas"
                                desc="Evita que se reproduzcan trailers al pasar el mouse por las tarjetas."
                            />
                        </div>
                    </Card>

                    {/* Card 3.2: Syncing & Server Startup */}
                    <Card className="p-6 space-y-4 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-primary">
                                    <LucideRotateCw size={16} />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Sincronización & Arranque</h3>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                Gestiona las sincronizaciones con trackers externos y las acciones iniciales del servidor.
                            </p>
                        </div>
                        <div className="divide-y divide-white/[0.02] pt-2">
                            <OsToggle
                                control={control}
                                name="library.autoUpdateProgress"
                                label="Sincronizar Progreso de Tracking"
                                desc="Envía automáticamente los capítulos vistos a servicios como AniList."
                            />
                            <OsToggle
                                control={control}
                                name="library.openWebURLOnStart"
                                label="Abrir Navegador al Arrancar"
                                desc="Abre la página web de KameHouse automáticamente al prender el servidor."
                            />
                            <OsToggle
                                control={control}
                                name="library.autoSyncOfflineLocalData"
                                label="Auto-Sincronización Offline"
                                desc="Guarda los avances en caché local cuando no hay conexión."
                            />
                        </div>
                    </Card>
                </div>
            </Section>
        </TabsContent>
    )
}
