/**
 * AppSidebar
 *
 * A fixed, collapsible navigation sidebar inspired by Stremio's minimal aesthetic.
 *
 * ─── Two desktop states ───────────────────────────────────────────────────────
 *  Expanded  (default, sidebarSize="md") → 240 px · icon + label visible
 *  Collapsed (sidebarSize="slim")        →  64 px · icon only + tooltip on hover
 *
 * ─── Mobile ───────────────────────────────────────────────────────────────────
 *  The sidebar is hidden below the `lg` breakpoint.
 *  AppSidebarTrigger opens the existing Drawer component for small screens.
 *
 * ─── Palette ──────────────────────────────────────────────────────────────────
 *  Background:   bg-zinc-900
 *  Divider:      border-zinc-800
 *  Icon/text:    text-zinc-400  (inactive) / text-white (active/hover)
 *  Active pill:  bg-white (2 px left border accent)
 *  Hover bg:     bg-zinc-800/60
 *  Active bg:    bg-zinc-800
 */

import { cva, VariantProps } from "class-variance-authority"
import * as React from "react"
import { AppLayoutAnatomy } from "."
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"
import { Drawer, DrawerProps } from "../drawer"
import { Link } from "@tanstack/react-router"
import {
    FaHome,
    FaBook,
    FaCog,
    FaCompass,
    FaChevronLeft,
    FaChevronRight,
} from "react-icons/fa"

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const __AppSidebarContext = React.createContext<{
    open: boolean
    setOpen: (open: boolean) => void
    size: VariantProps<typeof AppLayoutAnatomy.root>["sidebarSize"]
    setSize: (size: VariantProps<typeof AppLayoutAnatomy.root>["sidebarSize"]) => void
    isBelowBreakpoint: boolean
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
}>({
    open: false,
    setOpen: () => { },
    setSize: () => { },
    size: "md",
    isBelowBreakpoint: false,
    collapsed: false,
    setCollapsed: () => { },
})

export function useAppSidebarContext() {
    const ctx = React.useContext(__AppSidebarContext)
    if (!ctx) throw new Error("useAppSidebarContext must be used within AppSidebarProvider")
    return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Anatomy
// ─────────────────────────────────────────────────────────────────────────────

export const AppSidebarAnatomy = defineStyleAnatomy({
    sidebar: cva([
        "UI-AppSidebar__sidebar",
        // Full height, vertical flex, smooth width transition, no outer scrollbar
        "flex flex-col h-full overflow-hidden",
        // Zinc-900 background with a single right-border divider
        "bg-zinc-900 border-r border-zinc-800",
        // Width transition synced with the layout's sidebar width change
        "transition-all duration-300 ease-in-out",
    ]),
})

export const AppSidebarTriggerAnatomy = defineStyleAnatomy({
    trigger: cva([
        "UI-AppSidebarTrigger__trigger",
        "block lg:hidden",
        "items-center justify-center rounded-md p-2",
        "text-zinc-400 hover:text-white hover:bg-zinc-800",
        "transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-inset",
    ]),
})

// ─────────────────────────────────────────────────────────────────────────────
// Navigation items definition
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
    to: string
    label: string
    icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="w-[18px] h-[18px] flex-shrink-0" /> },
    { to: "/discover", label: "Descubrir", icon: <FaCompass className="w-[18px] h-[18px] flex-shrink-0" /> },
    { to: "/library", label: "Biblioteca", icon: <FaBook className="w-[18px] h-[18px] flex-shrink-0" /> },
]

const BOTTOM_ITEMS: NavItem[] = [
    { to: "/settings", label: "Ajustes", icon: <FaCog className="w-[18px] h-[18px] flex-shrink-0" /> },
]

// ─────────────────────────────────────────────────────────────────────────────
// NavLink — individual sidebar link
// ─────────────────────────────────────────────────────────────────────────────

interface NavLinkProps {
    item: NavItem
    collapsed: boolean
}

