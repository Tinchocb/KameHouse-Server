"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link } from "@tanstack/react-router"
import * as React from "react"
import { FaBook, FaCog, FaHome, FaFilm, FaTv, FaMoon, FaDownload, FaLayerGroup } from "react-icons/fa"
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
    { to: "/settings", label: "Configuración", icon: <FaCog className="w-5 h-5" /> },
]

export function AppSidebar() {
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-24 border-r border-white/5 bg-[#09090b]/80 backdrop-blur-xl z-50 shadow-[10px_0_40px_rgba(0,0,0,0.7)]">
                <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                <VaulContent
                    className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/5 bg-[#09090b]/90 backdrop-blur-xl shadow-2xl"
                    overlayClass="bg-black/60 backdrop-blur-md"
                >
                    <SidebarContent setSidebarOpen={setSidebarOpen} />
                </VaulContent>
            </Vaul>
        </>
    )
}

function SidebarContent({ setSidebarOpen }: { setSidebarOpen: (open: boolean) => void }) {
    const activeTheme = useAppStore(state => state.activeTheme)
    const setActiveTheme = useAppStore(state => state.setActiveTheme)

    return (
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
                            className: "bg-[#ff6b00]/20 text-[#ff6b00] border-[#ff6b00]/40 shadow-[0_0_20px_rgba(255,107,0,0.3)]",
                        }}
                        inactiveProps={{
                            className: "text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 border-transparent",
                        }}
                        className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-500 relative overflow-hidden",
                            "hover:scale-110 active:scale-95 group font-bold"
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
                        setActiveTheme(activeTheme === "dark" ? "light" : "dark")
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
}
