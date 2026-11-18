import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cva } from "class-variance-authority"
import * as React from "react"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const ScrollAreaAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-ScrollArea__root",
        "relative overflow-hidden",
    ]),
    viewport: cva([
        "UI-ScrollArea__viewport",
        "h-full w-full rounded-container",
        "[&>div]:!block",
    ]),
    scrollbar: cva([
        "UI-ScrollArea__scrollbar",
        "flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]",
    ]),
    thumb: cva([
        "UI-ScrollArea__thumb",
        "relative flex-1 rounded-full bg-outline-variant/40 hover:bg-outline-variant/70 transition-colors",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * ScrollArea
 * -----------------------------------------------------------------------------------------------*/

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>((props, ref) => {
    const {
        className,
        children,
        ...rest
    } = props
    return (
        <ScrollAreaPrimitive.Root
            ref={ref}
            className={cn(ScrollAreaAnatomy.root(), className)}
            {...rest}
        >
            <ScrollAreaPrimitive.Viewport className={ScrollAreaAnatomy.viewport()}>
                {children}
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar />
            <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
    )

})
ScrollArea.displayName = "ScrollArea"

/* -------------------------------------------------------------------------------------------------
 * ScrollBar
 * -----------------------------------------------------------------------------------------------*/

type ScrollBarProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>((props, ref) => {
    const { className, ...rest } = props

    return (
        <ScrollAreaPrimitive.ScrollAreaScrollbar
            ref={ref}
            orientation="vertical"
            className={cn(ScrollAreaAnatomy.scrollbar(), className)}
            {...rest}
        >
            <ScrollAreaPrimitive.ScrollAreaThumb className={ScrollAreaAnatomy.thumb()} />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
    )
})
ScrollBar.displayName = "ScrollBar"
