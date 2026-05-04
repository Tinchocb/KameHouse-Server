"use client"

import { useAppStore } from "@/lib/store"
import { Link } from "@tanstack/react-router"
import * as React from "react"
import { FaBook, FaCog, FaHome, FaSearch, FaUserCircle, FaFilm, FaTv } from "react-icons/fa"
import { cn } from "../core/styling"

interface NavItem {
    to: string
    label: string
    icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="w-5 h-5 flex-shrink-0" /> },
    { to: "/library", label: "Biblioteca", icon: <FaBook className="w-5 h-5 flex-shrink-0" /> },
    { to: "/series", label: "Series", icon: <FaTv className="w-5 h-5 flex-shrink-0" /> },
    { to: "/movies", label: "Películas", icon: <FaFilm className="w-5 h-5 flex-shrink-0" /> },
]

const BOTTOM_ITEMS: NavItem[] = [
    { to: "/settings", label: "Ajustes", icon: <FaCog className="w-5 h-5 flex-shrink-0" /> },
]

export interface AppTopNavProps extends React.ComponentPropsWithoutRef<"header"> {
    breadcrumbs?: React.ReactNode
    actionButtons?: React.ReactNode
}

export const AppTopNav = React.forwardRef<HTMLElement, AppTopNavProps>((props, ref) => {
    const { className, breadcrumbs, actionButtons, ...rest } = props
    
    // UI Zustand Selectors
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
    const activeTheme = useAppStore(state => state.activeTheme)
    const setActiveTheme = useAppStore(state => state.setActiveTheme)

    // Example handler for Theme toggle
    const handleThemeToggle = () => {
        setActiveTheme(activeTheme === "dark" ? "light" : "dark")
    }

    return (
        <header
            ref={ref}
            className={cn(
                "md:hidden fixed top-0 left-0 w-full z-40 transition-all duration-500 pointer-events-auto",
                "h-20 flex flex-col justify-center",
                "bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.7)]",
                className
            )}
            {...rest}
        >
            <div className="flex items-center justify-between px-6 h-full w-full mx-auto max-w-[2000px]">
                {/* Logo - Left */}
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-3">
                        <img src="/kamehouse-logo.png" alt="KameHouse" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] animate-pulse-slow" />
                        <span className="hidden sm:block text-[11px] font-black uppercase tracking-[0.3em] text-white/90">
                            KameHouse
                        </span>
                    </div>
                </div>

                {/* User / Actions - Right */}
                <div className="flex items-center justify-end gap-3 flex-1">
                    {actionButtons ? actionButtons : (
                        <>
                            <button 
                                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} // Trigger CommandPalette
                                className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                            >
                                <FaSearch className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => setSidebarOpen(true)}
                                className="text-zinc-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                            >
                                <FaUserCircle className="w-7 h-7" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
})

AppTopNav.displayName = "AppTopNav"

export function AppBottomNav() {
    return (
        <nav
            className={cn(
                "fixed inset-x-0 bottom-0 z-50 flex items-center justify-around sm:hidden",
                "border-t border-white/5 bg-[#09090b]/90 backdrop-blur-xl shadow-[0_-15px_40px_rgba(0,0,0,0.7)]",
                "h-[calc(4.8rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]",
            )}
        >
            {[...NAV_ITEMS, ...BOTTOM_ITEMS].map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{
                        className: "text-primary",
                    }}
                    inactiveProps={{
                        className: "text-zinc-500 hover:text-zinc-300",
                    }}
                    className="flex h-full w-full flex-col items-center justify-center gap-1.5 pb-2 transition-all duration-300 relative group"
                >
                    <div className="shrink-0 transition-transform group-active:scale-90 group-[.text-primary]:drop-shadow-[0_0_15px_rgba(255,107,0,0.6)] group-[.text-primary]:text-[#ff6b00]">{item.icon}</div>
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase transition-colors group-[.text-primary]:text-[#ff6b00]">{item.label}</span>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] bg-[#ff6b00] scale-x-0 group-[.text-primary]:scale-x-100 transition-transform duration-500 rounded-full shadow-[0_0_15px_rgba(255,107,0,1)]" />
                </Link>
            ))}
        </nav>
    )
}
