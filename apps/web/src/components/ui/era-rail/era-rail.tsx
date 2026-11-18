import { m } from "framer-motion"
import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/components/ui/core/styling"
import { useMotionTier, useReducedMotion, useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useMinWidth } from "@/components/ui/app-layout/use-nav-compact"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
import {
    DISABLED_ERA_TEXT,
    eraAriaLabel,
    eraProgressFraction,
    isEraRailKey,
    nextEraIndex,
    type EraRailItem,
} from "./era-rail-model"
import { useRailEngaged } from "./use-rail-engaged"

/**
 * Selector de era compartido por Inicio, Películas y Cronología.
 *
 * - Minimalista: barra horizontal tipográfica bajo la navegación, en cualquier ancho.
 * - Otros temas, ≥ 1024 px: riel vertical fijo a la izquierda. Colapsado muestra solo el kanji de cada era;
 *   con el puntero encima o el foco de teclado dentro se expande (sin empujar el contenido)
 *   y revela nombre, años y cifra.
 * - Otros temas, < 1024 px: barra horizontal compacta. Solo el kanji, y el activo con su nombre.
 *
 * Es un radiogroup (una sola opción activa): Tab entra una vez (roving tabindex) y las flechas
 * mueven y eligen. El margen que ocupa se reserva con las variables `--era-rail-w` / `--era-bar-h`
 * (globals.css), que se activan mientras el componente está montado.
 */

interface EraRailProps<Id extends string = string> {
    eras: readonly EraRailItem<Id>[]
    activeId: Id
    onSelect: (id: Id) => void
    /** Nombre del grupo para lectores de pantalla ("Eras de Dragon Ball"). */
    label: string
    /** Se llama al pasar el puntero por una era elegible (sonido de la app). */
    onItemHover?: () => void
    /** "auto": barra en Minimalista; en los demás temas decide por ancho. */
    variant?: "auto" | "rail" | "bar"
    /** Barra dentro del flujo, sin portal ni reserva de espacio en la página. */
    inline?: boolean
    /**
     * Era que se está viendo (scroll-spy). Si se pasa, el resalte visual sigue a esta era y
     * `activeId` queda solo como la opción elegida del radiogroup (`aria-checked`).
     */
    spyId?: Id
    /** "ring" (por defecto): anillo alrededor del kanji. "track": tramo relleno bajo el kanji, con el color de la era. "none": sin indicador de progreso. */
    progressStyle?: "ring" | "track" | "none"
}

type Variant = "rail" | "bar"

function useAutoVariant(): Variant {
    const isWide = useMinWidth(1024, true)
    const isMinimalist = useIsMinimalistMode()
    return isMinimalist || !isWide ? "bar" : "rail"
}

/* ── Reserva de margen ──────────────────────────────────────────────── */

const holders = new Map<symbol, Variant>()

function syncLayoutAttribute() {
    if (typeof document === "undefined") return
    const last = Array.from(holders.values()).pop()
    if (last) document.documentElement.dataset.eraRail = last
    else delete document.documentElement.dataset.eraRail
}

/** Marca <html> mientras haya un selector montado: el CSS reserva el margen con variables. */
function useLayoutReservation(variant: Variant | null) {
    React.useLayoutEffect(() => {
        if (variant === null) return
        const token = Symbol("era-rail")
        holders.set(token, variant)
        syncLayoutAttribute()
        return () => {
            holders.delete(token)
            syncLayoutAttribute()
        }
    }, [variant])
}

/** Reserva el mismo margen que un selector montado, sin pintarlo (p. ej. el esqueleto de Inicio). */
export function useEraRailReservation() {
    useLayoutReservation(useAutoVariant())
}

/* ── Piezas ─────────────────────────────────────────────────────────── */

const RING_RADIUS = 17
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
/* Radio del vidrio del riel: 28 px = --radius-3xl (radius.css). Va numérico y no como var(): framer solo corrige
   el radio durante el layout cuando llega en px; con var() la cápsula se deformaría al cambiar de ancho. */
const RAIL_GLASS_RADIUS = 28

