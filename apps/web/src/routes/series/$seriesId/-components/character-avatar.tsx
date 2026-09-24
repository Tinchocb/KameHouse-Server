import React from "react"
import { cn } from "@/components/ui/core/styling"
import { AnimatedTooltip } from "@/components/ui/kinetics"

// Tratamiento único de "personaje" para toda la ruta de series.
// Receta canónica: la tile del CharacterCarousel (rounded-xl, hover con glow de
// era vía brand-accent). Reemplaza las tres variantes que había (carousel,
// "Personajes Clave del Arco" del lore header y CharactersTab).

interface CharacterAvatarProps {
    name: string
    avatarUrl?: string | null
    roleTag?: string | null
    className?: string
    onSelect?: (name: string) => void
}

function roleToneClass(roleTag?: string | null): string {
    if (!roleTag) return "text-on-surface-variant"
    const lower = roleTag.toLowerCase()
    if (lower.includes("antagonista") || lower.includes("antagonist")) return "text-brand-destructive"
    if (lower.includes("protagonista") || lower === "main") return "text-brand-success"
    return "text-on-surface-variant"
}

export function CharacterAvatar({ name, avatarUrl, roleTag, className, onSelect }: CharacterAvatarProps) {
    const handleSelect = () => onSelect?.(name)
    const tooltipText = roleTag ? `${name} · ${roleTag}` : `Ver detalles de ${name}`

    return (
        <AnimatedTooltip content={tooltipText} side="top">
            <button
                type="button"
                aria-label={roleTag ? `${name}, ${roleTag}` : name}
                onClick={handleSelect}
                className={cn(
                    "flex flex-col items-center text-center gap-2.5 group cursor-pointer rounded-xl active:scale-95 transition-transform duration-150",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                    className
                )}
            >
                <div
                    className={cn(
                        "w-24 h-24 rounded-2xl overflow-hidden border border-white/20 border-t-white/40 border-b-white/10 relative shadow-[shadow:var(--glass-highlight-lg),0_8px_20px_rgba(0,0,0,0.6)] bg-surface-container-lowest/80 transform-gpu",
                        "group-hover:border-brand-accent/50 group-hover:shadow-[0_0_22px_hsl(var(--brand-accent)/0.35)] group-hover:-translate-y-1",
                        "transition-[border-color,box-shadow,transform] duration-300 ease-out"
                    )}
                >
                    {avatarUrl && (
                        <img
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out transform-gpu"
                        />
                    )}
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-base"
                        style={{ background: "color-mix(in srgb, var(--md-sys-color-surface) 40%, transparent)" }}
                    />
                </div>
                <div className="flex flex-col w-full px-1">
                    <p className="text-sm font-bold text-on-surface group-hover:text-brand-accent transition-colors duration-base line-clamp-1">
                        {name}
                    </p>
                    {roleTag && (
                        <p className={cn(
                            "text-badge font-medium uppercase tracking-widest mt-0.5 transition-colors duration-base",
                            roleToneClass(roleTag)
                        )}>
                            {roleTag}
                        </p>
                    )}
                </div>
            </button>
        </AnimatedTooltip>
    )
}
