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
        <TabsContent value="library" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* ── Header ── */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                        <LucideFolderOpen className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">ALMACENAMIENTO · INDEXACIÓN</span>
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                    </span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    AJUSTES DE <span className="text-zinc-600">BIBLIOTECA</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
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
