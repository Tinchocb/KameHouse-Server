import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { MagneticIndicator } from "@/components/ui/kinetics/magnetic-indicator"
import { useMotionTier } from "@/components/ui/kinetics/hooks"

export interface SegmentedOption<T extends string> {
    value: T
    label: React.ReactNode
    icon?: React.ReactNode
    /** Contador opcional, se muestra atenuado a la derecha del label. */
    count?: number
    disabled?: boolean
    /** Nombre accesible cuando el label no es texto. */
    ariaLabel?: string
    /** Identidad de la pestaña y panel que controla (solo con semantics="tablist"). */
    id?: string
    panelId?: string
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
    /** caps: mono, mayúsculas espaciadas (sobreetiqueta corta). sentence: etiqueta normal para palabras de navegación. */
    labelStyle?: "caps" | "sentence"
    /** Muestra únicamente los íconos de forma fija (sin desplegar etiquetas con hover). */
    iconOnly?: boolean
    onOptionHover?: (value: T) => void
    className?: string
}

/**
 * Segmented control canónico (DESIGN-GUIDE §5.3): pill deslizante con
 * layoutId + spring tabIndicator (480/34), touch 44px, flechas/Home/End con
 * roving tabindex y fallback sin animación para prefers-reduced-motion.
 * En equipos de gama baja (perfil eco o throttle automático) la pill no anima ni
 * lleva el brillo pesado, igual que el resto de los efectos del sistema.
 */
/**
 * Foco pendiente tras una flecha, por layoutId. Vive fuera del componente porque la ruta
 * puede remontarlo: la ficha de Series cambia de serie al pulsar la flecha y el radio nuevo
 * monta en otra instancia. Caduca para no robar el foco más tarde.
 */
const ARROW_FOCUS_TTL_MS = 5000
const arrowFocusHandoff = new Map<string, { value: string; expires: number; owner: object }>()
const armArrowFocus = (layoutId: string, value: string, owner: object) => {
    arrowFocusHandoff.set(layoutId, { value, owner, expires: Date.now() + ARROW_FOCUS_TTL_MS })
}

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
    labelStyle = "caps",
    iconOnly = false,
    onOptionHover,
    className,
}: SegmentedControlProps<T>) {
    // Tier "full": hardware capaz y con movimiento permitido. Con cualquier otro tier la pill no anima.
    const allowFx = useMotionTier() === "full"
    const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([])
    const isTabs = semantics === "tablist"

    const enabledIndexes = options.flatMap((o, i) => (o.disabled ? [] : [i]))
    const selectedIndex = options.findIndex(o => o.value === value)
    // Si el valor no está entre las opciones, el foco entra por la primera habilitada.
    const focusableIndex = selectedIndex >= 0 && !options[selectedIndex].disabled
        ? selectedIndex
        : enabledIndexes[0]

    // Tras una flecha, el radio seleccionado recibe el foco, también si el control se monta de nuevo.
    // La instancia que disparó la flecha ya tiene el foco: solo recoge el encargo una instancia distinta.
    React.useEffect(() => {
        const pending = arrowFocusHandoff.get(layoutId)
        if (!pending || pending.owner === buttonRefs || pending.value !== value) return
        arrowFocusHandoff.delete(layoutId)
        if (Date.now() <= pending.expires) buttonRefs.current[selectedIndex]?.focus()
    }, [layoutId, value, selectedIndex])

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
        const target = options[next].value
        armArrowFocus(layoutId, target, buttonRefs)
        buttonRefs.current[next]?.focus()
        onChange(target)
    }

    return (
        <div
            data-compact={iconOnly ? "true" : undefined}
            role={semantics}
            aria-label={ariaLabel}
            className={cn(
                "UI-SegmentedControl_root liquid-control flex items-center gap-1 p-1 rounded-full",
                surface === "glass"
                    ? "glass-frosted-pill"
                    : "bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)]",
                fullWidth ? "w-full" : "w-fit",
                className,
            )}
        >
            {options.map((option, i) => {
                const selected = option.value === value
                const accessibleLabel = option.ariaLabel ?? (iconOnly && typeof option.label === "string" ? option.label : undefined)
                return (
                    <button
                        type="button"
                        key={option.value}
                        ref={el => { buttonRefs.current[i] = el }}
                        role={isTabs ? "tab" : "radio"}
                        id={isTabs ? option.id : undefined}
                        aria-controls={isTabs ? option.panelId : undefined}
                        aria-selected={isTabs ? selected : undefined}
                        aria-checked={isTabs ? undefined : selected}
                        aria-label={accessibleLabel}
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
                            "UI-SegmentedControl_option relative min-h-11 rounded-full",
                            iconOnly ? "min-w-11 px-3" : "px-4",
                            labelStyle === "caps" ? "text-xs font-mono font-bold uppercase tracking-wider" : "type-label font-semibold",
                            "flex items-center justify-center gap-2 select-none cursor-pointer",
                            // background-color: el hover de las opciones no elegidas se funde en vez de saltar.
                            "transition-[color,background-color,transform] duration-quick ease-out-strong active:scale-[0.97] motion-reduce:active:scale-100",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            "disabled:opacity-40 disabled:cursor-not-allowed motion-safe:disabled:active:scale-100",
                            fullWidth && "flex-1",
                            selected
                                ? "text-[var(--selected-fg)] font-black"
                                : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]",
                        )}
                    >
                        <MagneticIndicator
                            layoutId={layoutId}
                            active={selected}
                            disableAnimation={!allowFx}
                            className={cn(
                                "UI-SegmentedControl_indicator shadow-elevation-1",
                                tone === "accent" ? "bg-brand-accent text-on-primary font-black" : "bg-[var(--selected-bg)]"
                            )}
                        />
                        <span className="relative z-10 flex items-center gap-2">
                            {option.icon}
                            {!iconOnly && <span>{option.label}</span>}
                            {!iconOnly && option.count !== undefined && (
                                <span className={cn("tabular-nums", selected ? "opacity-80" : "text-label-2")}>
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
