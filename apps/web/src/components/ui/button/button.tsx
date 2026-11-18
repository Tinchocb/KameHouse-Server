import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Qué intent usar (regla del sistema Neutro)
 *
 *  SOBRE IMAGEN (héroes, banners, carruseles, tarjetas con arte, controles sobre un póster)
 *      → `glass`. Translúcido (un solo blur `overlay-sm`), legible sobre cielo claro y sobre negro.
 *        NUNCA `ghost` ni `outline` sobre imagen: no tienen fondo y el texto se pierde.
 *  SOBRE SUPERFICIE (paneles, tarjetas opacas, hojas, formularios, listas)
 *      → `secondary` (relleno), `ghost` (sin relleno) u `outline` (borde). Sin blur ni transparencia.
 *  ACCIÓN PRINCIPAL (una por vista)
 *      → `primary` (pastilla `--selected-bg/fg`), sobre imagen o sobre superficie.
 *  DESTRUCTIVA → `destructive`.
 *  Con "Reducir transparencia" (`data-flat`) `glass` pasa a sólido `--neutral-elev-2` con borde y sin
 *  `backdrop-filter`; el resto no cambia.
 * -----------------------------------------------------------------------------------------------*/

/** Receta común del vidrio: elev-1 al 60 %, canto superior especular, un solo blur y sólido con `data-flat`. */
const GLASS = [
    "text-on-surface border border-white/15 border-t-white/30 bg-[color-mix(in_srgb,var(--neutral-elev-1)_60%,transparent)] backdrop-blur-overlay-sm shadow-elevation-1",
    "[[data-flat=true]_&]:bg-[var(--neutral-elev-2)] [[data-flat=true]_&]:border-[var(--neutral-separator)] [[data-flat=true]_&]:shadow-none",
    "[[data-flat=true]_&]:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [[data-flat=true]_&]:active:bg-[var(--neutral-elev-3)]",
].join(" ")

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const ButtonAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Button_root",
        "whitespace-nowrap",
        "inline-flex items-center transition-colors duration-fast text-center justify-center select-none transform-gpu cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:pointer-events-none disabled:transform-none disabled:cursor-not-allowed motion-reduce:transition-none motion-reduce:transform-none",
    ], {
        variants: {
            intent: {
                /* ─── Sistema (6 intents) ───────────────────────────────────────── */
                /* Primario: color de acento del modo. En Neutro el acento es blanco (pastilla blanca/negra); en Por era toma el color de la saga. */
                "primary": "bg-brand-accent text-on-primary [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-95 active:brightness-90 shadow-none",
                "secondary": "bg-[var(--neutral-elev-2)] text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:brightness-95 shadow-none",
                /* `ghost` y `outline` son para SUPERFICIES (tarjetas, hojas, formularios): no tienen
                   fondo propio, así que sobre una imagen o póster claro el texto blanco se pierde.
                   Sobre imagen/póster usar `glass`; para la acción principal, `primary`. */
                "ghost": "bg-transparent text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-1)] active:bg-[var(--neutral-elev-2)] shadow-none",
                "outline": "border border-[var(--neutral-separator)] bg-transparent text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-1)] active:bg-[var(--neutral-elev-2)] shadow-none",
                "destructive": "bg-destructive text-destructive-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/90 active:bg-destructive shadow-none",
                /* Solo chrome flotante (un único blur por superficie flotante) */
                "glass": GLASS + " [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[color-mix(in_srgb,var(--neutral-elev-2)_70%,transparent)] active:bg-[var(--neutral-elev-2)]",
            },
            /* Sentence case con .type-label. Táctil 44 px; con puntero fino se compacta. */
            size: {
                xs: "type-label h-11 px-3 rounded-pill [@media(hover:hover)_and_(pointer:fine)]:h-8",
                sm: "type-label h-11 px-3.5 rounded-pill [@media(hover:hover)_and_(pointer:fine)]:h-9",
                md: "type-label text-sm h-11 px-4 rounded-pill [@media(hover:hover)_and_(pointer:fine)]:h-9",
                lg: "type-label text-sm h-12 px-6 rounded-pill",
                icon: "h-11 w-11 rounded-full p-0 [@media(hover:hover)_and_(pointer:fine)]:h-9 [@media(hover:hover)_and_(pointer:fine)]:w-9",
            },
        },
        defaultVariants: {
            intent: "primary",
            size: "md",
        },
    }),
    icon: cva([
        "UI-Button__icon",
        "inline-flex self-center flex-shrink-0",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Button
 * -----------------------------------------------------------------------------------------------*/

/** Spinner de carga (viewBox 0 0 1792 1792). */
const SPINNER_PATH = "M526 1394q0 53-37.5 90.5t-90.5 37.5q-52 0-90-38t-38-90q0-53 37.5-90.5t90.5-37.5 90.5 37.5 37.5 90.5zm498 206q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-704-704q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm1202 498q0 52-38 90t-90 38q-53 0-90.5-37.5t-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-964-996q0 66-47 113t-113 47-113-47-47-113 47-113 113-47 113 47 47 113zm1170 498q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-640-704q0 80-56 136t-136 56-136-56-56-136 56-136 136-56 136 56 56 136zm530 206q0 93-66 158.5t-158 65.5q-93 0-158.5-65.5t-65.5-158.5q0-92 65.5-158t158.5-66q92 0 158 66t66 158z"

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> &
    VariantProps<typeof ButtonAnatomy.root> & {
        loading?: boolean
        leftIcon?: React.ReactNode
        rightIcon?: React.ReactNode
        iconSpacing?: React.CSSProperties["marginInline"]
        hideTextOnSmallScreen?: boolean
    }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {

    const {
        children,
        size,
        className,
        intent,
        leftIcon,
        rightIcon,
        iconSpacing = "0.5rem",
        loading,
        disabled,
        hideTextOnSmallScreen,
        ...rest
    } = props

    const isDisabled = disabled || loading

    return (
        <button
            type="button"
            className={cn(
                ButtonAnatomy.root({
                    size,
                    intent,
                }),
                // Respuesta al toque: se hunde al presionar (150 ms, ease-out fuerte) sin
                // rebote (solo transform en :active; sin agrandado en hover).
                // Una sola transición con color, brillo (`filter`: los hover brightness-* de los intents) y transform,
                // porque twMerge descarta `transition-colors` si le sigue otra clase `transition-*`.
                !isDisabled && "transition-[transform,background-color,border-color,color,box-shadow,filter] duration-fast ease-out-strong motion-safe:active:scale-[0.97]",
                loading && !leftIcon && "relative",
                className,
            )}
            disabled={isDisabled}
            aria-disabled={disabled}
            aria-busy={loading || undefined}
            data-intent={intent ?? "primary"}
            data-liquid-surface={intent === "glass" ? "control" : undefined}
            data-size={size ?? "md"}
            {...rest}
            ref={ref}
        >
            {loading && !leftIcon && (
                    <svg
                        width="15"
                        height="15"
                        fill="currentColor"
                        className="absolute inset-0 m-auto animate-spin pointer-events-none"
                        aria-hidden="true"
                        viewBox="0 0 1792 1792"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d={SPINNER_PATH}
                        >
                        </path>
                    </svg>
            )}
            <>
                {leftIcon &&
                    <span
                        className={cn(ButtonAnatomy.icon(), loading && "relative")}
                        style={{ marginInlineEnd: !hideTextOnSmallScreen ? iconSpacing : 0 }}
                    >
                        {loading ? (
                            /* Con icono, el spinner ocupa su lugar con el mismo tamaño y margen: el icono queda
                               invisible para reservar la caja y el ancho del botón no cambia al cargar. */
                            <>
                                <span className="inline-flex invisible">{leftIcon}</span>
                                <svg
                                    fill="currentColor"
                                    className="absolute inset-0 h-full w-full animate-spin"
                                    viewBox="0 0 1792 1792"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d={SPINNER_PATH} />
                                </svg>
                            </>
                        ) : leftIcon}
                    </span>}
                <span
                    className={cn(
                        hideTextOnSmallScreen && cn(
                            "hidden",
                            leftIcon && "pl-[0.5rem]",
                            rightIcon && "pr-[0.5rem]",
                        ),
                        "md:inline-block",
                        loading && !leftIcon && "opacity-0",
                    )}
                >
                    {children}
                </span>
                {rightIcon &&
                    <span
                        className={cn(ButtonAnatomy.icon(), loading && !leftIcon && "opacity-0")}
                        style={{ marginInlineStart: !hideTextOnSmallScreen ? iconSpacing : 0 }}
                    >
                        {rightIcon}
                    </span>}
            </>
        </button>
    )
})

Button.displayName = "Button"
