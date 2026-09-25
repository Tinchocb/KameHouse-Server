import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const ButtonAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Button_root",
        "shadow-sm whitespace-nowrap font-medium",
        "inline-flex items-center transition-colors duration-fast text-center text-sm justify-center select-none transform-gpu cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:pointer-events-none disabled:transform-none disabled:cursor-not-allowed",
    ], {
        variants: {
            intent: {
                /* ─── MD3 Filled (Primary) ──────────────────────────────────────── */
                "primary": "bg-brand-accent text-on-primary hover:bg-brand-accent/90 active:bg-brand-accent shadow-elevation-1",

                /* ─── MD3 Tonal (Secondary) ─────────────────────────────────────── */
                "secondary": "bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:bg-surface-container-high shadow-elevation-1",

                /* ─── MD3 Outlined ──────────────────────────────────────────────── */
                "outlined": "border border-outline bg-transparent text-brand-accent hover:bg-brand-accent/10 active:bg-brand-accent/10 shadow-none",

                /* ─── MD3 Text (Tertiary) ───────────────────────────────────────── */
                "text": "bg-transparent text-brand-accent hover:bg-brand-accent/10 active:bg-brand-accent/10 shadow-none",

                /* ─── Legacy / Special ──────────────────────────────────────────── */
                "destructive": "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive shadow-elevation-1",
                "ghost": "bg-transparent text-on-surface hover:bg-accent active:bg-accent/50 shadow-none",
                "link": "bg-transparent text-brand-accent underline-offset-4 hover:underline shadow-none",

                /* ─── Glass variants ────────────────────────────────────────────── */
                "primary-glass": "text-on-surface border border-white/10 bg-white/5 backdrop-blur-overlay-sm hover:bg-white/10 shadow-elevation-1",
                "gray-glass": "text-on-surface border border-outline-variant/30 bg-surface-container/60 backdrop-blur-overlay-md hover:bg-surface-container-high shadow-elevation-1",

                /* Brand variants */
                "brand-primary": "bg-brand-accent text-on-primary hover:bg-brand-accent/90 active:bg-brand-accent shadow-brand-primary",
                "brand-secondary": "bg-brand-secondary text-on-secondary hover:bg-brand-secondary/90 active:bg-brand-secondary shadow-brand-secondary",
                "brand-destructive": "bg-brand-destructive text-white hover:bg-brand-destructive/90 active:bg-brand-destructive shadow-brand-destructive",
                "brand-success": "bg-brand-success text-white hover:bg-brand-success/90 active:bg-brand-success shadow-brand-success",
                "brand-magic": "bg-brand-magic text-white hover:bg-brand-magic/90 active:bg-brand-magic shadow-brand-magic",

                /* Semantic Surface / Tone variants */
                "gray": "bg-surface-container text-on-surface-variant/70 hover:bg-surface-container-high",
                "gray-outline": "text-on-surface/70 border border-outline-variant bg-transparent hover:bg-surface-container",
                "gray-subtle": "text-on-surface-variant/70 border border-transparent bg-surface-container-low hover:bg-surface-container",
                "gray-basic": "shadow-none text-on-surface-variant/70 border-transparent bg-transparent hover:bg-surface-container",
                "gray-link": "text-on-surface/70 border-transparent bg-transparent hover:underline",
                "white": "text-on-primary bg-surface hover:bg-surface-container active:bg-surface-container-high",
                "white-outline": "text-on-surface border border-outline bg-transparent hover:bg-surface-container",
                "primary-basic": "shadow-none text-on-surface border-transparent bg-transparent hover:bg-surface-container active:bg-surface-container-high",
                "primary-outline": "text-on-surface border border-outline bg-transparent hover:bg-surface-container active:bg-surface-container-high",
                "primary-glow": "bg-brand-accent text-on-primary hover:bg-brand-accent/90 shadow-brand-focus",
                "alert": "bg-status-error text-white hover:brightness-110",
                "alert-outline": "text-status-error border border-status-error bg-transparent hover:bg-status-error/10",
                "alert-subtle": "bg-status-error/10 text-status-error border border-status-error/30 hover:bg-status-error/20",
            },
            size: {
                xs: "text-label-sm h-8 px-2 uppercase font-black tracking-widest rounded-pill",
                sm: "text-label-sm h-10 px-3 uppercase font-black tracking-widest rounded-pill",
                md: "text-xs h-12 px-4 uppercase font-black tracking-widest rounded-pill",
                lg: "text-sm h-14 px-6 uppercase font-black tracking-widest rounded-pill",
                xl: "text-base h-16 px-8 uppercase font-black tracking-widest rounded-pill",
                icon: "h-10 w-10 rounded-full p-0",
                "icon-sm": "h-8 w-8 rounded-full p-0",
                "icon-lg": "h-12 w-12 rounded-full p-0",
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

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> &
    VariantProps<typeof ButtonAnatomy.root> & {
        loading?: boolean
        leftIcon?: React.ReactNode
        rightIcon?: React.ReactNode
        iconSpacing?: React.CSSProperties["marginInline"]
        hideTextOnSmallScreen?: boolean
        iconClass?: string
        disableSpring?: boolean
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
        iconClass,
        disabled,
        hideTextOnSmallScreen,
        disableSpring = false,
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
                // Respuesta al toque: se hunde al presionar (160 ms, ease-out fuerte) sin
                // rebote. El agrandado de hover queda solo para mouse: en touch se pega.
                // Una sola transición con color y transform, porque twMerge descarta
                // `transition-colors` si le sigue otra clase `transition-*`.
                !isDisabled && !disableSpring && "transition-[transform,background-color,border-color,color,box-shadow] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02] active:scale-[0.97]",
                className,
            )}
            disabled={isDisabled}
            aria-disabled={disabled}
            {...rest}
            ref={ref}
        >
            {loading ? (
                <>
                    <svg
                        width="15"
                        height="15"
                        fill="currentColor"
                        className="animate-spin"
                        viewBox="0 0 1792 1792"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ marginInlineEnd: !hideTextOnSmallScreen ? iconSpacing : 0 }}
                    >
                        <path
                            d="M526 1394q0 53-37.5 90.5t-90.5 37.5q-52 0-90-38t-38-90q0-53 37.5-90.5t90.5-37.5 90.5 37.5 37.5 90.5zm498 206q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-704-704q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm1202 498q0 52-38 90t-90 38q-53 0-90.5-37.5t-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-964-996q0 66-47 113t-113 47-113-47-47-113 47-113 113-47 113 47 47 113zm1170 498q0 53-37.5 90.5t-90.5 37.5-90.5-37.5-37.5-90.5 37.5-90.5 90.5-37.5 90.5 37.5 37.5 90.5zm-640-704q0 80-56 136t-136 56-136-56-56-136 56-136 136-56 136 56 56 136zm530 206q0 93-66 158.5t-158 65.5q-93 0-158.5-65.5t-65.5-158.5q0-92 65.5-158t158.5-66q92 0 158 66t66 158z"
                        >
                        </path>
                    </svg>
                    {children}
                </>
            ) : <>
                {leftIcon &&
                    <span
                        className={cn(ButtonAnatomy.icon(), iconClass)}
                        style={{ marginInlineEnd: !hideTextOnSmallScreen ? iconSpacing : 0 }}
                    >
                        {leftIcon}
                    </span>}
                <span
                    className={cn(
                        hideTextOnSmallScreen && cn(
                            "hidden",
                            leftIcon && "pl-[0.5rem]",
                            rightIcon && "pr-[0.5rem]",
                        ),
                        "md:inline-block",
                    )}
                >
                    {children}
                </span>
                {rightIcon &&
                    <span
                        className={cn(ButtonAnatomy.icon(), iconClass)}
                        style={{ marginInlineStart: !hideTextOnSmallScreen ? iconSpacing : 0 }}
                    >
                        {rightIcon}
                    </span>}
            </>}
        </button>
    )
})

Button.displayName = "Button"