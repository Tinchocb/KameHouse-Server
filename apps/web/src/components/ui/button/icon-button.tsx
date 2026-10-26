import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { Button, ButtonProps } from "./button"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const IconButtonAnatomy = defineStyleAnatomy({
    root: cva("UI-IconButton_root p-0 flex-none", {
        variants: {
            size: {
                // 44 px en táctil, 36 con puntero fino (xs/sm compactan a 32, el mínimo de la guía).
                xs: "text-xl h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-8 [@media(hover:hover)_and_(pointer:fine)]:w-8",
                sm: "text-xl h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-8 [@media(hover:hover)_and_(pointer:fine)]:w-8",
                md: "text-2xl h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-9 [@media(hover:hover)_and_(pointer:fine)]:w-9",
                // lg/xl no compactan: sin fijar la altura con puntero fino, el h-9 de la talla md de Button los dejaba ovalados (48×36).
                lg: "text-3xl h-12 w-12 [@media(hover:hover)_and_(pointer:fine)]:h-12",
                xl: "text-4xl h-14 w-14 [@media(hover:hover)_and_(pointer:fine)]:h-14",
            },
        },
        defaultVariants: {
            size: "md",
        },
    }),
})

/* -------------------------------------------------------------------------------------------------
 * IconButton
 * -----------------------------------------------------------------------------------------------*/


export type IconButtonProps = Omit<ButtonProps, "leftIcon" | "rightIcon" | "iconSpacing" | "iconClass" | "children" | "size"> &
    VariantProps<typeof IconButtonAnatomy.root> & {
        icon?: React.ReactNode
        /** Obligatorio: un botón de solo ícono no tiene texto visible. */
        "aria-label": string
    }

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {

    const {
        className,
        icon,
        size,
        loading,
        ...rest
    } = props

    return (
        <Button
            className={cn(
                IconButtonAnatomy.root({ size }),
                className,
            )}
            loading={loading}
            iconSpacing="0"
            {...rest}
            ref={ref}
        >
            {!loading && icon}
        </Button>
    )

})

IconButton.displayName = "IconButton"
