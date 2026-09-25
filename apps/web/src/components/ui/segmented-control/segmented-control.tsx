import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { MagneticIndicator } from "@/components/ui/kinetics/magnetic-indicator"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"

export interface SegmentedOption<T extends string> {
    value: T
    label: React.ReactNode
    icon?: React.ReactNode
    /** Contador opcional, se muestra atenuado a la derecha del label. */
    count?: number
    disabled?: boolean
    /** Nombre accesible cuando el label no es texto. */
    ariaLabel?: string
}

export interface SegmentedControlProps<T extends string> {
    options: ReadonlyArray<SegmentedOption<T>>
    value: T
    onChange: (value: T) => void
    /** Único por instancia visible: dos controles con el mismo layoutId se roban la pill. */
    layoutId: string
    "aria-label": string
    /**
     * `radiogroup` para elegir un modo/filtro; `tablist` cuando cada opción
     * muestra un panel distinto (el consumidor pone role="tabpanel").
     */
    semantics?: "radiogroup" | "tablist"
    /** neutral: pill blanca (§5.3). accent: pill con el color de marca/era. */
    tone?: "neutral" | "accent"
    /**
     * glass: contenedor SectionBar propio (una capa de blur).
     * inset: sin blur, para usar dentro de un panel que ya tiene glass.
     */
    surface?: "glass" | "inset"
    fullWidth?: boolean
    onOptionHover?: (value: T) => void
    className?: string
}

/**
 * Segmented control canónico (DESIGN-GUIDE §5.3): pill deslizante con
 * layoutId + spring tabIndicator (480/34), touch 44px, flechas/Home/End con
 * roving tabindex y fallback sin animación para prefers-reduced-motion.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    layoutId,
    "aria-label": ariaLabel,
    semantics = "radiogroup",
    tone = "neutral",
    surface = "glass",
    fullWidth = false,
    onOptionHover,
    className,
}: SegmentedControlProps<T>) {
    const reduceMotion = useReducedMotion()
    const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([])
    const isTabs = semantics === "tablist"

    const enabledIndexes = options.flatMap((o, i) => (o.disabled ? [] : [i]))
    const selectedIndex = options.findIndex(o => o.value === value)
    // Si el valor no está entre las opciones, el foco entra por la primera habilitada.
    const focusableIndex = selectedIndex >= 0 && !options[selectedIndex].disabled
        ? selectedIndex
        : enabledIndexes[0]

    const move = (from: number, key: string) => {
        if (enabledIndexes.length === 0) return
        const pos = enabledIndexes.indexOf(from)
        let next: number
        if (key === "Home") next = enabledIndexes[0]
        else if (key === "End") next = enabledIndexes[enabledIndexes.length - 1]
        else {
            const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1
            next = enabledIndexes[(pos + step + enabledIndexes.length) % enabledIndexes.length]
        }
        buttonRefs.current[next]?.focus()
        onChange(options[next].value)
    }

    return (
        <div
            role={semantics}
            aria-label={ariaLabel}
            className={cn(
                "flex items-center gap-1 p-1 rounded-full",
                surface === "glass"
                    ? "sectionbar sectionbar-pill"
                    : "bg-white/[0.04] border border-[var(--sectionbar-border)]",
                fullWidth ? "w-full" : "w-fit",
                className,
            )}
        >
            {options.map((option, i) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        ref={el => { buttonRefs.current[i] = el }}
                        type="button"
                        role={isTabs ? "tab" : "radio"}
                        aria-selected={isTabs ? selected : undefined}
                        aria-checked={isTabs ? undefined : selected}
                        aria-label={option.ariaLabel}
                        disabled={option.disabled}
                        tabIndex={i === focusableIndex ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={e => {
                            if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                                e.preventDefault()
                                move(i, e.key)
                            }
                        }}
                        onMouseEnter={onOptionHover ? () => onOptionHover(option.value) : undefined}
                        className={cn(
                            "relative min-h-11 px-4 rounded-full text-xs font-mono font-bold uppercase tracking-wider",
                            "flex items-center justify-center gap-2 select-none cursor-pointer",
                            "transition-[color,transform] duration-base ease-smooth-out active:scale-95",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                            fullWidth && "flex-1",
                            selected
                                ? "text-[var(--control-primary-fg)]"
                                : "text-on-surface-variant hover:text-on-surface",
                        )}
                    >
                        <MagneticIndicator
                            layoutId={layoutId}
                            active={selected}
                            disableAnimation={!!reduceMotion}
                            className={tone === "accent" ? "bg-brand-accent" : "bg-[var(--control-primary-bg)]"}
                        />
                        <span className="relative z-10 flex items-center gap-2">
                            {option.icon}
                            <span>{option.label}</span>
                            {option.count !== undefined && (
                                <span className={cn("tabular-nums", selected ? "opacity-70" : "opacity-60")}>
                                    ({option.count})
                                </span>
                            )}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
