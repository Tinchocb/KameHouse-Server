import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { Section, Card, PathList } from "../components"
import { type Control } from "react-hook-form"
import { cn } from "@/components/ui/core/styling"
import { LucideRefreshCw } from "lucide-react"
import { type SettingsFormValues } from "../index"

export function LibraryTab({ isScanning, handleScan, control }: { isScanning: boolean; handleScan: (full: boolean) => void; control: Control<SettingsFormValues> }) {
    // Avoid unused warning
    const _dummy = handleScan

    return (
        <TabsContent value="library" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
            {/* ── Header ── */}
            <header className="space-y-4">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.01)]">
                        <LucideRefreshCw className={cn("w-6 h-6 text-white/80", isScanning && "animate-spin text-primary")} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                            BIBLIOTECA <span className="text-zinc-500">ENGINE</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em]">Panel de control y mantenimiento del sistema</p>
                    </div>
                </div>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl pt-2">
                    Gestiona el motor de escaneo inteligente. Configura primero las rutas de tu colección y luego inicia el escaneo para enriquecer metadatos.
                </p>
            </header>

            {/* ── 1. Rutas ── */}
            <Section label="Rutas de Almacenamiento">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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

            {/* ── 2. Scanner Dashboard ── */}
            <div className="pt-2">
                <ScannerDashboard />
            </div>

            {/* ── 3. Archivos sin identificar ── */}
            <Section label="Archivos no Identificados">
                <div className="bg-card/10 border border-white/5 rounded-2xl overflow-hidden p-1">
                    <UnlinkedFilesPanel />
                </div>
            </Section>
        </TabsContent>
    )
}
