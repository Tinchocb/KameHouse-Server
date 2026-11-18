import React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconStatusGhost } from "@/components/ui/icons"
import { useMotionTier } from "@/components/ui/kinetics/hooks"

interface EmptyStateProps {
    title?: string
    message?: string
    icon?: React.ReactNode
    action?: React.ReactNode
    /** Nivel del título: h1 si el estado ocupa toda la pantalla, h2 dentro de una página con h1. Por defecto h3. */
    headingLevel?: "h1" | "h2" | "h3"
    /** Si es false, no envuelve el icono en la caja contenedora (ideal para ilustraciones de personajes). Por defecto true. */
    iconContainer?: boolean
    /** Orientación del layout: 'vertical' (por defecto) o 'horizontal' (icono a un costado, contenido al otro en pantallas medianas+) */
    layout?: "vertical" | "horizontal"
    /** Badge opcional arriba del título (ej: 'Primeros pasos') */
    badge?: React.ReactNode
    /** Clases adicionales para la tarjeta */
    className?: string
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
    iconContainer = true,
    layout = "vertical",
    badge,
    className,
}: EmptyStateProps) {
    // La respiración del ícono es decorativa y en bucle: solo con el tier "full"
    // (en TV, bajo consumo o movimiento reducido el fantasma queda quieto).
    const breathe = useMotionTier() === "full"
    const isHorizontal = layout === "horizontal"

    return (
        <div className={cn(
            "relative overflow-hidden glass-card rounded-2xl border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] animate-scale-in motion-reduce:animate-none",
            isHorizontal
                ? "w-full min-w-0 max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between text-center md:text-left p-6 sm:p-8 md:p-10 gap-6 md:gap-10"
                : "w-full min-w-0 max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-5 py-10 sm:px-10 sm:py-14 md:py-16",
            className,
        )}>
            {/* Diffused series colors inside the empty state card */}
            <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 opacity-40 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(circle at 15% 15%, color-mix(in srgb, var(--brand-accent-hex) 22%, transparent) 0%, transparent 60%), radial-gradient(circle at 85% 85%, color-mix(in srgb, var(--brand-secondary-hex) 18%, transparent) 0%, transparent 60%)",
                }}
            />

            {/* Left / Top: Icon or Illustration */}
            <div className={cn(
                "shrink-0 flex items-center justify-center",
                isHorizontal ? "md:justify-start" : "mb-6 max-w-full"
            )}>
                {iconContainer ? (
                    <div
                        className={cn(
                            "flex min-h-20 min-w-20 max-w-full p-4 items-center justify-center border border-white/5 text-label-1 rounded-container",
                            !isHorizontal && "mb-6"
                        )}
                        style={{ background: "color-mix(in srgb, var(--md-sys-color-surface-container) 50%, transparent)" }}
                    >
                        {icon ?? <IconStatusGhost className={cn("h-10 w-10 text-brand-accent", breathe && "animate-pulse-slow")} />}
                    </div>
                ) : (
                    icon ?? <IconStatusGhost className={cn("h-10 w-10 text-brand-accent", breathe && "animate-pulse-slow")} />
                )}
            </div>

            {/* Content area: Title, message, action */}
            <div className={cn(
                "flex-1 flex flex-col",
                isHorizontal ? "items-center md:items-start max-w-lg" : "items-center"
            )}>
                {badge && (
                    <div className="mb-3 animate-in fade-in duration-base motion-reduce:animate-none">
                        {badge}
                    </div>
                )}
                <Heading className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-label-1 tracking-tight text-balance break-words max-w-full">
                    {title}
                </Heading>
                <p className={cn(
                    "mt-3 text-sm md:text-base text-label-2 leading-relaxed font-medium text-pretty",
                    !isHorizontal && "mx-auto max-w-md"
                )}>
                    {message}
                </p>
                
                {action && (
                    <div className={cn(
                        "mt-6 max-w-full flex flex-wrap items-center gap-3 animate-in fade-in duration-base motion-reduce:animate-none",
                        isHorizontal ? "justify-center md:justify-start" : "justify-center"
                    )}>
                        {action}
                    </div>
                )}
            </div>
        </div>
    )
}
