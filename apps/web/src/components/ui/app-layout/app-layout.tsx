import { __isDesktop__ } from "@/types/constants"
import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { __AppSidebarContext } from "."
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const AppLayoutAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayout__root appLayout",
        // zinc-950 (#09090b) — deepest layer, renders behind both sidebar and content
        "flex w-full group/appLayout min-h-dvh bg-zinc-950 text-white overflow-x-hidden",
    ], {
        variants: {
            withSidebar: {
                true: "flex-row with-sidebar",
                false: "flex-col",
            },
            sidebarSize: {
                slim: "sidebar-slim",
                sm: "sidebar-sm",
                md: "sidebar-md",
                lg: "sidebar-lg",
                xl: "sidebar-xl",
            },
        },
        defaultVariants: {
            withSidebar: false,
            sidebarSize: "md",
        },
        compoundVariants: [
            // sm: breakpoint — sidebar appears at ≥640px (small tablets / landscape phones)
            { withSidebar: true, sidebarSize: "slim", className: "sm:pl-16" },
            { withSidebar: true, sidebarSize: "sm", className: "sm:pl-48" },
            { withSidebar: true, sidebarSize: "md", className: "sm:pl-[260px]" },
            { withSidebar: true, sidebarSize: "lg", className: "sm:pl-[20rem]" },
            { withSidebar: true, sidebarSize: "xl", className: "sm:pl-[25rem]" },
        ],
    }),
})

export const AppLayoutHeaderAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutHeader__root",
        "relative w-full",
    ]),
})

export const AppLayoutSidebarAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutSidebar__root z-50 sm:fixed sm:inset-y-0 sm:left-0",
        // hidden on mobile (<sm), flex column from sm: upward
        "hidden sm:flex sm:flex-col grow-0 shrink-0 basis-0 transition-all duration-300 ease-in-out",
        "group-[.sidebar-slim]/appLayout:w-16",
        "group-[.sidebar-sm]/appLayout:w-48",
        "group-[.sidebar-md]/appLayout:w-[260px]",
        "group-[.sidebar-lg]/appLayout:w-[20rem]",
        "group-[.sidebar-xl]/appLayout:w-[25rem]",
    ]),
})

export const AppLayoutContentAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutContent__root",
        // h-dvh: respects dynamic viewport (mobile URL bar won't clip content)
        // overflow-x-hidden: prevents horizontal bleed on small screens
        "relative flex-1 min-w-0 flex flex-col w-full",
        "overflow-y-auto overflow-x-hidden h-dvh",
        "pb-16 sm:pb-0", // reserve space for BottomNav only on mobile (<sm)
    ]),
})

export const AppLayoutFooterAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutFooter__root",
        "relative",
    ]),
})

export const AppLayoutStackAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutStack__root",
        "relative",
    ], {
        variants: {
            spacing: {
                sm: "space-y-2",
                md: "space-y-4",
                lg: "space-y-8",
                xl: "space-y-10",
            },
        },
        defaultVariants: {
            spacing: "md",
        },
    }),
})

export const AppLayoutGridAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-AppLayoutGrid__root",
        "relative flex flex-col",
    ], {
        variants: {
            breakBelow: {
                sm: "sm:grid sm:space-y-0",
                md: "md:grid md:space-y-0",
                lg: "lg:grid lg:space-y-0",
                xl: "xl:grid xl:space-y-0",
                "2xl": "2xl:grid 2xl:space-y-0",
            },
            spacing: {
                sm: "gap-2",
                md: "gap-4",
                lg: "gap-8",
                xl: "gap-10",
                "2xl": "gap-12",
            },
            cols: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
        },
        defaultVariants: {
            breakBelow: "xl",
            spacing: "md",
            cols: 3,
        },
        compoundVariants: [
            { breakBelow: "sm", cols: 1, className: "sm:grid-cols-1" },
            { breakBelow: "sm", cols: 2, className: "sm:grid-cols-2" },
            { breakBelow: "sm", cols: 3, className: "sm:grid-cols-3" },
            { breakBelow: "sm", cols: 4, className: "sm:grid-cols-4" },
            { breakBelow: "sm", cols: 5, className: "sm:grid-cols-5" },
            { breakBelow: "sm", cols: 6, className: "sm:grid-cols-6" },
            { breakBelow: "md", cols: 1, className: "md:grid-cols-1" },
            { breakBelow: "md", cols: 2, className: "md:grid-cols-2" },
            { breakBelow: "md", cols: 3, className: "md:grid-cols-3" },
            { breakBelow: "md", cols: 4, className: "md:grid-cols-4" },
            { breakBelow: "md", cols: 5, className: "md:grid-cols-5" },
            { breakBelow: "md", cols: 6, className: "md:grid-cols-6" },
            { breakBelow: "lg", cols: 1, className: "lg:grid-cols-1" },
            { breakBelow: "lg", cols: 2, className: "lg:grid-cols-2" },
            { breakBelow: "lg", cols: 3, className: "lg:grid-cols-3" },
            { breakBelow: "lg", cols: 4, className: "lg:grid-cols-4" },
            { breakBelow: "lg", cols: 5, className: "lg:grid-cols-5" },
            { breakBelow: "lg", cols: 6, className: "lg:grid-cols-6" },
            { breakBelow: "xl", cols: 1, className: "xl:grid-cols-1" },
            { breakBelow: "xl", cols: 2, className: "xl:grid-cols-2" },
            { breakBelow: "xl", cols: 3, className: "xl:grid-cols-3" },
            { breakBelow: "xl", cols: 4, className: "xl:grid-cols-4" },
            { breakBelow: "xl", cols: 5, className: "xl:grid-cols-5" },
            { breakBelow: "xl", cols: 6, className: "xl:grid-cols-6" },
        ],
    }),
})

