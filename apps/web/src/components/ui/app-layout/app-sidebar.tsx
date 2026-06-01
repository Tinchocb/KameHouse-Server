"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link } from "@tanstack/react-router"
import { motion } from "framer-motion"
import * as React from "react"
import { FaBook, FaCog, FaHome, FaFilm, FaTv, FaMoon, FaDownload, FaLayerGroup } from "react-icons/fa"
import { cn } from "../core/styling"
import { RandomPlayButton } from "./random-play-button"
import { useSound } from "@/hooks/use-sound"
import { BackgroundMusicPlayer } from "./background-music"

interface SidebarItem {
    to: string
    label: string
    icon: React.ReactNode
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="w-5 h-5" /> },
    { to: "/series", label: "Series", icon: <FaTv className="w-5 h-5" /> },
    { to: "/movies", label: "Películas", icon: <FaFilm className="w-5 h-5" /> },
]

export function AppSidebar() {
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768) // 768px is the 'md' breakpoint
        }
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    if (isFullscreen) return null

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex flex-col shrink-0 h-full w-24 border-r border-white/5 bg-zinc-950/40 backdrop-blur-2xl z-50">
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            {isMobile && (
                <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                    <VaulContent
                        className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/5 bg-zinc-950/60 backdrop-blur-2xl shadow-2xl"
                        overlayClass="md:hidden bg-black/60 backdrop-blur-sm"
                    >
                        <SidebarContent setSidebarOpen={setSidebarOpen} />
                    </VaulContent>
                </Vaul>
            )}
        </>
    )
}

function SidebarContent({ setSidebarOpen }: { setSidebarOpen: (open: boolean) => void }) {
    const { playSound } = useSound()
    const activeTheme = useAppStore(state => state.activeTheme)
    const setActiveTheme = useAppStore(state => state.setActiveTheme)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const globalQueueOpen = useAppStore(state => state.globalQueueOpen)
    const setGlobalQueueOpen = useAppStore(state => state.setGlobalQueueOpen)

    const playChangeSound = () => {
        playSound("category", 0.4)
    }

    return (
        <div className="flex flex-col h-full py-10 px-4 md:px-0 w-full items-center bg-transparent">
            {/* Header / Logo */}
            <div className="mb-14 px-2 flex justify-center group cursor-pointer" onClick={() => { setSidebarOpen(false); playChangeSound(); }}>
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
                            onClick={() => { setSidebarOpen(false); playChangeSound(); }}
                            activeProps={{
                                className: "text-white bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md",
                            }}
                            inactiveProps={{
                                className: "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
                            }}
                            className={cn(
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative backdrop-blur-md",
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

                {/* Queue Toggle Button - Shown conditionally */}
                {playlistQueue.length > 0 && (
                    <Magnetic>
                        <button
                            onClick={() => {
                                setGlobalQueueOpen(!globalQueueOpen)
                                setSidebarOpen(false)
                                playChangeSound()
                            }}
                            title="Cola de Reproducción"
                            className={cn(
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative backdrop-blur-md",
                                globalQueueOpen
                                    ? "text-brand-orange bg-brand-orange/10 border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
                                "active:scale-90 font-bold"
                            )}
                        >
                            {/* Active Indicator Dot */}
                            <div className={cn(
                                "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                                globalQueueOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                            )} />
                            
                            <span className="shrink-0 z-10 transition-transform duration-500 group-hover:scale-110 relative">
                                <FaLayerGroup className="w-5 h-5" />
                                {/* Badge count */}
                                <span className="absolute -top-2.5 -right-2.5 bg-brand-orange text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-zinc-950 shadow-md">
                                    {playlistQueue.length}
                                </span>
                            </span>
                            <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">
                                Cola ({playlistQueue.length})
                            </span>
                        </button>
                    </Magnetic>
                )}
            </nav>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 w-full flex flex-col items-center gap-6 pt-8"> 
                {/* Background Music */}
                <BackgroundMusicPlayer />

                {/* Random Play */}
                <RandomPlayButton />
               
                {/* Settings (Always at the bottom) */}
                <Magnetic>
                    <Link
                        to="/settings"
                        title="Configuración"
                        onClick={() => { setSidebarOpen(false); playChangeSound(); }}
                        activeProps={{
                            className: "text-white bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md",
                        }}
                        inactiveProps={{
                            className: "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
                        }}
                        className={cn(
                            "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative backdrop-blur-md",
                            "active:scale-90 font-bold"
                        )}
                    >
                        {/* Active Indicator Dot */}
                        <div className="absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full opacity-0 scale-y-0 group-[.active]:opacity-100 group-[.active]:scale-y-100 transition-all duration-500 hidden md:block" />
                        
                        <span className="shrink-0 z-10 transition-transform duration-500 group-hover:scale-110">
                            <FaCog className="w-5 h-5" />
                        </span>
                        <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">Configuración</span>
                    </Link>
                </Magnetic>
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

    const rafId = React.useRef<number | null>(null)

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return
        const { clientX, clientY } = e
        const { left, top, width, height } = ref.current.getBoundingClientRect()
        const middleX = clientX - (left + width / 2)
        const middleY = clientY - (top + height / 2)
        
        if (rafId.current) cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(() => {
            setPosition({ x: middleX * 0.35, y: middleY * 0.35 })
        })
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

