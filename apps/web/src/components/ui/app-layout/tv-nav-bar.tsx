import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconNavigationSettings, IconUiClose, IconStatusSparkles } from "@/components/ui/icons";
import { usePlayerStore } from "@/lib/store"

import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "../core/styling"

const TV_NAV_ITEMS = [
    { to: "/home", label: "Inicio", Icon: IconNavigationHome },
    { to: "/series", label: "Series", Icon: IconNavigationTv },
    { to: "/movies", label: "Películas", Icon: IconNavigationFilm },
    { to: "/chronology", label: "Cronología", Icon: IconStatusSparkles },
    { to: "/settings", label: "Ajustes", Icon: IconNavigationSettings },
]

export function TvNavBar() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const normalizedPathname = pathname.replace(/\/+$/, "") || "/"

    return (
        <nav
            aria-label="Navegación del modo TV"
            className={cn(
                "glass-frosted-pill fixed bottom-4 inset-x-6 sm:inset-x-12 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-50",
                "flex items-center justify-center gap-2 px-6 py-3"
            )}
        >
            {TV_NAV_ITEMS.map(({ to, label, Icon }) => {
                const isActive = normalizedPathname === to || normalizedPathname.startsWith(to + "/")
                return (
                    <Link
                        key={to}
                        to={to}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            "flex flex-col items-center gap-1 px-7 py-2.5 rounded-full transition-[color,background-color,transform] duration-quick ease-smooth-out active:scale-95",
                            "focus:outline-none focus-visible:outline-none",
                            "tv-focusable",
                            isActive
                                ? "bg-white text-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.5)] font-black"
                                : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.08]"
                        )}
                    >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
                    </Link>
                )
            })}

            {/* Botón para salir del modo TV y volver al modo normal */}
            <button
                type="button"
                onClick={() => {
                    usePlayerStore.setState({ tvMode: false })
                }}
                className={cn(
                    "flex flex-col items-center gap-1 px-7 py-2.5 rounded-full transition-[color,background-color,transform] duration-quick ease-smooth-out cursor-pointer",
                    "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-brand-destructive [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-destructive/15 active:scale-95",
                    "focus:outline-none focus-visible:outline-none tv-focusable"
                )}
                title="Salir del modo TV"
            >
                <IconUiClose className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">Salir</span>
            </button>
        </nav>
    )
}
