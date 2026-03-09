import { Link } from "@tanstack/react-router"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import {
    FaBook,
    FaChevronLeft,
    FaChevronRight,
    FaCog,
    FaCompass,
    FaHome,
} from "react-icons/fa"
import { AppLayoutAnatomy } from "."
import { cn, type ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

type SidebarSize = VariantProps<typeof AppLayoutAnatomy.root>["sidebarSize"]

export const __AppSidebarContext = React.createContext<{
    open: boolean
    setOpen: (open: boolean) => void
    size: SidebarSize
    setSize: (size: SidebarSize) => void
    isBelowBreakpoint: boolean
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
    isHovered: boolean
    setIsHovered: (hovered: boolean) => void
    isPinnedExpanded: boolean
    setIsPinnedExpanded: (pinned: boolean) => void
}>({
    open: false,
    setOpen: () => { },
    size: "md",
    setSize: () => { },
    isBelowBreakpoint: false,
    collapsed: false,
    setCollapsed: () => { },
    isHovered: false,
    setIsHovered: () => { },
    isPinnedExpanded: false,
    setIsPinnedExpanded: () => { },
})

export function useAppSidebarContext() {
    const ctx = React.useContext(__AppSidebarContext)
    if (!ctx) {
        throw new Error("useAppSidebarContext must be used within AppSidebarProvider")
    }
    return ctx
}

export const AppSidebarAnatomy = defineStyleAnatomy({
    sidebar: cva([
        "UI-AppSidebar__sidebar",
        "flex h-full flex-col overflow-hidden",
        "bg-zinc-950/72 supports-[backdrop-filter]:bg-zinc-950/58 backdrop-blur-2xl",
        "border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5)]",
        "transition-all duration-300 ease-out motion-reduce:transition-none",
        "sm:rounded-r-[2rem] sm:border-l-0",
    ]),
})

export const AppSidebarTriggerAnatomy = defineStyleAnatomy({
    trigger: cva([
        "UI-AppSidebarTrigger__trigger",
        "block sm:hidden",
        "items-center justify-center rounded-md p-2",
        "text-zinc-400 hover:bg-zinc-800 hover:text-white",
        "transition-colors duration-150 motion-reduce:transition-none",
        "focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-inset",
    ]),
})

interface NavItem {
    to: string
    label: string
    icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="h-[18px] w-[18px] flex-shrink-0" /> },
    { to: "/discover", label: "Descubrir", icon: <FaCompass className="h-[18px] w-[18px] flex-shrink-0" /> },
    { to: "/library", label: "Biblioteca", icon: <FaBook className="h-[18px] w-[18px] flex-shrink-0" /> },
]

const BOTTOM_ITEMS: NavItem[] = [
    { to: "/settings", label: "Ajustes", icon: <FaCog className="h-[18px] w-[18px] flex-shrink-0" /> },
]

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
                    "relative flex items-center gap-3 rounded-2xl px-4 py-3",
                    "bg-orange-500/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-orange-500",
                    "transition-colors duration-150 motion-reduce:transition-none",
                ),
            }}
            inactiveProps={{
                className: cn(
                    "relative flex items-center gap-3 rounded-2xl px-4 py-3",
                    "text-zinc-400 hover:bg-white/6 hover:text-white",
                    "transition-colors duration-150 motion-reduce:transition-none",
                ),
            }}
            className="w-full"
        >
            <span className="shrink-0">{item.icon}</span>
            <span
                className={cn(
                    "overflow-hidden whitespace-nowrap text-sm font-medium tracking-[0.02em]",
                    "transition-all duration-300 ease-out motion-reduce:transition-none",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                )}
            >
                {item.label}
            </span>
        </Link>
    )
}

export type AppSidebarProps = React.ComponentPropsWithoutRef<"div"> &
    ComponentAnatomy<typeof AppSidebarAnatomy>

