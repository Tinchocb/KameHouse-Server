import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const BadgeAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Badge__root",
        "inline-flex flex-none text-base w-fit overflow-hidden justify-center items-center gap-2",
        "group/badge",
    ], {
        variants: {
            intent: {
                "gray": "text-zinc-800 bg-zinc-100 border border-zinc-500 border-opacity-40 dark:text-zinc-300 dark:bg-zinc-900",
                "primary": "text-white bg-black border border-white dark:text-black dark:bg-white",
                "success": "text-zinc-800 bg-zinc-100 border border-zinc-500 border-opacity-40 dark:text-zinc-300 dark:bg-zinc-900",
                "warning": "text-zinc-800 bg-zinc-100 border border-zinc-500 border-opacity-40 dark:text-zinc-300 dark:bg-zinc-900",
                "alert": "text-white bg-black border border-white dark:text-black dark:bg-white",
                "basic": "text-gray-900 bg-transparent dark:text-white",
                "white": "text-black bg-white border border-black dark:text-white dark:bg-black dark:border-white",
                "gray-solid": "text-white bg-zinc-700",
                "zinc-solid": "text-white bg-zinc-900 dark:bg-zinc-100 dark:text-black",
                "white-solid": "text-black bg-white",
                "unstyled": "border text-zinc-300",
            },
            size: {
                sm: "h-[1.2rem] px-1.5 text-xs",
                md: "h-6 px-2 text-xs",
                lg: "h-7 px-3 text-md",
                xl: "h-8 px-4 text-lg",
            },
            tag: {
                false: "font-black uppercase tracking-widest rounded-none",
                true: "font-black uppercase tracking-widest rounded-none",
            },
        },
        defaultVariants: {
            intent: "primary",
            size: "md",
            tag: false,
        },
    }),
    closeButton: cva([
        "UI-Badge__close-button",
        "appearance-none outline-none text-lg -mr-1 cursor-pointer transition ease-in hover:opacity-60",
        "focus-visible:ring-2 focus-visible:ring-[--ring]",
    ]),
    icon: cva([
        "UI-Badge__icon",
        "inline-flex self-center flex-shrink-0",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Badge
 * -----------------------------------------------------------------------------------------------*/

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    intent?: "gray" | "primary" | "success" | "warning" | "alert" | "basic" | "white" | "gray-solid" | "zinc-solid" | "white-solid" | "unstyled"
    size?: "sm" | "md" | "lg" | "xl"
    tag?: boolean
    isClosable?: boolean
    onClose?: () => void
    leftIcon?: React.ReactElement
    rightIcon?: React.ReactElement
    iconSpacing?: React.CSSProperties["marginRight"]
    closeButtonClass?: string
    iconClass?: string
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {

    const {
        children,
        className,
        size,
        intent,
        tag = false,
        isClosable,
        onClose,
        leftIcon,
        rightIcon,
        iconSpacing = "0",
        closeButtonClass,
        iconClass,
        ...rest
    } = props

    return (
        <span
            ref={ref}
            className={cn(BadgeAnatomy.root({ size, intent, tag }), className)}
            {...rest}
        >
            {leftIcon && <span className={cn(BadgeAnatomy.icon(), iconClass)} style={{ marginRight: iconSpacing }}>{leftIcon}</span>}

            {children}

            {rightIcon && <span className={cn(BadgeAnatomy.icon(), iconClass)} style={{ marginLeft: iconSpacing }}>{rightIcon}</span>}

            {isClosable && <button className={cn(BadgeAnatomy.closeButton(), closeButtonClass)} onClick={onClose}>
                <svg
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"
                    fill="currentColor"
                >
                    <path
                        d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"
                    ></path>
                </svg>
            </button>}
        </span>
    )

})

Badge.displayName = "Badge"
