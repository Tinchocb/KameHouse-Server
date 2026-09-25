"use client"

import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { m } from "framer-motion"
import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationLayers, IconNavigationSettings, IconNavigationRocket, IconUiAdmin } from "@/components/ui/icons";
import { Shuffle, Volume2, VolumeX } from "lucide-react"
import { useAppStore, usePlayerStore, useUIStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"
import { MagneticIndicator } from "@/components/ui/kinetics"
import { ExpandableSearch } from "./expandable-search"
import { RandomPlayButton } from "./random-play-button"
import { BackgroundMusicPlayer } from "./background-music"
import { persistThemePatch } from "@/lib/server/persist-settings"

interface NavItem {
    id: string
    to: "/home" | "/series" | "/movies" | "/chronology"
    label: string
    icon?: React.ReactNode
}

const NAV_ITEMS: readonly NavItem[] = [
    { id: "home", to: "/home", label: "Inicio", icon: <IconNavigationHome className="w-3.5 h-3.5" /> },
    { id: "series", to: "/series", label: "Series", icon: <IconNavigationTv className="w-3.5 h-3.5" /> },
    { id: "movies", to: "/movies", label: "Películas", icon: <IconNavigationFilm className="w-3.5 h-3.5" /> },
    { id: "chronology", to: "/chronology", label: "Cronología", icon: <IconStatusSparkles className="w-3.5 h-3.5 text-amber-400" /> },
]

export function FloatingPillNav() {
    const { playSound } = useSound()
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const tvMode = useAppStore(state => state.tvMode)

    // Store state & actions
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const globalQueueOpen = useAppStore(state => state.globalQueueOpen)
    const setGlobalQueueOpen = useUIStore(state => state.setGlobalQueueOpen)
    const marathonMode = useAppStore(state => state.marathonMode)
    const setMarathonMode = usePlayerStore(state => state.setMarathonMode)
    const bgMusicEnabled = useAppStore(state => state.bgMusicEnabled)
    const setBgMusicEnabled = useUIStore(state => state.setBgMusicEnabled)
    const uiSoundsEnabled = useAppStore(state => state.uiSoundsEnabled)
    const setUiSoundsEnabled = useUIStore(state => state.setUiSoundsEnabled)

    const routerState = useRouterState()
    const currentPath = routerState.location.pathname.replace(/\/$/, "") || "/"

    if (isFullscreen || tvMode) return null

    const isAudioActive = bgMusicEnabled || uiSoundsEnabled

    const handleToggleMarathon = () => {
        const next = !marathonMode
        setMarathonMode(next)
        playSound("category", 0.4)
        toast(next ? "🚀 Modo Maratón activado" : "Modo Maratón desactivado", {
            description: next ? "Auto-salto de intros y reproducción continua." : "Reproducción estándar restaurada.",
            duration: 2500,
        })
    }

    const handleToggleAudio = () => {
        const next = !isAudioActive
        setBgMusicEnabled(next)
        setUiSoundsEnabled(next)
        persistThemePatch({ bgMusicEnabled: next, uiSoundsEnabled: next })
        if (next) playSound("category", 0.4)
        toast(next ? "🎵 Audio & Música activados" : "🔇 Audio de fondo silenciado", {
            duration: 2000,
        })
    }

    const handleOpenRandom = () => {
        playSound("random", 0.4)
        window.dispatchEvent(new CustomEvent("open-random-picker"))
    }

    return (
        <div aria-label="Navegación flotante de KameHouse" className="select-none pointer-events-none">
            {/* Background Music Engine & Random Play Picker Modal */}
            <BackgroundMusicPlayer headless />
            <div className="pointer-events-auto">
                <RandomPlayButton modalOnly />
            </div>
            
            {/* ─── ISLAS FLOTANTES DE NAVEGACIÓN ─────────────────────────── */}
            {/* ─── ISLA IZQUIERDA: LOGO FLOTANTE (GLASSMORFISMO) ──────────── */}
            <m.aside
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed top-3.5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                <Link
                    to="/home"
                    onClick={() => playSound("category", 0.3)}
                    title="Ir a Inicio"
                    className={cn(
                        "flex items-center gap-2.5 bg-surface-container-lowest/80 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-4 py-1.5 rounded-full shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)] hover:bg-surface-container-high/80 hover:border-white/30 active:scale-95 group cursor-pointer",
                        "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]"
                    )}
                >
                    <img
                        src="/kamehouse-logo.png"
                        alt="KameHouse"
                        className="w-5 h-5 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                    />
                    {/* Entre md y lg no entra todo en una fila: el logo queda sin texto */}
                    <span className="sr-only lg:not-sr-only font-display font-black tracking-widest text-xs uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        KAMEHOUSE
                    </span>
                </Link>
            </m.aside>

            {/* ─── ISLA CENTRAL: NAVEGACIÓN PRINCIPAL (GLASSMORFISMO) ──────── */}
            <div className="fixed top-3.5 left-0 right-0 z-navbar hidden md:flex justify-center items-center pointer-events-none">
                <m.aside
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="pointer-events-auto transform-gpu"
                >
                    <nav
                        role="navigation"
                        aria-label="Navegación principal"
                        className="flex items-center gap-1 bg-surface-container-lowest/80 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl p-1.5 rounded-full shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)]"
                    >
                        {NAV_ITEMS.map((item) => {
                            const isRouteActive = currentPath === item.to || (item.to !== "/home" && currentPath.startsWith(item.to))
                            const isPillActive = !globalQueueOpen && isRouteActive

                            return (
                                <Link
                                    key={item.id}
                                    to={item.to}
                                    aria-current={isPillActive ? "page" : undefined}
                                    title={item.label}
                                    onClick={() => playSound("category", 0.3)}
                                    className={cn(
                                        "relative px-3 lg:px-4 py-1.5 min-h-[36px] lg:min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 cursor-pointer select-none",
                                        isPillActive ? "text-black font-bold" : "text-on-surface-variant hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {isPillActive && (
                                        <MagneticIndicator
                                            layoutId="pill-nav-active"
                                            className="bg-white/95 rounded-full"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        {item.icon}
                                        {/* Entre md y lg, solo ícono (el texto queda para lectores de pantalla) */}
                                        <span className="sr-only lg:not-sr-only">{item.label}</span>
                                    </span>
                                </Link>
                            )
                        })}

                        {/* Mi Lista / Cola */}
                        <button
                            type="button"
                            onClick={() => {
                                setGlobalQueueOpen(!globalQueueOpen)
                                playSound("category", 0.3)
                            }}
                            aria-label="Ver cola de reproducción"
                            aria-pressed={globalQueueOpen}
                            title="Mi Lista / Cola"
                            className={cn(
                                "relative px-3 lg:px-4 py-1.5 min-h-[36px] lg:min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 cursor-pointer select-none",
                                globalQueueOpen ? "text-black font-bold" : "text-on-surface-variant hover:text-white hover:bg-white/10"
                            )}
                        >
                            {globalQueueOpen && (
                                <MagneticIndicator
                                    layoutId="pill-nav-active"
                                    className="bg-white/95 rounded-full"
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                                <IconNavigationLayers className="w-3.5 h-3.5" />
                                <span className="sr-only lg:not-sr-only">Mi Lista</span>
                                {playlistQueue.length > 0 && (
                                    <span className={cn(
                                        "text-3xs font-black px-1.5 py-px rounded-full min-w-[17px] text-center shadow-sm",
                                        globalQueueOpen ? "bg-black text-white" : "bg-brand-accent text-on-primary"
                                    )}>
                                        {playlistQueue.length}
                                    </span>
                                )}
                            </span>
                        </button>
                    </nav>
                </m.aside>
            </div>

            {/* ─── ISLA DERECHA: BUSCADOR Y CONFIGURACIÓN (GLASSMORFISMO) ── */}
            <m.aside
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed top-3.5 right-4 sm:right-6 md:right-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                <div className="flex items-center gap-1 bg-surface-container-lowest/80 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-2 py-1.5 rounded-full shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)]">
                    {/* Buscador expandible */}
                    <ExpandableSearch />

                    {/* Admin */}
                    <Link
                        to="/admin"
                        onClick={() => playSound("category", 0.3)}
                        aria-label="Panel de Administración"
                        aria-current={currentPath.startsWith("/admin") ? "page" : undefined}
                        title="Administración"
                        className={cn(
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-90",
                            "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                            currentPath.startsWith("/admin")
                                ? "bg-white/95 text-black font-bold"
                                : "text-on-surface-variant hover:text-white hover:bg-white/10"
                        )}
                    >
                        <IconUiAdmin className="w-3.5 h-3.5" />
                    </Link>

                    {/* Configuración */}
                    <Link
                        to="/settings"
                        onClick={() => playSound("category", 0.3)}
                        aria-label="Configuración"
                        aria-current={currentPath.startsWith("/settings") ? "page" : undefined}
                        title="Configuración"
                        className={cn(
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-90",
                            "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                            currentPath.startsWith("/settings")
                                ? "bg-white/95 text-black font-bold"
                                : "text-on-surface-variant hover:text-white hover:bg-white/10"
                        )}
                    >
                        <IconNavigationSettings className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </m.aside>

            {/* ─── ISLA FLOTANTE INFERIOR IZQUIERDA: ACCIONES Y UTILIDADES RÁPIDAS (SOLO ENTORNO DEV) ── */}
            {import.meta.env.DEV && (
                <m.aside
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed bottom-5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
                >
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-2.5 py-1.5 rounded-full shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)]">
                        {/* Modo Maratón */}
                        <button
                            type="button"
                            onClick={handleToggleMarathon}
                            aria-label={marathonMode ? "Desactivar Maratón" : "Activar Maratón"}
                            aria-pressed={marathonMode}
                            title={marathonMode ? "Modo Maratón: Activado (Auto-skip)" : "Modo Maratón: Desactivado"}
                            className={cn(
                                "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-90",
                                "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                                marathonMode 
                                    ? "bg-brand-accent/25 text-brand-accent border border-brand-accent/40" 
                                    : "text-on-surface-variant hover:text-white hover:bg-white/10"
                            )}
                        >
                            <IconNavigationRocket className="w-4 h-4" />
                        </button>

                        {/* Reproducción Aleatoria / Modo TV */}
                        <button
                            type="button"
                            onClick={handleOpenRandom}
                            aria-label="Reproducción Aleatoria (Modo TV)"
                            title="Reproducción Aleatoria / Modo TV"
                            className={cn(
                                "p-2 rounded-full text-xs text-on-surface-variant hover:text-white hover:bg-white/10 active:scale-90 flex items-center justify-center cursor-pointer",
                                "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]"
                            )}
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>

                        {/* Música de Fondo */}
                        <button
                            type="button"
                            onClick={handleToggleAudio}
                            aria-label={isAudioActive ? "Silenciar Música" : "Activar Música de Fondo"}
                            aria-pressed={isAudioActive}
                            title={isAudioActive ? "Música de fondo: Encendida" : "Música de fondo: Silenciada"}
                            className={cn(
                                "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-90",
                                "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                                isAudioActive 
                                    ? "text-brand-secondary bg-brand-secondary/15 border border-brand-secondary/30" 
                                    : "text-on-surface-variant/80 hover:text-white hover:bg-white/10"
                            )}
                        >
                            {isAudioActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                    </div>
                </m.aside>
            )}
        </div>
    )
}