function KanjiCell({ item, active, progressStyle = "ring" }: { item: EraRailItem; active: boolean; progressStyle?: "ring" | "track" | "none" }) {
    const fraction = eraProgressFraction(item.progress)
    return (
        <span className="era-selector-symbol relative grid size-11 shrink-0 place-items-center" aria-hidden="true">
            {fraction !== null && progressStyle === "track" && (
                <span className="absolute inset-x-3 bottom-1 h-[2.5px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--label-1)_16%,transparent)]">
                    <span
                        data-era-progress-fill=""
                        className="absolute inset-0 origin-left rounded-full"
                        style={{ background: item.accent, transform: `scaleX(${fraction})` }}
                    />
                </span>
            )}
            {fraction !== null && progressStyle === "ring" && (
                <svg viewBox="0 0 40 40" className="absolute inset-0 m-auto size-10 -rotate-90 text-label-2">
                    <circle cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
                    {fraction > 0 && (
                        <circle
                            cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.75"
                            strokeWidth="2" strokeLinecap="round"
                            strokeDasharray={`${RING_LENGTH * fraction} ${RING_LENGTH}`}
                        />
                    )}
                </svg>
            )}
            <span
                className={cn("relative font-kanji text-lg font-bold leading-none", !active && "text-label-2")}
                style={active ? { color: item.textAccent ?? item.accent } : undefined}
            >
                {item.icon ?? item.kanji}
            </span>
        </span>
    )
}

const ROW_BASE = [
    "group relative flex items-center text-left select-none cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent",
    "transition-[background-color,color,opacity,transform] duration-150 motion-reduce:transition-none motion-safe:active:scale-[0.97]",
].join(" ")

/** Fondo del activo y del hover: translúcido con vidrio, sólido (--neutral-elev-*) en plano. */
const ROW_ACTIVE_BG = "bg-[color-mix(in_srgb,var(--label-1)_12%,transparent)] [[data-flat=true]_&]:bg-[var(--neutral-elev-3)]"
const ROW_HOVER_BG = "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[color-mix(in_srgb,var(--label-1)_7%,transparent)] [@media(hover:hover)_and_(pointer:fine)]:[[data-flat=true]_&]:hover:bg-[var(--neutral-elev-2)]"

const ROW_GROUP_HOVER_BG = "[@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[color-mix(in_srgb,var(--label-1)_7%,transparent)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:[[data-flat=true]_&]:bg-[var(--neutral-elev-2)]"

/* ── Riel (escritorio) ──────────────────────────────────────────────── */

