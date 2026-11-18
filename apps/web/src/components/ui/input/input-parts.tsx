import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const InputAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Input__root",
        "flex h-11 min-w-0 w-full rounded-full border border-[var(--neutral-separator)] bg-[var(--neutral-elev-2)] px-4 py-2 text-base md:text-sm text-on-surface placeholder:text-label-3 focus-visible:outline-none focus-visible:border-brand-accent/50 disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,background-color,box-shadow] duration-fast ease-smooth-out"
    ], {
        variants: {
            size: {
                sm: "h-10 px-2 py-1 text-xs",
                md: "",
                lg: "h-14 px-4 py-3 text-base",
            },
            intent: {
                basic: "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]",
                filled: "bg-surface-container-low border-transparent focus-within:bg-surface-container-lowest focus-within:border-brand-accent/50 shadow-none",
                unstyled: "bg-transparent hover:bg-transparent border-0 shadow-none focus-within:ring-0 rounded-none p-0 text-base",
            },
            hasError: {
                false: null,
                true: "border-status-error [@media(hover:hover)_and_(pointer:fine)]:hover:border-status-error focus-within:border-status-error",
            },
            isDisabled: {
                false: null,
                true: "shadow-none pointer-events-none opacity-50 cursor-not-allowed bg-surface-container-low",
            },
            isReadonly: {
                false: null,
                true: "pointer-events-none cursor-not-allowed shadow-none",
            },
            hasLeftAddon: { true: null, false: null },
            hasRightAddon: { true: null, false: null },
            hasLeftIcon: { true: null, false: null },
            hasRightIcon: { true: null, false: null },
        },
        compoundVariants: [
            { hasLeftAddon: true, className: "border-l-transparent hover:border-l-transparent rounded-l-none" },
            /**/
            { hasRightAddon: true, className: "border-r-transparent hover:border-r-transparent rounded-r-none" },
            /**/
            { hasLeftAddon: false, hasLeftIcon: true, size: "sm", className: "pl-10" },
            { hasLeftAddon: false, hasLeftIcon: true, size: "md", className: "pl-10" },
            { hasLeftAddon: false, hasLeftIcon: true, size: "lg", className: "pl-12" },
            /**/
            { hasRightAddon: false, hasRightIcon: true, size: "sm", className: "pr-10" },
            { hasRightAddon: false, hasRightIcon: true, size: "md", className: "pr-10" },
            { hasRightAddon: false, hasRightIcon: true, size: "lg", className: "pr-12" },
        ],
        defaultVariants: {
            size: "md",
            intent: "basic",
            hasError: false,
            isDisabled: false,
            hasLeftIcon: false,
            hasRightIcon: false,
            hasLeftAddon: false,
            hasRightAddon: false,
        },
    }),
})

/* -------------------------------------------------------------------------------------------------
 * InputContainer
 * -----------------------------------------------------------------------------------------------*/

const InputContainerAnatomy = defineStyleAnatomy({
    inputContainer: cva([
        "UI-Input__inputContainer",
        "flex relative",
    ]),
})

type InputContainerProps = {
    className: React.HTMLAttributes<HTMLDivElement>["className"],
    children?: React.ReactNode
}

export const InputContainer = ({ className, children }: InputContainerProps) => {

    return (
        <div className={cn(InputContainerAnatomy.inputContainer(), className)}>
            {children}
        </div>
    )
}
InputContainer.displayName = "InputContainer"

/* -------------------------------------------------------------------------------------------------
 * InputStyling
 * -----------------------------------------------------------------------------------------------*/

export type InputStyling = Omit<VariantProps<typeof InputAnatomy.root>,
    "isDisabled" | "hasError" | "hasLeftAddon" | "hasRightAddon" | "hasLeftIcon" | "hasRightIcon"> &
    ComponentAnatomy<typeof InputContainerAnatomy> & {
    leftAddon?: React.ReactNode
    leftIcon?: React.ReactNode
    rightAddon?: React.ReactNode
    rightIcon?: React.ReactNode
}


/* -------------------------------------------------------------------------------------------------
 * Addons Anatomy
 * -----------------------------------------------------------------------------------------------*/

