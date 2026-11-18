import { m } from "framer-motion"
import { useRef } from "react"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

interface RadioCardOption {
    value: string
    label: string
    desc?: string
    badge?: string
}

interface RadioCardGroupProps {
    name: string
    /** Nombre accesible del grupo; si se omite se usa `name` (un id interno). */
    label?: string
    options: RadioCardOption[]
    value: string
    onChange: (value: string) => void
    className?: string
}

export function RadioCardGroup({ name, label, options, value, onChange, className }: RadioCardGroupProps) {
    const indicatorSpring = useSpringPreset("tabIndicator")
    const groupRef = useRef<HTMLDivElement>(null)
    const selectedIndex = options.findIndex(opt => value === opt.value || (!value && opt.value === ""))
    return (
        <div ref={groupRef} role="radiogroup" aria-label={label ?? name} className={cn("grid grid-cols-1 gap-2", className)}>
            {options.map((opt, index) => {
                const isActive = value === opt.value || (!value && opt.value === "")
                return (
                    <div
                        key={opt.value || "default"}
                        role="radio"
                        data-settings-choice=""
                        aria-checked={isActive}
                        tabIndex={index === (selectedIndex < 0 ? 0 : selectedIndex) ? 0 : -1}
                        onClick={() => onChange(opt.value)}
                        onKeyDown={(e) => {
                            const direction = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
                                : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
                            if (direction || e.key === "Home" || e.key === "End") {
                                e.preventDefault()
                                const next = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1
                                    : (index + direction + options.length) % options.length
                                onChange(options[next].value)
                                groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
                                return
                            }
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                onChange(opt.value)
                            }
                        }}
                        className={cn(
                            "relative flex items-start gap-3.5 p-3.5 rounded-xl border border-t-[var(--glass-border-top)] transition-[background-color,border-color,color,box-shadow] duration-fast ease-smooth-out cursor-pointer group select-none shadow-[shadow:var(--double-bezel-ring)]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent motion-safe:active:scale-[0.995]",
                            isActive
                                ? "bg-[var(--neutral-elev-3)] border-[var(--selected-bg)] text-label-1"
                                : "bg-transparent border-[var(--neutral-separator)] text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-2)]"
                        )}
                    >
                        {isActive && (
                            <m.div
                                layoutId={`radio-${name}-active`}
                                data-settings-choice-ring=""
                                transition={indicatorSpring}
                                className="absolute inset-0 border border-[var(--selected-bg)] rounded-xl pointer-events-none"
                            />
                        )}
                        <div className="mt-0.5 shrink-0 pointer-events-none relative z-10">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "flex items-center justify-center w-4 h-4 rounded-full border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out",
                                    isActive
                                        ? "border-[var(--selected-bg)] bg-[var(--selected-bg)]"
                                        : "border-label-3 bg-transparent"
                                )}
                            >
                                {isActive && <span className="block w-1.5 h-1.5 rounded-full bg-[var(--selected-fg)] animate-success-pop" />}
                            </span>
                        </div>
                        <div className="flex-1 -mt-0.5 relative z-10">
                            <span className={cn(
                                "settings-field-label text-xs block tracking-tight transition-[color] duration-fast ease-smooth-out",
                                isActive ? "font-bold text-label-1" : "font-semibold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-1"
                            )}>
                                {opt.label}
                            </span>
                            {opt.desc && (
                                <span className={cn(
                                    "settings-field-help text-caption block mt-0.5 transition-[color] duration-fast ease-smooth-out leading-relaxed",
                                    "text-label-2"
                                )}>
                                    {opt.desc}
                                </span>
                            )}
                        </div>
                        {opt.badge && (
                            <div className={cn(
                                "h-8 px-3 rounded-full flex items-center justify-center text-label-sm font-black uppercase tracking-wider shrink-0 transition-[background-color,color,border-color] duration-fast ease-smooth-out relative z-10 border",
                                isActive
                                    ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] font-black border-[var(--selected-bg)]"
                                    : "bg-[var(--neutral-elev-3)] text-label-2 border-[var(--neutral-separator)]"
                            )}>
                                {opt.badge}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
