"use client"

import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationLayers, IconNavigationSettings, IconNavigationRocket } from "@/components/ui/icons";
import { Shuffle, Volume2, VolumeX } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"
import { ExpandableSearch } from "./expandable-search"
import { RandomPlayButton } from "./random-play-button"
import { BackgroundMusicPlayer } from "./background-music"

interface NavItem {
    id: string
    to: "/home" | "/series" | "/movies"
    label: string
    icon?: React.ReactNode
}

const NAV_ITEMS: readonly NavItem[] = [
    { id: "home", to: "/home", label: "Inicio", icon: <IconNavigationHome className="w-3.5 h-3.5" /> },
    { id: "series", to: "/series", label: "Series", icon: <IconNavigationTv className="w-3.5 h-3.5" /> },
    { id: "movies", to: "/movies", label: "Películas", icon: <IconNavigationFilm className="w-3.5 h-3.5" /> },
]

export function FloatingPillNav() {
    const { playSound } = useSound()
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const tvMode = useAppStore(state => state.tvMode)

    // Store state & actions
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const globalQueueOpen = useAppStore(state => state.globalQueueOpen)
    const setGlobalQueueOpen = useAppStore(state => state.setGlobalQueueOpen)
    const marathonMode = useAppStore(state => state.marathonMode)
    const setMarathonMode = useAppStore(state => state.setMarathonMode)
    const bgMusicEnabled = useAppStore(state => state.bgMusicEnabled)
    const setBgMusicEnabled = useAppStore(state => state.setBgMusicEnabled)
    const uiSoundsEnabled = useAppStore(state => state.uiSoundsEnabled)
    const setUiSoundsEnabled = useAppStore(state => state.setUiSoundsEnabled)
    const chronologyOpen = useAppStore(state => state.chronologyOpen)
    const setChronologyOpen = useAppStore(state => state.setChronologyOpen)

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
        <div aria-label="Navegación Cinejoy flotante" className="select-none pointer-events-none">
            {/* Background Music Engine & Random Play Picker Modal */}
            <BackgroundMusicPlayer headless />
            <div className="pointer-events-auto">
                <RandomPlayButton modalOnly />
            </div>
            
            {/* ─── ISLAS FLOTANTES DE NAVEGACIÓN ─────────────────────────── */}
            {/* ─── ISLA IZQUIERDA: LOGO FLOTANTE (GLASSMORFISMO) ──────────── */}
            <motion.aside
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed top-3.5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                            <Link
                                to="/home"
                                onClick={() => playSound("category", 0.3)}
                                title="Ir a Inicio"
                                className="flex items-center gap-2.5 bg-zinc-950/65 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-md px-4 py-1.5 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_-4px_rgba(0,0,0,0.7)] hover:bg-zinc-900/65 hover:border-white/30 active:scale-95 transition-all duration-200 group cursor-pointer"
                            >
                                <img
                                    src="/kamehouse-logo.png"
                                    alt="KameHouse"
                                    className="w-5 h-5 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                                />
                                <span className="font-display font-black tracking-widest text-xs uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                    KAMEHOUSE
                                </span>
                            </Link>
                        </motion.aside>

                        {/* ─── ISLA CENTRAL: NAVEGACIÓN PRINCIPAL (GLASSMORFISMO) ──────── */}
                        <div className="fixed top-3.5 left-0 right-0 z-navbar hidden md:flex justify-center items-center pointer-events-none">
                            <motion.aside
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className="pointer-events-auto transform-gpu"
                            >
                                <nav className="flex items-center gap-1 bg-zinc-950/65 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-md p-1.5 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_-4px_rgba(0,0,0,0.7)]">
                                    {NAV_ITEMS.map((item) => {
                                        const isRouteActive = currentPath === item.to || (item.to !== "/home" && currentPath.startsWith(item.to))
                                        const isPillActive = !globalQueueOpen && !chronologyOpen && isRouteActive

                                        return (
                                            <Link
                                                key={item.id}
                                                to={item.to}
                                                onClick={() => playSound("category", 0.3)}
                                                className={cn(
                                                    "relative px-4 py-1.5 min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 cursor-pointer select-none",
                                                    isPillActive ? "text-zinc-950 font-bold" : "text-zinc-300 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {isPillActive && (
                                                    <motion.div
                                                        layoutId="pill-nav-active"
                                                        transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                                        className="absolute inset-0 bg-white/95 backdrop-blur-overlay-md rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)] -z-0"
                                                    />
                                                )}
                                                <span className="relative z-10 flex items-center gap-1.5">
                                                    {item.icon}
                                                    <span>{item.label}</span>
                                                </span>
                                            </Link>
                                        )
                                    })}

                                    {/* Cronología Canónica */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setChronologyOpen(true)
                                            playSound("category", 0.3)
                                        }}
                                        aria-label="Ver Cronología Canónica"
                                        title="Cronología Dragon Ball"
                                        className={cn(
                                            "relative px-4 py-1.5 min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 cursor-pointer select-none",
                                            (!globalQueueOpen && chronologyOpen) ? "text-zinc-950 font-bold" : "text-zinc-300 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {(!globalQueueOpen && chronologyOpen) && (
                                            <motion.div
                                                layoutId="pill-nav-active"
                                                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                                className="absolute inset-0 bg-white/95 backdrop-blur-overlay-md rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)] -z-0"
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-1.5">
                                            <IconStatusSparkles className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Cronología</span>
                                        </span>
                                    </button>

                                    {/* Mi Lista / Cola */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setGlobalQueueOpen(!globalQueueOpen)
                                            playSound("category", 0.3)
                                        }}
                                        aria-label="Ver cola de reproducción"
                                        title="Mi Lista / Cola"
                                        className={cn(
                                            "relative px-4 py-1.5 min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 cursor-pointer select-none",
                                            globalQueueOpen ? "text-zinc-950 font-bold" : "text-zinc-300 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {globalQueueOpen && (
                                            <motion.div
                                                layoutId="pill-nav-active"
                                                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                                className="absolute inset-0 bg-white/95 backdrop-blur-overlay-md rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)] -z-0"
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-1.5">
                                            <IconNavigationLayers className="w-3.5 h-3.5" />
                                            <span>Mi Lista</span>
                                            {playlistQueue.length > 0 && (
                                                <span className={cn(
                                                    "text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-sm",
                                                    globalQueueOpen ? "bg-zinc-950 text-white" : "bg-brand-accent text-on-primary"
                                                )}>
                                                    {playlistQueue.length}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </nav>
                            </motion.aside>
                        </div>

                {/* ─── ISLA DERECHA: BUSCADOR Y CONFIGURACIÓN (GLASSMORFISMO) ── */}
                <motion.aside
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed top-3.5 right-4 sm:right-6 md:right-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
                >
                    <div className="flex items-center gap-1 bg-zinc-950/65 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-md px-2 py-1.5 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_-4px_rgba(0,0,0,0.7)]">
                        {/* Buscador expandible */}
                        <ExpandableSearch />

                        {/* Configuración */}
                        <Link
                            to="/settings"
                            onClick={() => playSound("category", 0.3)}
                            aria-label="Configuración"
                            title="Configuración"
                            className={cn(
                                "p-2 rounded-full text-xs transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-90",
                                currentPath.startsWith("/settings")
                                    ? "bg-white/95 text-zinc-950 font-bold shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]"
                                    : "text-zinc-300 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <IconNavigationSettings className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </motion.aside>

                {/* ─── ISLA FLOTANTE INFERIOR IZQUIERDA: ACCIONES Y UTILIDADES RÁPIDAS ── */}
                <motion.aside
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed bottom-5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
                >
                    <div className="flex items-center gap-1.5 bg-zinc-950/65 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-md px-2.5 py-1.5 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_-4px_rgba(0,0,0,0.7)]">
                        {/* Modo Maratón */}
                        <button
                            type="button"
                            onClick={handleToggleMarathon}
                            aria-label={marathonMode ? "Desactivar Maratón" : "Activar Maratón"}
                            title={marathonMode ? "Modo Maratón: Activado (Auto-skip)" : "Modo Maratón: Desactivado"}
                            className={cn(
                                "p-2 rounded-full text-xs transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-90",
                                marathonMode 
                                    ? "bg-brand-accent/25 text-brand-accent border border-brand-accent/40 shadow-[0_0_14px_hsl(var(--brand-accent)/0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]" 
                                    : "text-zinc-300 hover:text-white hover:bg-white/10"
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
                            className="p-2 rounded-full text-xs text-zinc-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-200 flex items-center justify-center cursor-pointer"
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>

                        {/* Música de Fondo */}
                        <button
                            type="button"
                            onClick={handleToggleAudio}
                            aria-label={isAudioActive ? "Silenciar Música" : "Activar Música de Fondo"}
                            title={isAudioActive ? "Música de fondo: Encendida" : "Música de fondo: Silenciada"}
                            className={cn(
                                "p-2 rounded-full text-xs transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-90",
                                isAudioActive 
                                    ? "text-brand-secondary bg-brand-secondary/15 border border-brand-secondary/30 shadow-[0_0_12px_hsl(var(--brand-secondary)/0.25)]" 
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
                            )}
                        >
                            {isAudioActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                    </div>
                </motion.aside>
        </div>
    )
}
