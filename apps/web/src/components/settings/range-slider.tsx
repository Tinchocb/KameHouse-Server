import { cn } from "@/components/ui/core/styling"
import { useId } from "react"

interface RangeSliderProps {
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
    const descriptionId = useId()
    return (
        // Resaltado en un ::before inset y redondeado (igual que OsToggle): la banda no toca los
        // bordes de la tarjeta ni los divisores de la fila.
        <div className={cn(
            "relative isolate flex flex-col md:flex-row md:items-center justify-between px-5 py-4 gap-4 group/slider",
            "before:content-[''] before:absolute before:inset-x-1 before:inset-y-1 before:-z-10 before:rounded-xl before:bg-[var(--neutral-elev-2)] before:opacity-0",
            "before:transition-[opacity] before:duration-fast before:ease-out-strong motion-reduce:before:transition-none",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:before:opacity-100"
        )}>
            <div className="space-y-1 flex-1 max-w-xl">
                <p className="settings-field-label text-xs font-bold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover/slider:text-label-1 transition-[color] duration-fast ease-smooth-out tracking-tight">{label}</p>
                {description && <p id={descriptionId} className="settings-field-help text-2xs text-label-2 leading-relaxed font-medium">{description}</p>}
            </div>
            <div className={cn("flex items-center gap-3 w-full md:w-72", className)}>
                <div className="relative flex items-center w-full min-h-[44px]">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--neutral-elev-3)] transition-[background-color] duration-fast ease-smooth-out pointer-events-none" />
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        aria-label={label}
                        aria-describedby={description ? descriptionId : undefined}
                        aria-valuetext={formatValue ? formatValue(value) : String(value)}
                        className="relative z-10 w-full min-h-[44px] h-11 accent-[var(--selected-bg)] bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent"
                    />
                </div>
                <span className="text-2xs font-mono text-label-1 bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)] text-right shrink-0 min-w-[3rem] px-2 py-1 rounded-full tabular-nums">
                    {formatValue ? formatValue(value) : value}
                </span>
            </div>
        </div>
    )
}
