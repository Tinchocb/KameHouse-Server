import { useAppStore } from "@/lib/store"
import { Link } from "@tanstack/react-router"
import { FaSearch, FaUser, FaBars } from "react-icons/fa"
import { useState } from "react"
import { useLocation } from "@tanstack/react-router"

interface TopNavProps {
    title?: string
}

export const AppTopNav = ({ title }: TopNavProps) => {
    const { setSidebarOpen } = useAppStore()
    const location = useLocation()
    const [isSearchFocused, setIsSearchFocused] = useState(false)

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

                {/* Right side: Search + Profile */}
                <div className="flex items-center gap-4">
                    <div className={`relative flex items-center transition-all duration-300 ${isSearchFocused ? 'w-64' : 'w-48'}`}>
                        <FaSearch className="absolute left-3 text-zinc-500 w-3 h-3" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-none py-1.5 pl-10 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all"
                        />
                    </div>

                    <button className="w-9 h-9 flex items-center justify-center border border-zinc-800 text-zinc-400 hover:bg-white hover:text-black transition-colors">
                        <FaUser className="w-4 h-4" />
                    </button>
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
