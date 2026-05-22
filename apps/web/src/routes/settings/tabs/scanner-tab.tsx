import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { Section } from "../components"

export function ScannerTab() {
    return (
        <TabsContent value="scanner" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
            {/* ── Header ── */}
            <header className="space-y-4">
                <div className="flex items-center gap-5">
                    <div className="space-y-1">
                        <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                            MANTENIMIENTO <span className="text-zinc-500">Y ESCÁNER</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em]">
                            Consola de control técnico y depuración de la biblioteca
                        </p>
                    </div>
                </div>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl pt-2">
                    Supervisa el estado del motor de búsqueda en tiempo real, ejecuta escaneos profundos de metadatos o resuelve archivos que no coinciden automáticamente.
                </p>
            </header>

            {/* ── Scanner Bento Dashboard ── */}
            <div className="pt-2">
                <ScannerDashboard />
            </div>

            {/* ── Archivos sin identificar ── */}
            <Section label="Archivos no Identificados">
                <div className="bg-card/10 border border-white/5 rounded-2xl overflow-hidden p-1">
                    <UnlinkedFilesPanel />
                </div>
            </Section>
        </TabsContent>
    )
}
