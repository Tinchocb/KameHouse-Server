import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconNavigationSettings, IconUiClose, IconStatusSparkles, IconUiAdmin } from "@/components/ui/icons";
import { usePlayerStore } from "@/lib/store"

import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "../core/styling"

const TV_NAV_ITEMS = [
    { to: "/home", label: "Inicio", Icon: IconNavigationHome },
    { to: "/series", label: "Series", Icon: IconNavigationTv },
    { to: "/movies", label: "Películas", Icon: IconNavigationFilm },
    { to: "/chronology/", label: "Cronología", Icon: IconStatusSparkles },
    { to: "/admin", label: "Admin", Icon: IconUiAdmin },
    { to: "/settings", label: "Ajustes", Icon: IconNavigationSettings },
]

export function TvNavBar() {
    const { location } = useRouterState()

    return (
        <nav
            className={cn(
                "fixed bottom-4 inset-x-6 sm:inset-x-12 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-50",
                "flex items-center justify-center gap-2 px-6 py-3 rounded-full",
                "bg-surface/85 backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
                "border border-white/20 border-t-white/40 border-b-white/10",
                "shadow-[shadow:var(--glass-highlight-lg),0_16px_40px_-6px_rgba(0,0,0,0.9)]"
            )}
        >
            {TV_NAV_ITEMS.map(({ to, label, Icon }) => {
                const isActive = location.pathname === to || location.pathname.startsWith(to + "/")
                return (
                    <Link
                        key={to}
                        to={to}
                        className={cn(
                            "flex flex-col items-center gap-1 px-7 py-2.5 rounded-full transition-all duration-200",
                            "focus:outline-none focus-visible:outline-none",
                            "tv-focusable",
                            isActive
                                ? "bg-white text-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.5)] font-black"
                                : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.08]"
                        )}
                    >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-2xs font-bold uppercase tracking-widest whitespace-nowrap">{label}</span>
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
                    "flex flex-col items-center gap-1 px-7 py-2.5 rounded-full transition-all duration-200 cursor-pointer",
                    "text-on-surface-variant hover:text-brand-destructive hover:bg-brand-destructive/15 active:scale-95",
                    "focus:outline-none focus-visible:outline-none tv-focusable"
                )}
                title="Salir de Modo TV (Volver al modo normal)"
            >
                <IconUiClose className="w-5 h-5 shrink-0" />
                <span className="text-2xs font-bold uppercase tracking-widest whitespace-nowrap">Salir</span>
            </button>
        </nav>
    )
}