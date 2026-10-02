import { cn } from "@/components/ui/core/styling"
import { m } from "framer-motion"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { IconStatusFolder, IconStatusZap, IconMediaPlay, IconUiSettings, IconUiCheck } from "@/components/ui/icons"
import { itemVariants } from "./variants"

export const STEPS = [
    {
        id: "library",
        stepNumber: "1",
        title: "Biblioteca",
        subtitle: "Rutas de carpetas",
        icon: IconStatusFolder,
    },
    {
        id: "engine",
        stepNumber: "2",
        title: "Motor de Video",
        subtitle: "FFmpeg & FFprobe",
        icon: IconStatusZap,
    },
    {
        id: "playback",
        stepNumber: "3",
        title: "Reproducción",
        subtitle: "Auto-skip y maratón",
        icon: IconMediaPlay,
    },
    {
        id: "language",
        stepNumber: "4",
        title: "Idioma",
        subtitle: "Metadatos y títulos",
        icon: IconUiSettings,
    },
]

export function StepIndicator({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void }) {
    const tabIndicatorSpring = useSpringPreset("tabIndicator")
    return (
        <div className="w-full mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
                {STEPS.map((step, i) => {
                    const isActive = i === currentStep
                    const isCompleted = i < currentStep
                    return (
                        <m.button
                            type="button"
                            key={step.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onStepClick(i)}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out text-left relative overflow-hidden cursor-pointer",
                                isActive
                                    ? "bg-brand-accent/15 border-brand-accent/50 text-on-surface shadow-elevation-1"
                                    : isCompleted
                                        ? "bg-surface-container/70 border-border-subtle text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong"
                                        : "bg-surface-container/40 border-border-subtle/50 text-on-surface-variant/70 [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-subtle"
                            )}
                        >
                            {isActive && (
                                <m.div
                                    layoutId="step-active-indicator"
                                    className="absolute inset-0 bg-brand-accent/10 pointer-events-none rounded-xl"
                                    transition={tabIndicatorSpring}
                                />
                            )}
                            <div
                                className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-[background-color,border-color,color,box-shadow] duration-fast ease-out-strong",
                                    isActive
                                        ? "bg-brand-accent text-on-primary shadow-md shadow-brand-accent/30"
                                        : isCompleted
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : "bg-surface-container-high text-on-surface-variant"
                                )}
                            >
                                {isCompleted ? <IconUiCheck className="w-3.5 h-3.5" /> : step.stepNumber}
                            </div>
                            <div className="min-w-0">
                                <p className={cn("text-xs font-bold tracking-tight truncate", isActive ? "text-on-surface" : "text-on-surface-variant")}>
                                    {step.title}
                                </p>
                                <p className="text-3xs text-on-surface-variant/70 truncate">
                                    {step.subtitle}
                                </p>
                            </div>
                        </m.button>
                    )
                })}
            </div>
        </div>
    )
}

export interface StepCardProps {
    children?: React.ReactNode
    className?: string
}

export function StepCard({ children, className }: StepCardProps) {
    return (
        <m.div
            variants={itemVariants}
            className={cn(
                "relative rounded-2xl bg-surface/80 backdrop-blur-overlay-xl border border-border-subtle p-4 sm:p-5 shadow-modal overflow-hidden",
                className,
            )}
        >
            {children}
        </m.div>
    )
}
