import React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconStatusGhost } from "@/components/ui/icons";
import { useMotionTier } from "@/components/ui/kinetics/hooks"

interface EmptyStateProps {
    title?: string
    message?: string
    icon?: React.ReactNode
    action?: React.ReactNode
    /** Nivel del título: h1 si el estado ocupa toda la pantalla, h2 dentro de una página con h1. Por defecto h3. */
    headingLevel?: "h1" | "h2" | "h3"
}

/**
 * Global friendly empty state with a premium glassmorphic feel.
 */
export function EmptyState({
    title = "Sin resultados",
    message = "Prueba ajustando los filtros o recargando la biblioteca.",
    icon,
    action,
    headingLevel: Heading = "h3",
}: EmptyStateProps) {
    // La respiración del ícono es decorativa y en bucle: solo con el tier "full"
    // (en TV, bajo consumo o movimiento reducido el fantasma queda quieto).
    const breathe = useMotionTier() === "full"
    return (
        <div className={cn(
            "relative flex flex-col items-center justify-center text-center",
            "glass-card px-12 py-16 md:py-24",
            "max-w-2xl mx-auto overflow-hidden shadow-elevation-3",
            // Entrada de la tarjeta: escala sutil + fade (el botón de acción entra aparte, más tarde).
            "animate-scale-in",
        )}>
            {/* Diffused series colors inside the empty state card */}
            <div className="absolute inset-0 -z-10 overflow-hidden opacity-30 pointer-events-none">
                <div className="absolute top-[-30%] left-[-30%] w-[80%] h-[80%] rounded-full bg-brand-accent/20 blur-3xl" />
                <div className="absolute bottom-[-30%] right-[-30%] w-[80%] h-[80%] rounded-full bg-brand-secondary/20 blur-3xl" />
            </div>

            <div className="mb-8 flex h-20 w-20 items-center justify-center border border-white/5 text-label-1 rounded-container" style={{ background: "color-mix(in srgb, var(--md-sys-color-surface-container) 50%, transparent)" }}>
                {icon ?? <IconStatusGhost className={cn("h-10 w-10 text-brand-accent", breathe && "animate-pulse-slow")} />}
            </div>
            
            <Heading className="text-2xl md:text-3xl font-black text-label-1 tracking-tight text-balance">
                {title}
            </Heading>
            <p className="mt-4 max-w-md text-sm md:text-base text-label-2 leading-relaxed mx-auto font-medium text-pretty">
                {message}
            </p>
            
            {action && (
                <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-slow">
                    {action}
                </div>
            )}
        </div>
    )
}
