import * as React from "react"
import { useAppStore } from "@/lib/store"
import { Link, useRouterState } from "@tanstack/react-router"
import { IconNavigationSearch, IconNavigationMenu, IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationSettings } from "@/components/ui/icons"
import { m } from "framer-motion"
import { MagneticIndicator, MagneticHover } from "@/components/ui/kinetics"
import { NavLabel, useNavTransition } from "./nav-label"
import { useMinWidth, useNavCompact } from "./use-nav-compact"
import { cn } from "@/components/ui/core/styling"
import { MobileMenuSheet } from "./mobile-menu-sheet"

interface TopNavProps {
    title?: string
}

/** Encabezado móvil (`md:hidden`): en escritorio no se monta (ver AppBottomNav). */
export const AppTopNav = ({ title }: TopNavProps) => {
    const isMobileLayout = !useMinWidth(768)
    return isMobileLayout ? <AppTopNavInner title={title} /> : null
}

const AppTopNavInner = ({ title }: TopNavProps) => {
    const [menuOpen, setMenuOpen] = React.useState(false)
    const isFullscreen = useAppStore(state => state.isFullscreen)

    if (isFullscreen) return null

    // Siempre glass, como AppBottomNav: el estado "transparente hasta scrollear"
    // dependía de un #scroll-sentinel que solo existía en el home, así que en el
    // resto de las rutas el contenido pasaba por debajo de un header invisible.
    // Vidrio canónico (.glass-frosted): la saturación sigue al tema (Clásico, Flat) y la sombra es la del token.
    // rounded-none: la barra va de borde a borde, sin las esquinas redondeadas del vidrio.
    return (
        <header
            className="md:hidden fixed top-0 left-0 right-0 z-navbar h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-4 flex items-center justify-between glass-frosted rounded-none border-x-0 border-t-0 border-b border-[var(--glass-border-side)]"
        >
            {/* min-w-0 + truncate: sin esto un título largo empuja los botones fuera de la pantalla */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                    src="/kamehouse-logo.png"
                    alt=""
                    className="h-7 w-7 object-contain shrink-0"
                />
                <span className="font-display text-lg text-on-surface tracking-wider uppercase truncate">
                    {title || "KAMEHOUSE"}
                </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                    className="p-2.5 rounded-full text-on-surface-variant hover:text-on-surface active:scale-95 transition-[transform,color] duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Buscar"
                >
                    <IconNavigationSearch className="w-5 h-5" />
                </button>

                <button 
                    onClick={() => setMenuOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                    className="p-2.5 rounded-full text-on-surface-variant hover:text-on-surface active:scale-95 transition-[transform,color] duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Menú principal"
                >
                    <IconNavigationMenu className="w-5 h-5" />
                </button>
            </div>
            <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
        </header>
    )
}

const NAV_ITEMS = [
    { to: "/home", label: "Inicio", icon: IconNavigationHome },
    { to: "/series", label: "Series", icon: IconNavigationTv },
    { to: "/movies", label: "Películas", icon: IconNavigationFilm },
    { to: "/chronology", label: "Cronología", icon: IconStatusSparkles },
    { to: "/settings", label: "Ajustes", icon: IconNavigationSettings },
] as const

/**
 * Las barras móviles son `md:hidden`: en escritorio no se ven, pero montadas igual se
 * re-renderizaban en cada navegación (NavLabel + AnimatePresence + nodos `layout` de
 * framer-motion medidos uno por uno: ~40 ms en dev dentro del cuadro del click).
 * Con el mismo corte que `md` (768 px) directamente no se montan.
 */
export const AppBottomNav = () => {
    const isMobileLayout = !useMinWidth(768)
    return isMobileLayout ? <AppBottomNavInner /> : null
}

const AppBottomNavInner = () => {
    const isFullscreen = useAppStore(state => state.isFullscreen)
    // Al bajar la página las pestañas inactivas quedan solo con ícono; la activa conserva su texto.
    const { compact, handlers: engageHandlers } = useNavCompact()
    const layoutTransition = useNavTransition()
    const currentPath = useRouterState({ select: (s) => s.location.pathname })
    // Igual que en la barra de escritorio: el indicador se mueve al tocar
    // (pointerdown), no cuando termina de renderizar la página nueva.
    const [pressed, setPressed] = React.useState<{ to: string; from: string } | null>(null)
    // Se descarta al cambiar la ruta: si no, volver atrás al origen reactivaba el destino viejo.
    const [lastPath, setLastPath] = React.useState(currentPath)
    if (lastPath !== currentPath) {
        setLastPath(currentPath)
        setPressed(null)
    }
    const pathname = pressed && pressed.from === currentPath ? pressed.to : currentPath

    if (isFullscreen) return null

    return (
        <div className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-3 z-mobile-nav pointer-events-none">
            <nav
                role="navigation"
                aria-label="Navegación móvil"
                className="glass-frosted-pill pointer-events-auto h-14 flex items-stretch gap-0.5 px-1.5 py-1.5"
                {...engageHandlers}
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
                                aria-label={item.label}
                                onPointerDown={(e) => {
                                    if (e.button === 0) setPressed({ to: item.to, from: currentPath })
                                }}
                                onPointerCancel={() => setPressed(null)}
                                onPointerLeave={() => setPressed((p) => (p?.to === item.to ? null : p))}
                                className={cn(
                                    // Ícono arriba y texto abajo: los cinco destinos entran en 320px sin salirse de la pantalla.
                                    "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-0 rounded-full min-h-[44px] select-none cursor-pointer transition-colors duration-150 z-10",
                                    isActive ? "text-black font-bold" : "text-on-surface-variant hover:text-on-surface"
                                )}
                            >
                                {/* Radio en style: framer solo lo corrige durante el morph de layoutId si llega por style. */}
                                {isActive && (
                                    <MagneticIndicator
                                        layoutId="activeMobileBottomNavPill"
                                        className="bg-white/95"
                                        style={{ borderRadius: 9999 }}
                                    />
                                )}
                                <m.span layout="position" layoutDependency={`${pathname}|${compact}`} transition={layoutTransition} className="relative z-10 flex">
                                    <Icon className="w-4 h-4 shrink-0" />
                                </m.span>
                                <NavLabel
                                    axis="y"
                                    show={!compact || isActive}
                                    className="max-w-full text-3xs max-[359px]:text-4xs font-semibold relative z-10"
                                >
                                    {item.label}
                                </NavLabel>
                            </Link>
                        </MagneticHover>
                    )
                })}
            </nav>
        </div>
    )
}