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
            animate={isActive ? {
                boxShadow: [`0 0 0 rgba(249,115,22,0)`, `0 0 40px ${stage.glowColor}`, `0 0 0 rgba(249,115,22,0)`],
            } : {}}
            transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
            className={cn(
                "relative p-7 rounded-none border transition-all duration-700 overflow-hidden group",
                isActive
                    ? "border-white/40 bg-white/10"
                    : isDone
                        ? "border-white/20 bg-white/5"
                        : "border-white/5 bg-black/20"
            )}
        >
            {(isActive || isDone) && (
                <div
                    className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full blur-[50px] transition-opacity duration-700"
                    style={{ backgroundColor: stage.glowColor, opacity: isDone ? 0.2 : 0.5 }}
                />
            )}

            <div className="relative space-y-4">
                <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                    isActive
                        ? `${stage.color} border-white/20 bg-white/10 scale-110`
                        : isDone
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            : `${stage.color} border-white/10 bg-white/5 opacity-40 group-hover:opacity-70`
                )}>
                    {isDone && !isActive ? <LucideCheck size={20} /> : stage.icon}
                </div>

                <div>
                    <p className={cn(
                        "text-xs font-black uppercase tracking-widest transition-colors duration-500",
                        isActive ? stage.color : isDone ? "text-zinc-400" : "text-zinc-600"
                    )}>
                        {stage.shortLabel}
                    </p>
                    <p className="text-sm font-semibold text-white/70 mt-1 leading-tight">{stage.label}</p>
                </div>

                {isActive && (
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                        initial={{ scaleX: 0, transformOrigin: "left" }}
                        animate={{ scaleX: [0, 1, 0], transition: { duration: 2, repeat: Infinity } }}
                    />
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
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={center} cy={center} r={radius}
                stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} fill="none" />
            <motion.circle
                cx={center} cy={center} r={radius}
                stroke="white"
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="square"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset: offset }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
            <text
                x={center} y={center}
                className="fill-white font-bold"
                textAnchor="middle" dominantBaseline="central"
                fontSize="14" fontWeight="900"
                transform={`rotate(90, ${center}, ${center})`}
                style={{ fontFamily: "inherit" }}
            >
                {Math.round(progress)}%
            </text>
        </svg>
    )
}
