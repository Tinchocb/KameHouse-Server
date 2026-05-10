import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { ScanButton, Section, Card, PathList } from "../components"
import { type Control, type FieldValues } from "react-hook-form"

export function LibraryTab({ isScanning, handleScan, control }: { isScanning: boolean; handleScan: (full: boolean) => void; control: Control<FieldValues> }) {
    return (
        <TabsContent value="library" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <header className="space-y-4">
                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">BIBLIOTECA <span className="text-zinc-500">CONTROL</span></h1>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Gestiona el motor de escaneo inteligente. El escaneo Delta ahorra recursos analizando solo cambios recientes.</p>
            </header>

            <div className="flex gap-4">
                <ScanButton 
                    variant="delta" 
                    onClick={() => handleScan(false)} 
                    loading={isScanning} 
                />
                <ScanButton 
                    variant="full" 
                    onClick={() => handleScan(true)} 
                    loading={isScanning} 
                />
            </div>

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

            <div className="pt-4">
                <ScannerDashboard />
            </div>

            <div className="space-y-5 pt-8">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px w-12 bg-white/20" />
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400">Archivos no Identificados</p>
                </div>
                <UnlinkedFilesPanel />
            </div>
        </TabsContent>
    )
}
