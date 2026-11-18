import * as React from "react"
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

function getCharacterInitials(name: string): string {
    const clean = name.trim().replace(/[^\p{L}\p{N}\s]/gu, "")
    const parts = clean.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "DB"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

function roleToneClass(roleTag?: string | null): string {
    if (!roleTag) return "text-on-surface-variant"
    const lower = roleTag.toLowerCase()
    if (lower.includes("antagonista") || lower.includes("antagonist")) return "text-brand-destructive"
    if (lower.includes("protagonista") || lower === "main") return "text-brand-success"
    return "text-on-surface-variant"
}

// Con foco por teclado, el avatar se trae a la vista lo mínimo necesario (en 412 px el último quedaba a medias).
function scrollIntoViewOnFocus(e: React.FocusEvent<HTMLButtonElement>) {
    e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
}

export function CharacterAvatar({ name, avatarUrl, roleTag, className, onSelect }: CharacterAvatarProps) {
    const [imgError, setImgError] = React.useState(false)
    const handleSelect = () => onSelect?.(name)
    const tooltipText = roleTag ? `${name} · ${roleTag}` : `Ver detalles de ${name}`
    const showImage = Boolean(avatarUrl) && !imgError

    return (
        <AnimatedTooltip content={tooltipText} side="top">
            <button
                type="button"
                aria-label={roleTag ? `${name}, ${roleTag}` : name}
                onClick={handleSelect}
                onFocus={scrollIntoViewOnFocus}
                className={cn(
                    "character-avatar-card flex flex-col items-center text-center gap-2.5 group cursor-pointer rounded-xl motion-safe:active:scale-[0.97] transition-transform duration-fast ease-out-strong",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                    className
                )}
            >
                <div
                    className={cn(
                        "character-avatar-frame w-24 h-24 rounded-2xl overflow-hidden border border-white/20 border-t-white/40 border-b-white/10 relative shadow-[shadow:var(--glass-highlight-lg),0_8px_20px_rgba(0,0,0,0.6)] bg-surface-container-lowest/80 transform-gpu",
                        "[@media(hover:hover)_and_(pointer:fine)]:group-hover:border-brand-accent/50 [@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-[0_0_22px_hsl(var(--brand-accent)/0.35)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1",
                        "transition-[border-color,box-shadow,transform] duration-base ease-smooth-out"
                    )}
                >
                    {showImage && avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            onError={() => setImgError(true)}
                            className="w-full h-full object-cover motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-base ease-smooth-out transform-gpu"
                        />
                    ) : (
                        <div
                            aria-hidden="true"
                            className="character-avatar-fallback w-full h-full flex items-center justify-center bg-surface-container-high/60 text-on-surface font-display font-extrabold text-lg sm:text-xl tracking-wider select-none"
                        >
                            {getCharacterInitials(name)}
                        </div>
                    )}
                    <div
                        className="absolute inset-0 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 transition-opacity duration-fast ease-smooth-out"
                        style={{ background: "color-mix(in srgb, var(--md-sys-color-surface) 40%, transparent)" }}
                    />
                </div>
                <div className="flex flex-col w-full px-1">
                    <p className="text-sm font-bold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent-readable transition-colors duration-fast ease-smooth-out line-clamp-1">
                        {name}
                    </p>
                    {roleTag && (
                        <p className={cn(
                            "character-avatar-role text-xs font-medium mt-0.5 transition-colors duration-fast ease-smooth-out",
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
