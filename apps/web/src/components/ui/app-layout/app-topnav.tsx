import { useAppStore, useUIStore } from "@/lib/store"
import { Link, useRouterState } from "@tanstack/react-router"
import { IconNavigationSearch, IconNavigationMenu, IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconUiAdmin } from "@/components/ui/icons"
import { MagneticIndicator, MagneticHover } from "@/components/ui/kinetics"
import { cn } from "@/components/ui/core/styling"
import { NotificationBell } from "./notification-center"

interface TopNavProps {
    title?: string
}

export const AppTopNav = ({ title }: TopNavProps) => {
    const setSidebarOpen = useUIStore(state => state.setSidebarOpen)
    const isFullscreen = useAppStore(state => state.isFullscreen)

    if (isFullscreen) return null

    // Siempre glass, como AppBottomNav: el estado "transparente hasta scrollear"
    // dependía de un #scroll-sentinel que solo existía en el home, así que en el
    // resto de las rutas el contenido pasaba por debajo de un header invisible.
    return (
        <header
            className="md:hidden fixed top-0 left-0 right-0 z-navbar h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-4 flex items-center justify-between border-b border-white/10 backdrop-blur-overlay-2xl bg-surface-container-lowest/80 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.6)]"
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
                    className="p-2.5 rounded-full text-on-surface-variant hover:text-white active:scale-95 transition-[transform,color] duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Buscar"
                >
                    <IconNavigationSearch className="w-5 h-5" />
                </button>

                <NotificationBell compact />

                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="p-2.5 rounded-full text-on-surface-variant hover:text-white active:scale-95 transition-[transform,color] duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Menú principal"
                >
                    <IconNavigationMenu className="w-5 h-5" />
                </button>
            </div>
        </header>
    )
}

const NAV_ITEMS = [
    { to: "/home", label: "Inicio", icon: IconNavigationHome },
    { to: "/series", label: "Series", icon: IconNavigationTv },
    { to: "/movies", label: "Películas", icon: IconNavigationFilm },
    { to: "/admin", label: "Admin", icon: IconUiAdmin },
    { to: "/chronology", label: "Sagas", icon: IconStatusSparkles, iconClass: "text-amber-400" },
] as const

export const AppBottomNav = () => {
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    if (isFullscreen) return null

    return (
        <div className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-3 z-mobile-nav pointer-events-none">
            <nav
                role="navigation"
                aria-label="Navegación móvil"
                className="pointer-events-auto h-14 bg-surface-container-lowest/85 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-full shadow-[shadow:var(--glass-highlight-lg),0_12px_36px_-6px_rgba(0,0,0,0.9)] flex items-stretch gap-0.5 px-1.5 py-1.5"
            >
                {NAV_ITEMS.map((item) => {
                    const isActive = item.to === "/home"
                        ? (pathname === "/home" || pathname === "/")
                        : pathname.startsWith(item.to)
                    const Icon = item.icon

                    return (
                        <MagneticHover key={item.to} scale={1.012} className="relative flex-1 min-w-0">
                            <Link
                                to={item.to}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    // Ícono arriba y texto abajo: los cinco destinos entran en 320px sin salirse de la pantalla.
                                    "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 rounded-full min-h-[44px] select-none cursor-pointer transition-colors duration-150 z-10",
                                    isActive ? "text-black font-bold" : "text-on-surface-variant hover:text-white"
                                )}
                            >
                                {isActive && (
                                    <MagneticIndicator
                                        layoutId="activeMobileBottomNavPill"
                                        className="bg-white/95"
                                    />
                                )}
                                <Icon className={cn("w-4 h-4 relative z-10 shrink-0", "iconClass" in item && item.iconClass)} />
                                <span className="max-w-full truncate text-3xs font-bold uppercase tracking-normal min-[360px]:tracking-wide relative z-10">
                                    {item.label}
                                </span>
                            </Link>
                        </MagneticHover>
                    )
                })}
            </nav>
        </div>
    )
}