const InputAddonsAnatomy = defineStyleAnatomy({
    icon: cva([
        "UI-Input__addons--icon",
        "pointer-events-none absolute inset-y-0 grid place-content-center text-on-surface-variant",
        "!z-[1]",
    ], {
        variants: {
            size: { sm: "w-10 text-base", md: "w-12 text-lg", lg: "w-14 text-2xl" },
            isLeftIcon: { true: "left-0", false: null },
            isRightIcon: { true: "right-0", false: null },
        },
        defaultVariants: {
            size: "md",
            isLeftIcon: false, isRightIcon: false,
        },
    }),
    addon: cva([
        "UI-Input__addons--addon",
        "bg-surface-container-high inline-flex items-center flex-none px-3 border border-[var(--neutral-separator)] text-on-surface shadow-none text-sm sm:text-base",
    ], {
        variants: {
            size: { sm: "text-sm", md: "text-base", lg: "text-lg" },
            isLeftAddon: { true: "rounded-l-full border-r-0", false: null },
            isRightAddon: { true: "rounded-r-full border-l-0", false: null },
            hasLeftIcon: { true: null, false: null },
            hasRightIcon: { true: null, false: null },
        },
        compoundVariants: [
            { size: "sm", hasLeftIcon: true, isLeftAddon: true, className: "pl-10" },
            { size: "sm", hasRightIcon: true, isRightAddon: true, className: "pr-10" },
            { size: "md", hasLeftIcon: true, isLeftAddon: true, className: "pl-10" },
            { size: "md", hasRightIcon: true, isRightAddon: true, className: "pr-10" },
            { size: "lg", hasLeftIcon: true, isLeftAddon: true, className: "pl-12" },
            { size: "lg", hasRightIcon: true, isRightAddon: true, className: "pr-12" },
        ],
        defaultVariants: {
            size: "md",
            isLeftAddon: false, isRightAddon: false, hasLeftIcon: false, hasRightIcon: false,
        },
    }),
})

/* -------------------------------------------------------------------------------------------------
 * InputIcon
 * -----------------------------------------------------------------------------------------------*/

type InputIconProps = {
    icon: InputStyling["leftIcon"] | undefined,
    size: InputStyling["size"],
    side: "right" | "left",
    props?: Omit<React.ComponentPropsWithoutRef<"span">, "className">,
    className?: string,
}

export const InputIcon = ({ icon, size = "md", side, props, className }: InputIconProps) => {

    if (icon) return <span
        className={cn(InputAddonsAnatomy.icon({ isRightIcon: side === "right", isLeftIcon: side === "left", size }), className)}
        {...props}
    >
        {icon}
    </span>

    return null
}
InputIcon.displayName = "InputIcon"

/* -------------------------------------------------------------------------------------------------
 * InputAddon
 * -----------------------------------------------------------------------------------------------*/

type InputAddonProps = {
    addon: InputStyling["rightAddon"] | InputStyling["leftAddon"] | undefined,
    rightIcon: InputStyling["leftIcon"] | undefined,
    leftIcon: InputStyling["rightIcon"] | undefined,
    size: InputStyling["size"],
    side: "right" | "left",
    props?: Omit<React.ComponentPropsWithoutRef<"span">, "className">,
    className?: string,
}

export const InputAddon = ({ addon, leftIcon, rightIcon, size = "md", side, props, className }: InputAddonProps) => {

    if (addon) return (
        <span
            className={cn(InputAddonsAnatomy.addon({
                isRightAddon: side === "right",
                isLeftAddon: side === "left",
                hasRightIcon: !!rightIcon,
                hasLeftIcon: !!leftIcon,
                size,
            }), className)}
            {...props}
        >
            {addon}
        </span>
    )

    return null

}
InputAddon.displayName = "InputAddon"

/* -------------------------------------------------------------------------------------------------
 * Utils
 * -----------------------------------------------------------------------------------------------*/

export function extractInputPartProps<T extends InputStyling>(props: T) {
    const {
        size,
        leftAddon,
        leftIcon,
        rightAddon,
        rightIcon,
        inputContainerClass, // class
        ...rest
    } = props

    return [{
        size,
        leftAddon,
        leftIcon,
        rightAddon,
        rightIcon,
        ...rest,
    }, {
        inputContainerProps: {
            className: inputContainerClass,
        },
        leftAddonProps: {
            addon: leftAddon,
            leftIcon,
            rightIcon,
            size,
            side: "left",
        },
        rightAddonProps: {
            addon: rightAddon,
            leftIcon,
            rightIcon,
            size,
            side: "right",
        },
        leftIconProps: {
            icon: leftIcon,
            size,
            side: "left",
        },
        rightIconProps: {
            icon: rightIcon,
            size,
            side: "right",
        },
    }] as [
        Omit<T, "inputContainerClass">,
        {
            inputContainerProps: InputContainerProps,
            leftAddonProps: InputAddonProps,
            rightAddonProps: InputAddonProps,
            leftIconProps: InputIconProps,
            rightIconProps: InputIconProps
        }
    ]
}
