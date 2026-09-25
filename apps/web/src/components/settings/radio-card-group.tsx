import React from "react"
import { m } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

export interface RadioCardOption {
    value: string
    label: string
    desc?: string
    badge?: string
}

export interface RadioCardGroupProps {
    name: string
    options: RadioCardOption[]
    value: string
    onChange: (value: string) => void
    className?: string
}

export function RadioCardGroup({ name, options, value, onChange, className }: RadioCardGroupProps) {
    const indicatorSpring = useSpringPreset("tabIndicator")
    return (
        <div role="radiogroup" aria-label={name} className={cn("grid grid-cols-1 gap-2", className)}>
            {options.map((opt) => {
                const isActive = value === opt.value || (!value && opt.value === "")
                return (
                    <div
                        key={opt.value || "default"}
                        role="radio"
                        aria-checked={isActive}
                        tabIndex={0}
                        onClick={() => onChange(opt.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                onChange(opt.value)
                            }
                        }}
                        className={cn(
                            "relative flex items-start gap-3.5 p-3.5 rounded-xl border transition-[background-color,border-color,color] duration-fast ease-smooth-out cursor-pointer group select-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.995]",
                            isActive
                                ? "bg-white/[0.10] border-white/25 text-white"
                                : "bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/20"
                        )}
                    >
                        {isActive && (
                            <m.div
                                layoutId={`radio-${name}-active`}
                                transition={indicatorSpring}
                                className="absolute inset-0 bg-white/[0.06] border border-white/25 rounded-xl pointer-events-none"
                            />
                        )}
                        <div className="mt-0.5 shrink-0 pointer-events-none relative z-10">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "flex items-center justify-center w-4 h-4 rounded-full border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out",
                                    isActive
                                        ? "border-white bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.15)]"
                                        : "border-white/30 bg-transparent group-hover:border-white/50"
                                )}
                            >
                                {isActive && <span className="block w-1.5 h-1.5 rounded-full bg-zinc-950 animate-success-pop" />}
                            </span>
                            <input
                                type="radio"
                                name={name}
                                value={opt.value}
                                checked={isActive}
                                readOnly
                                tabIndex={-1}
                                className="sr-only"
                            />
                        </div>
                        <div className="flex-1 -mt-0.5 relative z-10">
                            <span className={cn(
                                "text-xs block tracking-tight transition-[color] duration-fast ease-smooth-out",
                                isActive ? "font-bold text-white" : "font-semibold text-zinc-200 group-hover:text-white"
                            )}>
                                {opt.label}
                            </span>
                            {opt.desc && (
                                <span className={cn(
                                    "text-caption block mt-0.5 transition-[color] duration-fast ease-smooth-out leading-relaxed",
                                    isActive ? "text-zinc-300" : "text-zinc-400 group-hover:text-zinc-300"
                                )}>
                                    {opt.desc}
                                </span>
                            )}
                        </div>
                        {opt.badge && (
                            <div className={cn(
                                "h-8 px-3 rounded-full flex items-center justify-center text-label-sm font-black uppercase tracking-wider shrink-0 transition-[background-color,color,border-color] duration-fast ease-smooth-out relative z-10 border",
                                isActive
                                    ? "bg-white text-zinc-950 border-white"
                                    : "bg-white/[0.06] text-zinc-300 border-white/15"
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
