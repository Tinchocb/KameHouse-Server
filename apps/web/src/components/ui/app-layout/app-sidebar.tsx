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
                <img src="/kamehouse-logo.png" alt="KameHouse" className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] animate-pulse-slow" />
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
                            className: "bg-primary/20 text-primary border-primary/40 shadow-[0_0_25px_rgba(249,115,22,0.25)]",
                        }}
                        inactiveProps={{
                            className: "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200 border-transparent",
                        }}
                        className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-500 relative overflow-hidden",
                            "hover:scale-105 active:scale-95 group font-bold"
                        )}
                    >
                        <span className="shrink-0 transition-transform group-hover:scale-110 group-active:scale-90 z-10">
                            {item.icon}
                        </span>
                        <span className="md:hidden ml-4 flex-1 uppercase tracking-[0.2em] text-[11px] font-black z-10">{item.label}</span>
                        
                        {/* Neon Glow on hover / active */}
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500" />
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
            <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-24 border-r border-white/[0.04] bg-background/40 backdrop-blur-3xl z-40 shadow-[10px_0_40px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                <SidebarContent />
            </aside>

            {/* Mobile Drawer */}
            <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                <VaulContent 
                    className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/10 bg-background/90 backdrop-blur-3xl shadow-2xl"
                    overlayClass="bg-black/40 backdrop-blur-sm"
                >
                    <SidebarContent />
                </VaulContent>
            </Vaul>
        </>
    )
}