/* -------------------------------------------------------------------------------------------------
 * AppLayout
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutProps = React.ComponentPropsWithRef<"div"> &
    ComponentAnatomy<typeof AppLayoutAnatomy> &
    VariantProps<typeof AppLayoutAnatomy.root>

export const AppLayout = React.forwardRef<HTMLDivElement, AppLayoutProps>((props, ref) => {
    const sidebarContext = React.useContext(__AppSidebarContext)

    const {
        children,
        className,
        withSidebar = false,
        sidebarSize,
        ...rest
    } = props

    const resolvedSidebarSize = withSidebar ? (sidebarContext.size ?? sidebarSize) : sidebarSize

    return (
        <div
            ref={ref}
            className={cn(
                AppLayoutAnatomy.root({ withSidebar, sidebarSize: resolvedSidebarSize }),
                __isDesktop__ && "pt-4 select-none",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    )

})

AppLayout.displayName = "AppLayout"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutHeader
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutHeaderProps = React.ComponentPropsWithRef<"header">

export const AppLayoutHeader = React.forwardRef<HTMLElement, AppLayoutHeaderProps>((props, ref) => {

    const {
        children,
        className,
        ...rest
    } = props

    return (
        <header
            ref={ref}
            className={cn(AppLayoutHeaderAnatomy.root(), className)}
            {...rest}
        >
            {children}
        </header>
    )

})

AppLayoutHeader.displayName = "AppLayoutHeader"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutSidebar
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutSidebarProps = React.ComponentPropsWithRef<"aside">

export const AppLayoutSidebar = React.forwardRef<HTMLElement, AppLayoutSidebarProps>((props, ref) => {

    const {
        children,
        className,
        ...rest
    } = props

    return (
        <aside
            ref={ref}
            className={cn(AppLayoutSidebarAnatomy.root(), className)}
            {...rest}
        >
            {children}
        </aside>
    )

})

AppLayoutSidebar.displayName = "AppLayoutSidebar"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutContent
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutContentProps = React.ComponentPropsWithRef<"main">

export const AppLayoutContent = React.forwardRef<HTMLElement, AppLayoutContentProps>((props, ref) => {

    const {
        children,
        className,
        ...rest
    } = props

    return (
        <main
            ref={ref}
            className={cn(AppLayoutContentAnatomy.root(), className)}
            {...rest}
        >
            {children}
        </main>
    )

})

AppLayoutContent.displayName = "AppLayoutContent"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutGrid
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutGridProps = React.ComponentPropsWithRef<"section"> &
    VariantProps<typeof AppLayoutGridAnatomy.root>

export const AppLayoutGrid = React.forwardRef<HTMLElement, AppLayoutGridProps>((props, ref) => {

    const {
        children,
        className,
        breakBelow,
        cols,
        spacing,
        ...rest
    } = props

    return (
        <section
            ref={ref}
            className={cn(AppLayoutGridAnatomy.root({ breakBelow, cols, spacing }), className)}
            {...rest}
        >
            {children}
        </section>
    )

})

AppLayoutGrid.displayName = "AppLayoutGrid"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutFooter
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutFooterProps = React.ComponentPropsWithRef<"footer">

export const AppLayoutFooter = React.forwardRef<HTMLElement, AppLayoutFooterProps>((props, ref) => {

    const {
        children,
        className,
        ...rest
    } = props

    return (
        <footer
            ref={ref}
            className={cn(AppLayoutFooterAnatomy.root(), className)}
            {...rest}
        >
            {children}
        </footer>
    )

})

AppLayoutFooter.displayName = "AppLayoutFooter"

/* -------------------------------------------------------------------------------------------------
 * AppLayoutStack
 * -----------------------------------------------------------------------------------------------*/

export type AppLayoutStackProps = React.ComponentPropsWithRef<"div"> &
    VariantProps<typeof AppLayoutStackAnatomy.root>

export const AppLayoutStack = React.forwardRef<HTMLDivElement, AppLayoutStackProps>((props, ref) => {

    const {
        children,
        className,
        spacing,
        ...rest
    } = props

    return (
        <div
            ref={ref}
            className={cn(AppLayoutStackAnatomy.root({ spacing }), className)}
            {...rest}
        >
            {children}
        </div>
    )

})

AppLayoutStack.displayName = "AppLayoutStack"

