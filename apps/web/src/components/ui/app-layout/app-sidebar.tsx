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
            <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-24 border-r border-white/10 bg-black z-50">
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                <VaulContent
                    className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/10 bg-black shadow-2xl"
                    overlayClass="bg-black/80"
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
        <div className="flex flex-col h-full py-10 px-4 md:px-0 w-full items-center bg-black">
            {/* Header / Logo */}
            <div className="mb-14 px-2 flex justify-center">
                <img src="/kamehouse-logo.png" alt="KameHouse" className="h-10 w-10 shrink-0 object-contain grayscale brightness-200" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-6 w-full px-3 md:px-0 flex flex-col items-center">
                {SIDEBAR_ITEMS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        onClick={() => setSidebarOpen(false)}
                        activeProps={{
                            className: "bg-white text-black border-white shadow-none",
                        }}
                        inactiveProps={{
                            className: "text-zinc-600 hover:bg-zinc-900 hover:text-white border-white/10",
                        }}
                        className={cn(
                            "flex items-center justify-center md:w-12 w-full h-12 rounded-none border transition-all duration-200 group px-4 md:px-0",
                            "active:scale-95 font-bold"
                        )}
                    >
                        <span className="shrink-0 z-10">
                            {item.icon}
                        </span>
                        <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.3em] text-[10px] font-black z-10 text-left">{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 w-full flex flex-col items-center gap-6 pt-8">
                <button
                    onClick={() => {
                        setActiveTheme(activeTheme === "dark" ? "light" : "dark")
                    }}
                    title="Cambiar Tema"
                    className="flex items-center justify-center w-11 h-11 border border-white/10 text-zinc-600 hover:bg-white hover:text-black transition-all duration-200"
                >
                    <FaMoon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center opacity-40 select-none">
                    <span className="text-[8px] font-black tracking-[0.4em] text-white uppercase">KameHouse</span>
                </div>
            </div>
        </div>
    )
}
