"use client"

import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { m } from "framer-motion"
import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationLayers, IconNavigationSettings, IconNavigationRocket, IconUiAdmin } from "@/components/ui/icons";
import { IconMediaRandom, IconMediaVolume2, IconMediaVolumeX } from "@/components/ui/icons"
import { useAppStore, usePlayerStore, useUIStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"
import { MagneticIndicator, ElasticCounter, IconSwap } from "@/components/ui/kinetics"
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
    { id: "chronology", to: "/chronology", label: "Cronología", icon: <IconStatusSparkles className="w-3.5 h-3.5" /> },
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

    // Pestaña presionada: el indicador se mueve al presionar (pointerdown), no
    // al terminar de renderizar la página nueva. Antes quedaba ~300 ms en la
    // pestaña vieja porque el render de la ruta trababa la animación (medido
    // cuadro a cuadro). Guarda desde qué ruta se presionó: al navegar se
    // descarta solo, y si se cancela (arrastrar fuera) vuelve a su lugar.
    const [pressed, setPressed] = React.useState<{ to: string; from: string } | null>(null)
    const activePath = pressed && pressed.from === currentPath ? pressed.to : currentPath

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
        <div role="region" aria-label="Navegación flotante" className="select-none pointer-events-none">
            {/* Background Music Engine & Random Play Picker Modal */}
            <BackgroundMusicPlayer headless />
            <div className="pointer-events-auto">
                <RandomPlayButton modalOnly />
            </div>
            
            {/* ─── ISLAS FLOTANTES DE NAVEGACIÓN ─────────────────────────── */}
            {/* ─── ISLA IZQUIERDA: LOGO FLOTANTE (GLASSMORFISMO) ──────────── */}
            <m.div
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
                        "glass-frosted-pill flex items-center gap-2.5 px-4 py-1.5 hover:border-white/30 active:scale-95 group cursor-pointer",
                        "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]"
                    )}
                >
                    <img
                        src="/kamehouse-logo.png"
                        alt=""
                        className="relative z-10 w-5 h-5 object-contain [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-fast ease-out-strong drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                    />
                    {/* Entre md y lg no entra todo en una fila: el logo queda sin texto */}
                    <span className="relative z-10 sr-only lg:not-sr-only font-display font-black tracking-widest text-xs uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        KAMEHOUSE
                    </span>
                </Link>
            </m.div>

            {/* ─── ISLA CENTRAL: NAVEGACIÓN PRINCIPAL (GLASSMORFISMO) ──────── */}
            <div className="fixed top-3.5 left-0 right-0 z-navbar hidden md:flex justify-center items-center pointer-events-none">
                <m.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="pointer-events-auto transform-gpu"
                >
                    <nav
                        role="navigation"
                        aria-label="Navegación principal"
                        className="glass-frosted-pill flex items-center gap-1 p-1.5"
                    >
                        {NAV_ITEMS.map((item) => {
                            const isRouteActive = activePath === item.to || (item.to !== "/home" && activePath.startsWith(item.to))
                            const isPillActive = !globalQueueOpen && isRouteActive

                            return (
                                <Link
                                    key={item.id}
                                    to={item.to}
                                    aria-current={isPillActive ? "page" : undefined}
                                    title={item.label}
                                    onClick={() => playSound("category", 0.3)}
                                    onPointerDown={(e) => {
                                        if (e.button === 0 && !globalQueueOpen) setPressed({ to: item.to, from: currentPath })
                                    }}
                                    onPointerCancel={() => setPressed(null)}
                                    onPointerLeave={() => setPressed((p) => (p?.to === item.to ? null : p))}
                                    className={cn(
                                        "relative px-3 lg:px-4 py-1.5 min-h-[36px] lg:min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-[color,background-color,transform] duration-fast ease-out-strong active:scale-95 flex items-center gap-1.5 cursor-pointer select-none",
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
                                "relative px-3 lg:px-4 py-1.5 min-h-[36px] lg:min-w-[104px] justify-center rounded-full text-xs font-semibold tracking-wide transition-[color,background-color,transform] duration-fast ease-out-strong active:scale-95 flex items-center gap-1.5 cursor-pointer select-none",
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
                                        "text-3xs font-black font-mono tabular-nums px-1.5 py-px rounded-full min-w-[17px] inline-flex items-center justify-center text-center shadow-sm",
                                        globalQueueOpen ? "bg-black text-white" : "bg-brand-accent text-on-primary"
                                    )}>
                                        <ElasticCounter value={playlistQueue.length} />
                                    </span>
                                )}
                            </span>
                        </button>
                    </nav>
                </m.div>
            </div>

            {/* ─── ISLA DERECHA: BUSCADOR Y CONFIGURACIÓN (GLASSMORFISMO) ── */}
            <m.div role="group" aria-label="Búsqueda y ajustes"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed top-3.5 right-4 sm:right-6 md:right-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                <div className="glass-frosted-pill flex items-center gap-1 px-2 py-1.5">
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
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
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
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
                            "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                            currentPath.startsWith("/settings")
                                ? "bg-white/95 text-black font-bold"
                                : "text-on-surface-variant hover:text-white hover:bg-white/10"
                        )}
                    >
                        <IconNavigationSettings className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </m.div>

            {/* ─── ISLA FLOTANTE INFERIOR IZQUIERDA: MARATÓN, ALEATORIO Y MÚSICA ─────────────── */}
            <m.div role="group" aria-label="Acciones rápidas"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed bottom-5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                <div className="glass-frosted-pill flex items-center gap-1.5 px-2.5 py-1.5">
                    {/* Modo Maratón */}
                    <button
                        type="button"
                        onClick={handleToggleMarathon}
                        aria-label={marathonMode ? "Desactivar Maratón" : "Activar Maratón"}
                        aria-pressed={marathonMode}
                        title={marathonMode ? "Modo Maratón: Activado (Auto-skip)" : "Modo Maratón: Desactivado"}
                        className={cn(
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
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
                            "p-2 rounded-full text-xs text-on-surface-variant hover:text-white hover:bg-white/10 active:scale-95 flex items-center justify-center cursor-pointer",
                            "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]"
                        )}
                    >
                        <IconMediaRandom className="w-4 h-4" />
                    </button>

                    {/* Música de Fondo */}
                    <button
                        type="button"
                        onClick={handleToggleAudio}
                        aria-label={isAudioActive ? "Silenciar Música" : "Activar Música de Fondo"}
                        aria-pressed={isAudioActive}
                        title={isAudioActive ? "Música de fondo: Encendida" : "Música de fondo: Silenciada"}
                        className={cn(
                            "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
                            "[transition:background-color_var(--duration-fast)_var(--ease-smooth-out),border-color_var(--duration-fast)_var(--ease-smooth-out),color_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out),scale_var(--duration-fast)_var(--ease-smooth-out)]",
                            isAudioActive 
                                ? "text-brand-secondary bg-brand-secondary/15 border border-brand-secondary/30" 
                                : "text-on-surface-variant/80 hover:text-white hover:bg-white/10"
                        )}
                    >
                        <IconSwap swapKey={isAudioActive ? "active" : "muted"}>
                            {isAudioActive ? <IconMediaVolume2 className="w-4 h-4" /> : <IconMediaVolumeX className="w-4 h-4" />}
                        </IconSwap>
                    </button>
                </div>
            </m.div>
        </div>
    )
}
