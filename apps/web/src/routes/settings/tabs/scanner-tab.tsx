import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { UnlinkedFilesPanel } from "@/components/ui/scanner/UnlinkedFilesPanel"
import { Section, Card, OsInput, OsSelect } from "../components"
import { type Control, type UseFormRegister } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface ScannerTabProps {
    control: Control<SettingsFormValues>
    register: UseFormRegister<SettingsFormValues>
}

export function ScannerTab({ control, register }: ScannerTabProps) {
    return (
        <TabsContent value="scanner" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Header */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/15">
                        <svg className="h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">CONSOLA · MANTENIMIENTO TÉCNICO</span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    MANTENIMIENTO <span className="text-zinc-600">Y ESCÁNER</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                    Supervisa el estado del motor de búsqueda en tiempo real, ejecuta escaneos profundos de metadatos o resuelve archivos que no coinciden automáticamente.
                </p>
            </header>

            {/* Scanner Bento Dashboard */}
            <div className="pt-2">
                <ScannerDashboard />
            </div>

            {/* Ajustes de Comportamiento del Escáner */}
            <Section label="Configuración del Motor de Indexación">
                <Card className="divide-y divide-white/[0.03]">
                    <OsSelect
                        label="Precisión del Escáner"
                        description="Define el nivel de rigurosidad al indexar archivos locales en el disco."
                        options={[
                            { value: "fast", label: "Head/Tail O(1) rápido (Recomendado)" },
                            { value: "deep", label: "Deep hash completo (Precisión máxima)" }
                        ]}
                        {...register("library.scannerMatchingAlgorithm")}
                    />
                    <OsInput
                        label="Límite de Descargas Concurrentes"
                        description="Número de descargas simultáneas permitidas para servicios de Torrent / Debrid."
                        type="number"
                        placeholder="Ej. 5"
                        {...register("library.scannerMatchingThreshold", { valueAsNumber: true })}
                    />
                </Card>
            </Section>

            {/* Archivos sin identificar */}
            <Section label="Archivos no Identificados">
                <div className="bg-card/10 border border-white/5 rounded-2xl overflow-hidden p-1">
                    <UnlinkedFilesPanel />
                </div>
            </Section>
        </TabsContent>
    )
}
