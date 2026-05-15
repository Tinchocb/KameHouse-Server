"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link } from "@tanstack/react-router"
import { motion } from "framer-motion"
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
    const isFullscreen = useAppStore(state => state.isFullscreen)

    if (isFullscreen) return null

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-24 border-r border-white/5 bg-zinc-950/40 backdrop-blur-2xl z-50">
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                <VaulContent
                    className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/5 bg-zinc-950/60 backdrop-blur-2xl shadow-2xl"
                    overlayClass="bg-black/60 backdrop-blur-sm"
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
        <div className="flex flex-col h-full py-10 px-4 md:px-0 w-full items-center bg-transparent">
            {/* Header / Logo */}
            <div className="mb-14 px-2 flex justify-center group cursor-pointer" onClick={() => setSidebarOpen(false)}>
                <div className="relative">
                    <img 
                        src="/kamehouse-logo.png" 
                        alt="KameHouse" 
                        className="h-10 w-10 shrink-0 object-contain group-hover:scale-110 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-brand-orange/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-4 w-full px-3 md:px-0 flex flex-col items-center">
                {SIDEBAR_ITEMS.map((item) => (
                    <Magnetic key={item.to}>
                        <Link
                            to={item.to}
                            title={item.label}
                            onClick={() => setSidebarOpen(false)}
                            activeProps={{
                                className: "text-white bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                            }}
                            inactiveProps={{
                                className: "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
                            }}
                            className={cn(
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative",
                                "active:scale-90 font-bold"
                            )}
                        >
                            {/* Active Indicator Dot */}
                            <div className="absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full opacity-0 scale-y-0 group-[.active]:opacity-100 group-[.active]:scale-y-100 transition-all duration-500 hidden md:block" />
                            
                            <span className="shrink-0 z-10 transition-transform duration-500 group-hover:scale-110">
                                {item.icon}
                            </span>
                            <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">{item.label}</span>
                        </Link>
                    </Magnetic>
                ))}
            </nav>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 w-full flex flex-col items-center gap-6 pt-8">
                <Magnetic>
                    <button
                        onClick={() => {
                            setActiveTheme(activeTheme === "dark" ? "light" : "dark")
                        }}
                        title="Cambiar Tema"
                        className="flex items-center justify-center w-12 h-12 rounded-2xl border border-white/5 text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-500 group"
                    >
                        <FaMoon className="w-5 h-5 group-hover:rotate-[15deg] transition-transform" />
                    </button>
                </Magnetic>

                <div className="flex flex-col items-center opacity-20 select-none group">
                    <span className="text-[9px] font-black tracking-[0.5em] text-white uppercase group-hover:tracking-[0.6em] transition-all duration-700">KameHouse</span>
                </div>
            </div>
        </div>
    )
}

/**
 * Magnetic component to give a "physical" feel to the icons.
 */
function Magnetic({ children }: { children: React.ReactNode }) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [position, setPosition] = React.useState({ x: 0, y: 0 })

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return
        const { clientX, clientY } = e
        const { left, top, width, height } = ref.current.getBoundingClientRect()
        const middleX = clientX - (left + width / 2)
        const middleY = clientY - (top + height / 2)
        setPosition({ x: middleX * 0.35, y: middleY * 0.35 })
    }

    const reset = () => setPosition({ x: 0, y: 0 })

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={reset}
            animate={{ x: position.x, y: position.y }}
            transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
        >
            {children}
        </motion.div>
    )
}