function NavLink({ item, collapsed }: NavLinkProps) {
    return (
        <Link
            to={item.to}
            title={collapsed ? item.label : undefined}
            activeProps={{
                className: cn(
                    "relative flex items-center gap-3 px-4 py-2.5 rounded-lg",
                    "bg-zinc-800 text-white font-medium",
                    // White left pill — the only active accent (no colour)
                    "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                    "before:h-5 before:w-0.5 before:rounded-full before:bg-white",
                    "before:-ml-[1px]",                  // sits flush inside the rounded-lg
                    "transition-colors duration-150",
                ),
            }}
            inactiveProps={{
                className: cn(
                    "relative flex items-center gap-3 px-4 py-2.5 rounded-lg",
                    "text-zinc-400 hover:text-white hover:bg-zinc-800/60",
                    "transition-colors duration-150",
                ),
            }}
            className="w-full"
        >
            {/* Icon — always visible */}
            <span className="shrink-0">{item.icon}</span>

            {/* Label — hidden in collapsed state with a smooth fade */}
            <span
                className={cn(
                    "text-sm font-medium whitespace-nowrap overflow-hidden",
                    "transition-all duration-300 ease-in-out",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                )}
            >
                {item.label}
            </span>
        </Link>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// AppSidebar
// ─────────────────────────────────────────────────────────────────────────────

export type AppSidebarProps = React.ComponentPropsWithoutRef<"div"> &
    ComponentAnatomy<typeof AppSidebarAnatomy> & {
        mobileDrawerProps?: Partial<DrawerProps>
    }

export const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
    (props, ref) => {
        const { children, className, ...rest } = props
        const ctx = React.useContext(__AppSidebarContext)
        const { collapsed, setCollapsed } = ctx

        return (
            <>
                {/* ── Desktop sidebar ──────────────────────────────── */}
                <div
                    ref={ref}
                    className={cn(AppSidebarAnatomy.sidebar(), className)}
                    {...rest}
                >
                    {/* ── Logo zone ─────────────────────────────────── */}
                    <div
                        className={cn(
                            "flex items-center h-16 shrink-0 px-4",
                            "border-b border-zinc-800",
                            collapsed ? "justify-center" : "justify-start gap-3",
                        )}
                    >
                        <img
                            src="/kamehouse-logo.png"
                            alt="KameHouse"
                            className={cn(
                                "object-contain transition-all duration-300 shrink-0",
                                collapsed ? "w-8 h-8" : "w-8 h-8",
                            )}
                        />
                        <span
                            className={cn(
                                "text-white font-bold text-sm tracking-wide whitespace-nowrap overflow-hidden",
                                "transition-all duration-300 ease-in-out",
                                collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                            )}
                        >
                            KameHouse
                        </span>
                    </div>

                    {/* ── Primary navigation ────────────────────────── */}
                    <nav
                        className="flex flex-col gap-1 px-2 pt-4 flex-1 overflow-y-auto scrollbar-hide"
                        aria-label="Navegación principal"
                    >
                        {NAV_ITEMS.map((item) => (
                            <NavLink key={item.to} item={item} collapsed={collapsed} />
                        ))}
                    </nav>

                    {/* ── Bottom slot (settings + optional children) ── */}
                    <div className="flex flex-col gap-1 px-2 pb-4 border-t border-zinc-800 pt-3">
                        {/* Extra content injected via children (e.g. server status badge) */}
                        {children && (
                            <div
                                className={cn(
                                    "mb-2 text-xs text-zinc-500 overflow-hidden transition-all duration-300",
                                    collapsed ? "h-0 opacity-0" : "opacity-100",
                                )}
                            >
                                {children}
                            </div>
                        )}

                        {BOTTOM_ITEMS.map((item) => (
                            <NavLink key={item.to} item={item} collapsed={collapsed} />
                        ))}

                        {/* ── Collapse toggle ──────────────────────── */}
                        <button
                            type="button"
                            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                            onClick={() => setCollapsed(!collapsed)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-lg w-full mt-1",
                                "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60",
                                "transition-colors duration-150",
                                collapsed && "justify-center",
                            )}
                        >
                            {collapsed ? (
                                <FaChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                                <>
                                    <FaChevronLeft className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="text-xs font-medium whitespace-nowrap">
                                        Colapsar
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Mobile drawer ─────────────────────────────────── */}
                <Drawer
                    open={ctx.open}
                    onOpenChange={(v) => ctx.setOpen(v)}
                    side="left"
                >
                    {/* Minimal drawer version: just nav items without collapse toggle */}
                    <div className="flex flex-col h-full bg-zinc-900">
                        <div className="flex items-center gap-3 h-16 px-4 border-b border-zinc-800">
                            <img src="/kamehouse-logo.png" alt="KameHouse" className="w-8 h-8 object-contain" />
                            <span className="text-white font-bold text-sm tracking-wide">KameHouse</span>
                        </div>
                        <nav className="flex flex-col gap-1 px-2 pt-4 flex-1" aria-label="Navegación móvil">
                            {[...NAV_ITEMS, ...BOTTOM_ITEMS].map((item) => (
                                <NavLink key={item.to} item={item} collapsed={false} />
                            ))}
                        </nav>
                    </div>
                </Drawer>
            </>
        )
    },
)

AppSidebar.displayName = "AppSidebar"

// ─────────────────────────────────────────────────────────────────────────────
// AppSidebarTrigger — hamburger for mobile
// ─────────────────────────────────────────────────────────────────────────────

export type AppSidebarTriggerProps = React.ComponentPropsWithoutRef<"button"> &
    ComponentAnatomy<typeof AppSidebarTriggerAnatomy>

export const AppSidebarTrigger = React.forwardRef<
    HTMLButtonElement,
    AppSidebarTriggerProps
>((props, ref) => {
    const { children, className, ...rest } = props
    const ctx = React.useContext(__AppSidebarContext)

    return (
        <button
            ref={ref}
            type="button"
            aria-label="Abrir menú"
            className={cn(AppSidebarTriggerAnatomy.trigger(), className)}
            onClick={() =>
                ctx.isBelowBreakpoint
                    ? ctx.setOpen(!ctx.open)
                    : ctx.setCollapsed(!ctx.collapsed)
            }
            {...rest}
        >
            <span className="sr-only">Abrir menú principal</span>
            {(ctx.isBelowBreakpoint ? ctx.open : !ctx.collapsed) ? (
                // X icon
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                >
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
            ) : (
                // Hamburger icon
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                >
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
            )}
            {children}
        </button>
    )
})

AppSidebarTrigger.displayName = "AppSidebarTrigger"

// ─────────────────────────────────────────────────────────────────────────────
// AppSidebarProvider
// ─────────────────────────────────────────────────────────────────────────────

export type AppSidebarProviderProps = {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSizeChange?: (
        size: VariantProps<typeof AppLayoutAnatomy.root>["sidebarSize"],
    ) => void
    collapsed?: boolean
    onCollapsedChange?: (collapsed: boolean) => void
}

export const AppSidebarProvider: React.FC<AppSidebarProviderProps> = ({
    children,
    onOpenChange,
    onSizeChange,
    collapsed: controlledCollapsed,
    onCollapsedChange,
}) => {
    const [open, setOpen] = React.useState(false)
    const [collapsed, setCollapsed] = React.useState(controlledCollapsed ?? false)
    const [size, setSize] = React.useState<
        VariantProps<typeof AppLayoutAnatomy.root>["sidebarSize"]
    >(undefined)

    const [isBelowBreakpoint, setIsBelowBreakpoint] = React.useState(false)

    React.useEffect(() => {
        const handleResize = () =>
            setIsBelowBreakpoint(window.innerWidth < 1024) // lg breakpoint
        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
        // Intentional: only track isBelowBreakpoint, no dep on the value itself
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <__AppSidebarContext.Provider
            value={{
                open,
                setOpen: (v) => {
                    onOpenChange?.(v)
                    setOpen(v)
                },
                setSize: (v) => {
                    onSizeChange?.(v)
                    setSize(v)
                },
                size,
                isBelowBreakpoint,
                collapsed,
                setCollapsed: (v) => {
                    onCollapsedChange?.(v)
                    setCollapsed(v)
                },
            }}
        >
            {children}
        </__AppSidebarContext.Provider>
    )
}

AppSidebarProvider.displayName = "AppSidebarProvider"
