import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { Section, Card, PathList } from "../components"
import { type Control } from "react-hook-form"
import { cn } from "@/components/ui/core/styling"
import { LucideRefreshCw } from "lucide-react"
import { type SettingsFormValues } from "../index"

export function LibraryTab({ isScanning, control }: { isScanning: boolean; handleScan: (full: boolean) => void; control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="library" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">

            {/* ── Header ── */}
            <header className="space-y-6">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-white/5 border border-white/10 flex items-center justify-center">
                        <LucideRefreshCw className={cn("w-10 h-10 text-white", isScanning && "animate-spin")} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-8xl font-black tracking-tighter text-white font-bebas leading-none">BIBLIOTECA <span className="text-zinc-500">ENGINE</span></h1>
                        <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.4em]">Panel de control y mantenimiento del sistema</p>
                    </div>
                </div>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-4xl pt-2">
                    Gestiona el motor de escaneo inteligente. Configura primero las rutas de tu colección y luego inicia el escaneo para enriquecer metadatos.
                </p>
            </header>

            {/* ── 1. Rutas (prerequisito) ── */}
            <Section label="Rutas de Almacenamiento">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <Card>
                        <PathList
                            control={control}
                            name="library.seriesPaths"
                            label="Directorio de Series / Anime"
                            placeholder="Ej. D:\Media\Anime"
                        />
                    </Card>
                    <Card>
                        <PathList
                            control={control}
                            name="library.moviePaths"
                            label="Directorio de Películas"
                            placeholder="Ej. D:\Media\Peliculas"
                        />
                    </Card>
                </div>
            </Section>

            {/* ── 2. Scanner Dashboard (único) ── */}
            <ScannerDashboard />

            {/* ── 3. Archivos sin identificar ── */}
            <Section label="Archivos no Identificados">
                <UnlinkedFilesPanel />
            </Section>

        </TabsContent>
    )
}