function Rail<Id extends string>({ eras, activeId, onSelect, label, onItemHover, spyId, progressStyle }: EraRailProps<Id>) {
    const reduceMotion = useReducedMotion()
    // Solo el tier "full" anima el riel: con hardware justo el cambio de era salta.
    const tier = useMotionTier()
    const animate = tier === "full"
    const { engaged, handlers } = useRailEngaged()
    const refs = React.useRef<Array<HTMLButtonElement | null>>([])
    const scroller = React.useRef<HTMLDivElement | null>(null)
    const railSpring = useSpringPreset("railResize")
    const transition = animate ? railSpring : { duration: 0 }

    const checkedIndex = eras.findIndex((e) => e.id === activeId)
    const tabbableIndex = checkedIndex >= 0 && !eras[checkedIndex]?.disabled ? checkedIndex : eras.findIndex((e) => !e.disabled)
    const activeIndex = eras.findIndex((e) => e.id === (spyId ?? activeId))

    // Deja el activo a la vista cuando el riel vertical desborda en ventanas de poca altura
    React.useEffect(() => {
        const box = scroller.current
        const el = activeIndex >= 0 ? refs.current[activeIndex] : null
        if (!box || !el || typeof box.scrollTo !== "function") return
        const top = el.offsetTop - (box.clientHeight - el.offsetHeight) / 2
        box.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" })
    }, [activeIndex, reduceMotion])

    const onKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (!isEraRailKey(e.key)) return
        e.preventDefault()
        const target = nextEraIndex(eras, index, e.key)
        const era = eras[target]
        if (!era || target === index) return
        onSelect(era.id)
        refs.current[target]?.focus()
    }

    return (
        <div
            data-era-selector="rail"
            role="region"
            aria-label="Selector de era"
            data-expanded={engaged}
            className="pointer-events-none fixed inset-y-0 left-[var(--era-rail-edge)] z-sticky flex items-center pb-[5.5rem] pt-[calc(var(--chrome-top)+0.5rem)]"
        >
            <div
                {...handlers}
                className={cn(
                    "pointer-events-auto relative flex max-h-full flex-col",
                    engaged ? "w-[var(--era-rail-open)]" : "w-[var(--era-rail-size)]",
                )}
            >
                {/* Vidrio: capa aparte que cambia de tamaño por transform (layout), así el contenido no se deforma. */}
                <m.div
                    layout
                    aria-hidden="true"
                    transition={transition}
                    className="glass-frosted-pill pointer-events-none absolute inset-0"
                    data-liquid-surface="navigation"
                    style={{ borderRadius: RAIL_GLASS_RADIUS }}
                />
                <div
                    ref={scroller}
                    role="radiogroup"
                    aria-label={label}
                    className="relative z-10 flex min-h-0 flex-col gap-1 overflow-y-auto p-1.5 no-scrollbar"
                >
                    {eras.map((item, index) => {
                        const active = item.id === (spyId ?? activeId)
                        const checked = item.id === activeId
                        const disabled = !!item.disabled
                        return (
                            <button
                                type="button"
                                key={item.id}
                                ref={(el) => { refs.current[index] = el }}
                                role="radio"
                                aria-checked={checked}
                                aria-current={spyId !== undefined && item.id === spyId ? "location" : undefined}
                                aria-disabled={disabled || undefined}
                                aria-label={eraAriaLabel(item)}
                                tabIndex={index === tabbableIndex ? 0 : -1}
                                onClick={() => { if (!disabled) onSelect(item.id) }}
                                onKeyDown={(e) => onKeyDown(e, index)}
                                onPointerEnter={() => { if (!disabled) onItemHover?.() }}
                                style={{ "--era-item-accent": item.accent } as React.CSSProperties}
                                className={cn(
                                    ROW_BASE, "h-11 w-full rounded-full",
                                    disabled && "cursor-not-allowed opacity-45",
                                )}
                            >
                                {/* Fondo del activo/hover en capa propia: crece con el mismo layout que el vidrio. */}
                                <m.span
                                    layout
                                    aria-hidden="true"
                                    transition={transition}
                                    className={cn("pointer-events-none absolute inset-0 transition-colors duration-150 motion-reduce:transition-none", active ? [ROW_ACTIVE_BG, "era-row-active"] : !disabled && ROW_GROUP_HOVER_BG)}
                                    style={{ borderRadius: 9999 }}
                                />
                                <KanjiCell item={item} active={active} progressStyle={progressStyle} />
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden pr-4",
                                        "transition-[opacity,transform] duration-150 motion-reduce:transition-none",
                                        engaged ? "translate-x-0 opacity-100 delay-75" : "-translate-x-1 opacity-0",
                                    )}
                                >
                                    <span className="flex min-w-0 flex-col">
                                        <span className={cn("truncate text-sm font-semibold leading-tight", active ? "text-label-1" : "text-label-2 group-hover:text-label-1")}>
                                            {item.label}
                                        </span>
                                        {(item.years || disabled) && (
                                            <span className="truncate text-xs leading-tight text-label-2 tabular-nums">
                                                {disabled ? DISABLED_ERA_TEXT : item.years}
                                            </span>
                                        )}
                                    </span>
                                    {item.badge && !disabled && (
                                        <span className="shrink-0 text-xs font-medium text-label-2 tabular-nums">{item.badge}</span>
                                    )}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ── Barra (móvil y tableta) ────────────────────────────────────────── */

function Bar<Id extends string>({ eras, activeId, onSelect, label, onItemHover, spyId, progressStyle, inline }: EraRailProps<Id>) {
    const reduceMotion = useReducedMotion()
    const refs = React.useRef<Array<HTMLButtonElement | null>>([])
    const scroller = React.useRef<HTMLDivElement | null>(null)

    const checkedIndex = eras.findIndex((e) => e.id === activeId)
    const tabbableIndex = checkedIndex >= 0 && !eras[checkedIndex]?.disabled ? checkedIndex : eras.findIndex((e) => !e.disabled)
    const activeIndex = eras.findIndex((e) => e.id === (spyId ?? activeId))

    // Deja el activo a la vista cuando la barra desborda (6 eras + Todas no caben en 390 px).
    React.useEffect(() => {
        const box = scroller.current
        const el = activeIndex >= 0 ? refs.current[activeIndex] : null
        if (!box || !el || typeof box.scrollTo !== "function") return
        const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2
        box.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? "auto" : "smooth" })
    }, [activeIndex, reduceMotion])

    const onKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (!isEraRailKey(e.key)) return
        e.preventDefault()
        const target = nextEraIndex(eras, index, e.key)
        const era = eras[target]
        if (!era || target === index) return
        onSelect(era.id)
        refs.current[target]?.focus()
    }

    return (
        <div
            data-era-selector="bar"
            data-era-inline={inline || undefined}
            role="region"
            aria-label="Selector de era"
            className={cn("pointer-events-none flex justify-center", inline ? "relative w-full min-w-0" : "fixed inset-x-3 top-[var(--era-bar-top)] z-sticky")}
        >
            <div data-liquid-surface="navigation" className="glass-frosted-pill pointer-events-auto relative max-w-full" style={{ borderRadius: 9999 }}>
                <div
                    ref={scroller}
                    role="radiogroup"
                    aria-label={label}
                    className="relative z-10 flex items-center gap-0.5 overflow-x-auto rounded-full p-1 no-scrollbar"
                >
                    {eras.map((item, index) => {
                        const active = item.id === (spyId ?? activeId)
                        const checked = item.id === activeId
                        const disabled = !!item.disabled
                        return (
                            <button
                                type="button"
                                key={item.id}
                                ref={(el) => { refs.current[index] = el }}
                                role="radio"
                                aria-checked={checked}
                                aria-current={spyId !== undefined && item.id === spyId ? "location" : undefined}
                                aria-disabled={disabled || undefined}
                                aria-label={eraAriaLabel(item)}
                                tabIndex={index === tabbableIndex ? 0 : -1}
                                onClick={() => { if (!disabled) onSelect(item.id) }}
                                onKeyDown={(e) => onKeyDown(e, index)}
                                onPointerEnter={() => { if (!disabled) onItemHover?.() }}
                                style={{ "--era-item-accent": item.accent } as React.CSSProperties}
                                className={cn(
                                    ROW_BASE, "h-11 min-w-11 shrink-0 justify-center rounded-full",
                                    active ? [ROW_ACTIVE_BG, "era-row-active"] : !disabled && ROW_HOVER_BG,
                                    disabled && "cursor-not-allowed opacity-45",
                                )}
                            >
                                <KanjiCell item={item} active={active} progressStyle={progressStyle} />
                                {/* La etiqueta se despliega en vez de montarse de golpe: así las pestañas vecinas se desplazan con transición y no saltan. */}
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "era-selector-label min-w-0 overflow-hidden transition-[max-width,opacity] duration-base ease-smooth-out",
                                        active ? "max-w-[14rem] opacity-100" : "max-w-0 opacity-0",
                                    )}
                                >
                                    <span className="inline-block whitespace-nowrap pr-4 text-sm font-semibold text-label-1">
                                        {item.label}
                                    </span>
                                </span>
                                {/* Siempre montado: se funde al cambiar de era en vez de aparecer de golpe (el riel lo desliza con railResize). */}
                                {progressStyle !== "track" && (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                        "era-selector-indicator pointer-events-none absolute inset-x-5 bottom-0.5 h-[3px] rounded-full transition-opacity duration-quick ease-smooth-out motion-reduce:transition-none",
                                            active ? "opacity-100" : "opacity-0",
                                        )}
                                        style={{ background: item.accent }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ── Público ────────────────────────────────────────────────────────── */

export function EraRail<Id extends string>(props: EraRailProps<Id>) {
    const autoVariant = useAutoVariant()
    const variant = props.inline ? "bar" : props.variant && props.variant !== "auto" ? props.variant : autoVariant
    useLayoutReservation(props.inline ? null : variant)

    if (props.inline) return <Bar {...props} />
    if (typeof document === "undefined") return null
    // Portal al <body>: `position: fixed` no debe depender de ancestros con transform (transiciones de página).
    return createPortal(variant === "rail" ? <Rail {...props} /> : <Bar {...props} />, document.body)
}
