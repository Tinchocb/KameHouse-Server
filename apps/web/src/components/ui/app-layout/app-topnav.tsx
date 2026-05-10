import { useAppStore } from "@/lib/store"
import { Link } from "@tanstack/react-router"
import { FaBars } from "react-icons/fa"
import { useState } from "react"
import { useLocation } from "@tanstack/react-router"

interface TopNavProps {
    title?: string
}

export const AppTopNav = ({ title }: TopNavProps) => {
    const { setSidebarOpen } = useAppStore()
    const location = useLocation()

    return (
        <header className="fixed top-0 left-0 right-0 z-[40] bg-black border-b border-zinc-800">
            <div className="flex items-center justify-between h-16 px-4 md:px-8">
                {/* Left side: Mobile Toggle + Context Title */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Abrir menú"
                    >
                        <FaBars className="w-5 h-5" />
                    </button>

                    {title && (
                        <h1 className="text-xl font-bebas tracking-wider text-white uppercase hidden md:block">
                            {title}
                        </h1>
                    )}
                </div>

                {/* Right side: Empty (Search and Profile removed as requested) */}
                <div className="flex items-center gap-4">
                </div>
            </div>
        </header>
    )
}

export const AppBottomNav = () => {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-zinc-800 z-[40] flex items-center justify-around px-6">
            <Link to="/home" className="text-zinc-500 hover:text-white transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Inicio</span>
            </Link>
            <Link to="/series" className="text-zinc-500 hover:text-white transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Series</span>
            </Link>
            <Link to="/movies" className="text-zinc-500 hover:text-white transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Películas</span>
            </Link>
        </nav>
    )
}
