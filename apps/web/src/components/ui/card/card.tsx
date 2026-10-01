import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const CardAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Card__root bg-surface border border-outline-variant rounded-container shadow-elevation-1 transition-[transform,box-shadow,background-color,border-color] duration-fast ease-out-strong",
    ], {
        variants: {
            variant: {
                elevated: "shadow-elevation-2 bg-surface-container",
                outlined: "border-2 border-outline bg-transparent shadow-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-low",
                filled: "bg-surface-container-highest border-none shadow-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high",
                tonal: "bg-secondary-container border-none shadow-none",
            },
            interactive: {
                true: "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-elevation-2 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]",
                false: "",
            },
            padded: {
                true: "p-6",
                false: "",
            },
        },
        defaultVariants: {
            variant: "elevated",
            interactive: true,
            padded: false,
        },
    }),
    header: cva([
        "UI-Card__header",
        "flex flex-col space-y-1.5 p-6 pt-6 pb-2",
    ]),
    title: cva([
        "UI-Card__title",
        "text-xl font-semibold leading-tight tracking-tight",
    ]),
    description: cva([
        "UI-Card__description",
        "text-sm text-on-surface-variant",
    ]),
    content: cva([
        "UI-Card__content",
        "p-6 pt-0",
    ]),
    footer: cva([
        "UI-Card__footer",
        "flex items-center p-6 pt-0 gap-3",
    ]),
})

/**
 * CardProps — los componentes Card* se eliminaron por no usarse;
 * el tipo sigue vivo (getting-started lo importa como anotación).
 */
export type CardProps = React.ComponentPropsWithoutRef<"div"> & VariantProps<typeof CardAnatomy.root>
