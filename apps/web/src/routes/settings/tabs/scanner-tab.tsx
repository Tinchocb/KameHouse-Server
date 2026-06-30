import React from "react"
import { ScannerDashboard } from "@/components/ui/scanner/ScannerDashboard"
import { Section, OsToggle } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface ScannerTabProps {
    control: Control<SettingsFormValues>
}

export function ScannerTab({ control }: ScannerTabProps) {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">

            {/* Scouter engine parameters */}
            <div className="bg-surface-container rounded-container p-6 shadow-elevation-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Range slider for scoring threshold */}
                    <Controller
                        control={control}
                        name="library.scannerMatchingThreshold"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[11px] font-mono font-bold text-on-surface-variant">
                                    <span>Umbral de Sensibilidad (Scoring Threshold)</span>
                                    <span className="text-[#ff6e3a] font-bold">{(field.value || 82) / 100} (Dice)</span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="95"
                                    value={field.value || 82}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-surface-container rounded-lg appearance-none cursor-pointer accent-brand-secondary mt-2"
                                />
                                <p className="text-[10px] text-on-surface-variant mt-1">Valores altos evitan falsos positivos pero requieren nombres de archivos limpios.</p>
                            </div>
                        )}
                    />

                    {/* Scan Frequency */}
                    <div className="flex flex-col gap-2">
                        <label htmlFor="scan-frequency-select" className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">Frecuencia del Escáner en segundo plano</label>
                        <Controller
                            control={control}
                            name="library.scannerProvider"
                            render={({ field }) => (
                                <select
                                    id="scan-frequency-select"
                                    value={field.value || "manual"}
                                    onChange={field.onChange}
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all cursor-pointer [&>option]:bg-[#141418] [&>option]:text-on-surface mt-1.5"
                                >
                                    <option value="manual">Solo manual o por Debouncer en tiempo real</option>
                                    <option value="6h">Cada 6 horas</option>
                                    <option value="24h">Cada 24 horas</option>
                                </select>
                            )}
                        />
                    </div>
                </div>

                <hr className="border-outline-variant" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Matching Algorithm */}
                    <div className="flex flex-col gap-2">
                        <label htmlFor="matching-algorithm-select" className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">Algoritmo de Emparejamiento</label>
                        <Controller
                            control={control}
                            name="library.scannerMatchingAlgorithm"
                            render={({ field }) => (
                                <select
                                    id="matching-algorithm-select"
                                    value={field.value || "dice"}
                                    onChange={field.onChange}
                                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-on-surface-variant focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all cursor-pointer [&>option]:bg-[#141418] [&>option]:text-on-surface mt-1.5"
                                >
                                    <option value="dice">Coeficiente Dice (Recomendado)</option>
                                    <option value="levenshtein">Distancia de Levenshtein</option>
                                    <option value="stringMatch">Coincidencia de Cadenas Simple</option>
                                </select>
                            )}
                        />
                    </div>

                    {/* Fallback Metadata */}
                    <div className="flex flex-col justify-center pt-2">
                        <Controller
                            control={control}
                            name="library.useFallbackMetadataProvider"
                            render={({ field }) => (
                                <OsToggle
                                    label="Proveedor de Metadatos de Respaldo"
                                    description="Habilita fuentes de metadatos secundarias si falla la consulta del servidor principal."
                                    checked={!!field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                    </div>
                </div>

            {/* Scanner Bento Dashboard */}
            <Section label="Diagnóstico en Vivo">
                <div className="pt-2">
                    <ScannerDashboard />
                </div>
            </Section>
        </div>
    )
}
