import { useAppStore } from "@/lib/store"
import { Link } from "@tanstack/react-router"
import { IconNavigationSearch, IconNavigationMenu, IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles } from "@/components/ui/icons";
import { NotificationBell } from "./notification-center"

interface TopNavProps {
    title?: string
}

export const AppTopNav = ({ title }: TopNavProps) => {
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
    const isFullscreen = useAppStore(state => state.isFullscreen)

    if (isFullscreen) return null

    // Siempre glass, como AppBottomNav: el estado "transparente hasta scrollear"
    // dependía de un #scroll-sentinel que solo existía en el home, así que en el
    // resto de las rutas el contenido pasaba por debajo de un header invisible.
    return (
        <header
            className="md:hidden fixed top-0 left-0 right-0 z-navbar h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-4 flex items-center justify-between border-b border-white/10 backdrop-blur-overlay-2xl bg-zinc-950/70 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.6)]"
        >
            {/* min-w-0 + truncate: sin esto un título largo empuja los botones fuera de la pantalla */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                    src="/kamehouse-logo.png"
                    alt="KameHouse"
                    className="h-7 w-7 object-contain shrink-0"
                />
                <span className="font-display text-lg text-on-surface tracking-wider uppercase truncate">
                    {title || "KAMEHOUSE"}
                </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                    className="p-2.5 rounded-full text-zinc-300 hover:text-white active:scale-95 transition-all"
                    aria-label="Buscar"
                >
                    <IconNavigationSearch className="w-5 h-5" />
                </button>

                <NotificationBell sidebarOpen={false} compact />

                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="p-2.5 rounded-full text-zinc-300 hover:text-white active:scale-[0.95] transition-all"
                    aria-label="Abrir menú"
                >
                    <IconNavigationMenu className="w-5 h-5" />
                </button>
            </div>
        </header>
    )
}

export const AppBottomNav = () => {
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const setChronologyOpen = useAppStore(state => state.setChronologyOpen)

    if (isFullscreen) return null

    return (
        <div className="md:hidden fixed bottom-3 inset-x-3 z-mobile-nav pointer-events-none">
            <nav className="pointer-events-auto h-14 bg-zinc-950/75 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_12px_36px_-6px_rgba(0,0,0,0.9)] flex items-center justify-around px-3">
                <Link 
                    to="/home" 
                    activeProps={{ className: "text-zinc-950 font-bold bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.3)]" }}
                    inactiveProps={{ className: "text-zinc-300 hover:text-white" }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-base min-h-[36px] text-xs font-semibold"
                >
                    <IconNavigationHome className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Inicio</span>
                </Link>
                <Link 
                    to="/series" 
                    activeProps={{ className: "text-zinc-950 font-bold bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.3)]" }}
                    inactiveProps={{ className: "text-zinc-300 hover:text-white" }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-base min-h-[36px] text-xs font-semibold"
                >
                    <IconNavigationTv className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Series</span>
                </Link>
                <Link 
                    to="/movies" 
                    activeProps={{ className: "text-zinc-950 font-bold bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.3)]" }}
                    inactiveProps={{ className: "text-zinc-300 hover:text-white" }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-base min-h-[36px] text-xs font-semibold"
                >
                    <IconNavigationFilm className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Películas</span>
                </Link>
                <button
                    type="button"
                    onClick={() => setChronologyOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-base min-h-[36px] text-zinc-300 hover:text-white cursor-pointer active:scale-95"
                >
                    <IconStatusSparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Sagas</span>
                </button>
            </nav>
        </div>
    )
}