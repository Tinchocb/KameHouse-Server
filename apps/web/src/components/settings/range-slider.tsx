import React from "react"
import { cn } from "@/components/ui/core/styling"

export interface RangeSliderProps {
    label: string
    description?: string
    min: number
    max: number
    step?: number
    value: number
    onChange: (value: number) => void
    formatValue?: (value: number) => string
    className?: string
}

export function RangeSlider({ label, description, min, max, step = 1, value, onChange, formatValue, className }: RangeSliderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 hover:bg-white/[0.04] transition-[background-color] duration-fast ease-smooth-out gap-4 group/slider">
            <div className="space-y-1 flex-1 max-w-xl">
                <p className="text-xs font-bold text-on-surface group-hover/slider:text-white transition-[color] duration-fast ease-smooth-out tracking-tight">{label}</p>
                {description && <p className="text-2xs text-on-surface-variant/70 leading-relaxed font-medium">{description}</p>}
            </div>
            <div className={cn("flex items-center gap-3 w-full md:w-72", className)}>
                <div className="relative flex items-center w-full min-h-[44px]">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/15 group-hover/slider:bg-white/25 transition-[background-color] duration-fast ease-smooth-out pointer-events-none" />
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="relative z-10 w-full min-h-[44px] h-11 accent-white bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent"
                    />
                </div>
                <span className="text-2xs font-mono text-zinc-200 bg-white/10 border border-white/20 text-right shrink-0 min-w-[3rem] px-2 py-1 rounded-full tabular-nums">
                    {formatValue ? formatValue(value) : value}
                </span>
            </div>
        </div>
    )
}
