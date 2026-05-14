import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import {
    LucideActivity, LucideCheck,
    LucideClipboardList, LucideDatabase,
    LucideScissors, LucideSearch, LucideShield,
} from "lucide-react"

export interface PipelineStage {
    id: string
    label: string
    shortLabel: string
    description: string
    icon: React.ReactNode
    color: string
    glowColor: string
}

export const PIPELINE_STAGES: PipelineStage[] = [
    {
        id: "walk",
        label: "Descubrimiento",
        shortLabel: "Walk",
        description: "Recorre el sistema de archivos buscando videos",
        icon: <LucideSearch size={18} />,
        color: "text-blue-400",
        glowColor: "rgba(59,130,246,0.4)",
    },
    {
        id: "parse",
        label: "Parseo",
        shortLabel: "Parse",
        description: "Extrae metadata de nombre de archivo y carpetas",
        icon: <LucideClipboardList size={18} />,
        color: "text-violet-400",
        glowColor: "rgba(139,92,246,0.4)",
    },
    {
        id: "resolve",
        label: "Identificación",
        shortLabel: "Bayesian",
        description: "Motor Bayesiano con scoring Dice-coefficient",
        icon: <LucideShield size={18} />,
        color: "text-white",
        glowColor: "rgba(255,255,255,0.1)",
    },
    {
        id: "probe",
        label: "Análisis Técnico",
        shortLabel: "FFprobe",
        description: "FFprobe + detección de subtítulos externos",
        icon: <LucideActivity size={18} />,
        color: "text-emerald-400",
        glowColor: "rgba(16,185,129,0.4)",
    },
    {
        id: "persist",
        label: "Persistencia",
        shortLabel: "Persist",
        description: "Guarda snapshot JSON en la base de datos",
        icon: <LucideDatabase size={18} />,
        color: "text-sky-400",
        glowColor: "rgba(14,165,233,0.4)",
    },
    {
        id: "prune",
        label: "Limpieza",
        shortLabel: "Prune",
        description: "Elimina archivos borrados del disco de la DB",
        icon: <LucideScissors size={18} />,
        color: "text-rose-400",
        glowColor: "rgba(244,63,94,0.4)",
    },
]

export function PipelineStageCard({ stage, isActive, isDone }: {
    stage: PipelineStage
    isActive: boolean
    isDone: boolean
}) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            animate={isActive ? {
                boxShadow: [`0 0 0 rgba(255,110,58,0)`, `0 0 40px ${stage.glowColor}`, `0 0 0 rgba(255,110,58,0)`],
            } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
                "relative p-6 rounded-none border transition-all duration-500 overflow-hidden group",
                isActive
                    ? "border-primary/40 bg-primary/5 shadow-2xl shadow-primary/20"
                    : isDone
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20"
            )}
        >
            {/* Ambient Background Gradient */}
            <div 
                className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000",
                    "bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.05),transparent_70%)]"
                )}
            />

            <div className="relative space-y-4">
                <div className={cn(
                    "w-12 h-12 rounded-none flex items-center justify-center border transition-all duration-500",
                    isActive
                        ? "text-primary border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(255,110,58,0.3)]"
                        : isDone
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : "text-zinc-600 border-white/5 bg-white/[0.02]"
                )}>
                    {isDone && !isActive ? <LucideCheck size={20} strokeWidth={3} /> : stage.icon}
                </div>

                <div>
                    <p className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500",
                        isActive ? "text-primary" : isDone ? "text-emerald-500/60" : "text-zinc-600"
                    )}>
                        {stage.shortLabel}
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5 tracking-tight">{stage.label}</p>
                </div>

                {isActive && (
                    <div className="absolute -bottom-6 -left-6 right-0 h-1">
                        <motion.div 
                            className="h-full bg-primary"
                            animate={{ 
                                x: ["-100%", "200%"],
                                opacity: [0, 1, 0]
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                )}
            </div>
        </motion.div>
    )
}

export function ProgressRing({ progress, size, stroke }: { progress: number; size: number; stroke: number }) {
    const radius = (size - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (progress / 100) * circumference
    const center = size / 2

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="shrink-0 -rotate-90">
                {/* Background Shadow Ring */}
                <circle cx={center} cy={center} r={radius}
                    stroke="rgba(0,0,0,0.5)" strokeWidth={stroke + 2} fill="none" />
                
                {/* Track */}
                <circle cx={center} cy={center} r={radius}
                    stroke="rgba(255,255,255,0.03)" strokeWidth={stroke} fill="none" />
                
                {/* Progress */}
                <motion.circle
                    cx={center} cy={center} r={radius}
                    stroke="#ff6e3a"
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ type: "spring", stiffness: 40, damping: 15 }}
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,110,58,0.5))" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bebas text-3xl text-white leading-none">{Math.round(progress)}</span>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">%</span>
            </div>
        </div>
    )
}
