"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link } from "@tanstack/react-router"
import * as React from "react"
import { FaBook, FaCog, FaHome, FaFilm, FaTv, FaMoon } from "react-icons/fa"
import { cn } from "../core/styling"

interface SidebarItem {
    to: string
    label: string
    icon: React.ReactNode
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="w-5 h-5" /> },
    { to: "/series", label: "Series", icon: <FaTv className="w-5 h-5" /> },
    { to: "/movies", label: "Películas", icon: <FaFilm className="w-5 h-5" /> },
    { to: "/library", label: "Biblioteca", icon: <FaBook className="w-5 h-5" /> },
    { to: "/settings", label: "Configuraciones", icon: <FaCog className="w-5 h-5" /> },
]

export function AppSidebar() {
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)

    const SidebarContent = () => (
        <div className="flex flex-col h-full py-6 md:py-8 px-4 md:px-0 w-full items-center">
            {/* Header */}
            <div className="mb-10 px-2 flex justify-center">
                <img src="/kamehouse-logo.png" alt="KameHouse" className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-4 w-full px-3 md:px-0 flex flex-col items-center">
                {SIDEBAR_ITEMS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        onClick={() => setSidebarOpen(false)}
                        activeProps={{
                            className: "bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
                        }}
                        inactiveProps={{
                            className: "text-zinc-500 hover:bg-white/5 hover:text-white border border-transparent",
                        }}
                        className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-2xl md:rounded-xl",
                            "transition-all duration-300 ease-out active:scale-90 group font-bold"
                        )}
                    >
                        <span className="shrink-0 transition-transform group-hover:scale-110">
                            {item.icon}
                        </span>
                        <span className="md:hidden ml-4 flex-1">{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 border-t border-white/5 w-full flex flex-col items-center gap-4 pt-6">
                <button 
                    onClick={() => {
                        const activeTheme = useAppStore.getState().activeTheme
                        useAppStore.getState().setActiveTheme(activeTheme === "dark" ? "light" : "dark")
                    }}
                    title="Cambiar Tema"
                    className="flex items-center justify-center w-10 h-10 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all"
                >
                    <FaMoon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center opacity-40">
                    <span className="text-[8px] font-black tracking-tighter text-zinc-600">v2.0</span>
                </div>
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-20 border-r border-white/5 bg-black/40 backdrop-blur-3xl z-40 bg-zinc-950">
                <SidebarContent />
            </aside>

            {/* Mobile Drawer */}
            <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                <VaulContent 
                    className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl"
                    overlayClass="bg-black/60 backdrop-blur-sm"
                >
                    <SidebarContent />
                </VaulContent>
            </Vaul>
        </>
    )
}
