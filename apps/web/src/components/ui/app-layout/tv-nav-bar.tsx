"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import { Home, Tv, Film, Settings } from "lucide-react"
import { cn } from "../core/styling"

const TV_NAV_ITEMS = [
    { to: "/home",     label: "Inicio",     Icon: Home },
    { to: "/series",   label: "Series",     Icon: Tv },
    { to: "/movies",   label: "Películas",  Icon: Film },
    { to: "/settings", label: "Ajustes",    Icon: Settings },
]

export function TvNavBar() {
    const { location } = useRouterState()

    return (
        <nav className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-3 px-8 py-4 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/[0.08]">
            {TV_NAV_ITEMS.map(({ to, label, Icon }) => {
                const isActive = location.pathname === to || location.pathname.startsWith(to + "/")
                return (
                    <Link
                        key={to}
                        to={to}
                        className={cn(
                            "flex flex-col items-center gap-1.5 px-10 py-3 rounded-2xl transition-all duration-150",
                            "focus:outline-none focus-visible:outline-none",
                            "tv-focusable",
                            isActive
                                ? "bg-[#f97316]/15 text-[#f97316]"
                                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                        )}
                    >
                        <Icon className="w-6 h-6 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">{label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