export const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>((props, ref) => {
    const { children, className, ...rest } = props
    const { collapsed, isPinnedExpanded, setCollapsed, setIsHovered } = React.useContext(__AppSidebarContext)

    return (
        <div
            ref={ref}
            className={cn(AppSidebarAnatomy.sidebar(), className)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            {...rest}
        >
            <div
                className={cn(
                    "flex h-20 shrink-0 items-center border-b border-white/10 px-5",
                    collapsed ? "justify-center" : "justify-start gap-3",
                )}
            >
                <img
                    src="/kamehouse-logo.png"
                    alt="KameHouse"
                    className="h-8 w-8 shrink-0 object-contain"
                />
                <span
                    className={cn(
                        "overflow-hidden whitespace-nowrap text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white",
                        "transition-all duration-300 ease-out motion-reduce:transition-none",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                    )}
                >
                    KameHouse
                </span>
            </div>

            <nav
                className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-5 scrollbar-hide"
                aria-label="Navegacion principal"
            >
                {NAV_ITEMS.map((item) => (
                    <NavLink key={item.to} item={item} collapsed={collapsed} />
                ))}
            </nav>

            <div className="flex flex-col gap-1.5 border-t border-white/10 px-3 pb-5 pt-4">
                {children && (
                    <div
                        className={cn(
                            "mb-2 overflow-hidden text-xs text-zinc-500 transition-all duration-300 motion-reduce:transition-none",
                            collapsed ? "h-0 opacity-0" : "opacity-100",
                        )}
                    >
                        {children}
                    </div>
                )}

                {BOTTOM_ITEMS.map((item) => (
                    <NavLink key={item.to} item={item} collapsed={collapsed} />
                ))}

                <button
                    type="button"
                    aria-label={isPinnedExpanded ? "Desfijar menu" : "Fijar menu expandido"}
                    aria-pressed={isPinnedExpanded}
                    onClick={() => setCollapsed(isPinnedExpanded)}
                    className={cn(
                        "mt-1 flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3",
                        "text-zinc-400 transition-colors duration-150 motion-reduce:transition-none",
                        "hover:bg-white/6 hover:text-white",
                        collapsed && "justify-center",
                    )}
                >
                    {collapsed ? (
                        <FaChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                        <>
                            <FaChevronLeft className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.16em]">
                                {isPinnedExpanded ? "Desfijar" : "Fijar"}
                            </span>
                        </>
                    )}
                </button>
            </div>
        </div>
    )
})

AppSidebar.displayName = "AppSidebar"

export function AppBottomNav() {
    return (
        <nav
            className={cn(
                "fixed inset-x-0 bottom-0 z-50 flex items-center justify-around sm:hidden",
                "border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md",
                "h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]",
            )}
        >
            {[...NAV_ITEMS, ...BOTTOM_ITEMS].map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{
                        className: "text-orange-400",
                    }}
                    inactiveProps={{
                        className: "text-zinc-500 hover:text-zinc-300",
                    }}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 pb-1 transition-colors duration-200"
                >
                    <div className="shrink-0">{item.icon}</div>
                    <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                </Link>
            ))}
        </nav>
    )
}

export type AppSidebarProviderProps = {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSizeChange?: (size: SidebarSize) => void
    collapsed?: boolean
    onCollapsedChange?: (collapsed: boolean) => void
}

export const AppSidebarProvider: React.FC<AppSidebarProviderProps> = ({
    children,
    onOpenChange,
    onSizeChange,
    onCollapsedChange,
}) => {
    const [open, setOpen] = React.useState(false)
    const [size, setSize] = React.useState<SidebarSize>("md")
    const [isBelowBreakpoint, setIsBelowBreakpoint] = React.useState(false)
    const [isScrollCondensed, setIsScrollCondensed] = React.useState(false)
    const [isHovered, setIsHovered] = React.useState(false)
    const [isPinnedExpanded, setIsPinnedExpanded] = React.useState(false)

    const collapsed = !isBelowBreakpoint && isScrollCondensed && !isHovered && !isPinnedExpanded

    React.useEffect(() => {
        const handleResize = () => {
            setIsBelowBreakpoint(window.innerWidth < 640)
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        setIsPinnedExpanded(window.sessionStorage.getItem("kh.sidebar.pinnedExpanded") === "true")
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.sessionStorage.setItem("kh.sidebar.pinnedExpanded", String(isPinnedExpanded))
    }, [isPinnedExpanded])

    React.useEffect(() => {
        const nextSize: SidebarSize = isBelowBreakpoint ? "md" : (collapsed ? "slim" : "md")
        onSizeChange?.(nextSize)
        setSize(nextSize)
    }, [collapsed, isBelowBreakpoint, onSizeChange])

    React.useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        let cleanup: (() => void) | undefined
        let rafId = 0

        const attachScrollListener = () => {
            const contentElement = window.document.querySelector(".UI-AppLayoutContent__root")

            if (!(contentElement instanceof HTMLElement)) {
                rafId = window.requestAnimationFrame(attachScrollListener)
                return
            }

            const handleScroll = () => {
                setIsScrollCondensed(contentElement.scrollTop > 24)
            }

            handleScroll()
            contentElement.addEventListener("scroll", handleScroll, { passive: true })
            cleanup = () => contentElement.removeEventListener("scroll", handleScroll)
        }

        attachScrollListener()

        return () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId)
            }
            cleanup?.()
        }
    }, [])

    return (
        <__AppSidebarContext.Provider
            value={{
                open,
                setOpen: (value) => {
                    onOpenChange?.(value)
                    setOpen(value)
                },
                size,
                setSize,
                isBelowBreakpoint,
                collapsed,
                setCollapsed: (value) => {
                    onCollapsedChange?.(value)
                    setIsPinnedExpanded(!value)
                    setIsHovered(false)
                },
                isHovered,
                setIsHovered,
                isPinnedExpanded,
                setIsPinnedExpanded,
            }}
        >
            {children}
        </__AppSidebarContext.Provider>
    )
}

AppSidebarProvider.displayName = "AppSidebarProvider"
