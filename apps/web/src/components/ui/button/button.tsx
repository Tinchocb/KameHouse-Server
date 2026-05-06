import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const ButtonAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Button_root",
        "shadow-sm whitespace-nowrap font-medium transition-colors",
        "inline-flex items-center text-white transition-all ease-in-out duration-150 active:scale-[0.98] text-center text-sm justify-center",
        "focus-visible:outline-none focus-visible:ring-2 ring-primary ring-offset-background ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
    ], {
        variants: {
            intent: {
                "primary": "bg-white text-black hover:bg-zinc-200 active:bg-zinc-300",
                "primary-outline": "text-white border border-white bg-transparent hover:bg-white/10 active:bg-white/20",
                "primary-basic": "shadow-none text-white border-transparent bg-transparent hover:bg-white/10 active:bg-white/20",
                "primary-glass": "text-white border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10",

                "gray": "bg-zinc-800 text-white hover:bg-zinc-700",
                "gray-outline": "text-zinc-400 border border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white",
                "gray-subtle": "text-zinc-400 border border-transparent bg-zinc-900 hover:bg-zinc-800",
                "gray-glass": "text-zinc-400 border border-zinc-800 bg-black/40 backdrop-blur-xl hover:bg-white/10",
                "gray-link": "shadow-none text-zinc-400 border-transparent bg-transparent hover:underline",
                "gray-basic": "shadow-none text-zinc-400 border-transparent bg-transparent hover:bg-zinc-900 hover:text-white",

                "alert": "bg-red-600 text-white hover:bg-red-700",
                "alert-outline": "text-red-500 border border-red-600 bg-transparent hover:bg-red-600/10",

                "white": "text-black bg-white hover:bg-zinc-200 active:bg-zinc-300",
                "white-outline": "text-white border border-white bg-transparent hover:bg-white/10",
            },
            rounded: {
                true: "rounded-none",
                false: "rounded-none",
            },
            contentWidth: {
                true: "w-fit",
                false: null,
            },
            size: {
                xs: "text-[10px] h-8 px-2 uppercase font-black tracking-widest",
                sm: "text-[11px] h-10 px-3 uppercase font-black tracking-widest",
                md: "text-xs h-12 px-4 uppercase font-black tracking-widest",
                lg: "text-sm h-14 px-6 uppercase font-black tracking-widest",
                xl: "text-base h-16 px-8 uppercase font-black tracking-widest",
            },
        },
        defaultVariants: {
            intent: "primary",
            size: "md",
            rounded: false,
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


export type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
    VariantProps<typeof ButtonAnatomy.root> &
    ComponentAnatomy<typeof ButtonAnatomy> & {
        loading?: boolean,
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
        rounded = false,
        contentWidth = false,
        intent,
        leftIcon,
        rightIcon,
        iconSpacing = "0.5rem",
        loading,
        iconClass,
        disabled,
        hideTextOnSmallScreen,
        ...rest
    } = props

    return (
        <button
            type="button"
            className={cn(
                ButtonAnatomy.root({
                    size,
                    intent,
                    rounded,
                    contentWidth,
                }),
                className,
            )}
            disabled={disabled || loading}
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
