"use client"

import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { AnimatePresence, m } from "framer-motion"
import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationLayers, IconNavigationSettings, IconNavigationRocket } from "@/components/ui/icons";
import { IconMediaRandom, IconMediaVolume2, IconMediaVolumeX } from "@/components/ui/icons"
import { useAppStore, usePlayerStore, useUIStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { toast } from "sonner"
import { MagneticIndicator, ElasticCounter, IconSwap, useSpringPreset } from "@/components/ui/kinetics"
import { ExpandableSearch } from "./expandable-search"
import { RandomPlayButton } from "./random-play-button"
import { BackgroundMusicPlayer } from "./background-music"
import { persistThemePatch } from "@/lib/server/persist-settings"
import { NavLabel, NavTooltip, useNavTransition } from "./nav-label"
import { useMinWidth, useNavCompact } from "./use-nav-compact"

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

/**
 * Un destino de la barra central. `group relative` para el tooltip de solo CSS;
 * 36 px de alto con puntero fino, 44 px con puntero grueso (táctil en tablet).
 */
const NAV_ITEM_CLASS = cn(
    "group relative px-3 lg:px-4 py-1.5 min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] min-w-[36px] justify-center rounded-full text-xs font-semibold tracking-wide transition-[color,background-color,transform] duration-quick ease-out-strong active:scale-95 flex items-center gap-1.5 cursor-pointer select-none",
)

/** Salida de la isla inferior: 150 ms (--duration-quick) con aceleración, como los demás cierres de la app. */
const SALIDA_ISLA_INFERIOR = { duration: 0.15, ease: [0.4, 0, 1, 1] } as const

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

    // Solo íconos: al bajar la página (con histéresis), por preferencia, o por ancho
    // (entre md y lg no entran las etiquetas). Se abre con el puntero o el foco de teclado.
    const { compact, handlers: engageHandlers } = useNavCompact()
    const isWide = useMinWidth(1024)
    const showLabels = isWide && !compact
    // La marca (KAMEHOUSE) se compacta con la misma señal que la barra central.
    const showBrandText = showLabels
    const layoutTransition = useNavTransition()
    // Entrada de la isla inferior: preset canónico (con reduced motion degrada a tween). Va antes del `return null` de abajo.
    const islaInferiorSpring = useSpringPreset("entrance")
    // Islas superiores (marca, centro y ajustes): preset "island", antes escrito a mano en cada una. También va antes del return null.
    const islasSuperioresSpring = useSpringPreset("island")

    // Solo la ruta: con el estado completo del router la barra se re-renderizaba con cada filtro,
    // orden o búsqueda de las páginas (25 ms por clic de era en Películas, medido).
    const currentPath = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/" })
    const isMovieDetail = currentPath.startsWith("/movies/") && currentPath !== "/movies"

    // Pestaña presionada: el indicador se mueve al presionar (pointerdown), no
    // al terminar de renderizar la página nueva. Antes quedaba ~300 ms en la
    // pestaña vieja porque el render de la ruta trababa la animación (medido
    // cuadro a cuadro). Guarda desde qué ruta se presionó: al navegar se
    // descarta solo, y si se cancela (arrastrar fuera) vuelve a su lugar.
    const [pressed, setPressed] = React.useState<{ to: string; from: string } | null>(null)
    // Al cambiar la ruta la presión ya cumplió su papel: sin descartarla, volver atrás a la ruta
    // de origen la reactivaba y la barra marcaba el destino viejo (p. ej. "Inicio" estando en Cronología).
    const [lastPath, setLastPath] = React.useState(currentPath)
    if (lastPath !== currentPath) {
        setLastPath(currentPath)
        setPressed(null)
    }
    const activePath = pressed && pressed.from === currentPath ? pressed.to : currentPath

    // Qué altera de verdad la geometría de la barra. Sin `layoutDependency`, framer-motion vuelve a
    // medir (getBoundingClientRect de todos los nodos `layout`) en CADA render de la barra, y la barra
    // se renderiza en cada navegación aunque el indicador ya se haya movido al presionar: eran ~20 ms
    // de medición forzada dentro del cuadro del click en todas las secciones (medido con perfil).
    const navLayoutKey = `${activePath}|${showLabels}|${globalQueueOpen}|${playlistQueue.length}`

    if (isFullscreen || tvMode) return null

    const isAudioActive = bgMusicEnabled || uiSoundsEnabled

    const handleToggleMarathon = () => {
        const next = !marathonMode
        setMarathonMode(next)
        playSound("category", 0.4)
        toast(next ? "Maratón activado" : "Maratón desactivado", {
            description: next ? "Salta intros y créditos y sigue con el siguiente episodio." : "Vuelve la reproducción normal.",
            duration: 2500,
        })
    }

    const handleToggleAudio = () => {
        const next = !isAudioActive
        setBgMusicEnabled(next)
        setUiSoundsEnabled(next)
        persistThemePatch({ bgMusicEnabled: next, uiSoundsEnabled: next })
        if (next) playSound("category", 0.4)
        toast(next ? "Audio activado" : "Audio silenciado", {
            description: next ? "Música de fondo y sonidos de la interfaz." : undefined,
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
                transition={islasSuperioresSpring}
                className="fixed top-3.5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                {/* Misma señal que la barra central (scroll con histéresis, puntero, foco): las islas se abren y se cierran juntas.
                    `layout` + radio en style: la cápsula se reacomoda al perder el texto sin animar el ancho a mano. */}
                <m.div
                    layout
                    layoutDependency={showBrandText}
                    transition={layoutTransition}
                    style={{ borderRadius: 9999 }}
                    data-compact={!showBrandText ? "true" : undefined}
                    className="glass-frosted-pill [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/30"
                    {...engageHandlers}
                >
                    <Link
                        to="/home"
                        onClick={() => playSound("category", 0.3)}
                        aria-label="KameHouse, ir al inicio"
                        className={cn(
                            "group relative flex items-center justify-center gap-2.5 px-4 py-1.5 min-h-[36px] min-w-[36px] [@media(pointer:coarse)]:min-h-[44px] rounded-full active:scale-95 cursor-pointer",
                            "[transition:transform_var(--duration-quick)_var(--ease-out)]"
                        )}
                    >
                        <img
                            src="/kamehouse-logo.png"
                            alt=""
                            className="relative z-10 w-5 h-5 object-contain [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-quick ease-out-strong drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                        />
                        {/* Entre md y lg no entra todo en una fila, y al bajar la página la marca queda solo en logo */}
                        <NavLabel
                            show={showBrandText}
                            className="relative z-10 font-display font-black tracking-widest text-xs uppercase text-on-surface drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        >
                            KAMEHOUSE
                        </NavLabel>
                        <NavTooltip show={!showBrandText}>KameHouse</NavTooltip>
                    </Link>
                </m.div>
            </m.div>

            {/* ─── ISLA CENTRAL: NAVEGACIÓN PRINCIPAL (GLASSMORFISMO) ──────── */}
            <div className="fixed top-3.5 left-0 right-0 z-navbar hidden md:flex justify-center items-center pointer-events-none">
                <m.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={islasSuperioresSpring}
                    className="pointer-events-auto transform-gpu"
                >
                    <m.nav
                        layout
                        layoutDependency={navLayoutKey}
                        transition={layoutTransition}
                        // Con `layout` framer escala la píldora al reacomodarla: el radio va en style para que lo corrija.
                        style={{ borderRadius: 9999 }}
                        role="navigation"
                        aria-label="Navegación principal"
                        data-compact={!showLabels ? "true" : undefined}
                        className="glass-frosted-pill flex items-center gap-1 p-1.5"
                        {...engageHandlers}
                    >
                        {NAV_ITEMS.map((item) => {
                            const isRouteActive = activePath === item.to || (item.to !== "/home" && activePath.startsWith(item.to))
                            const isPillActive = !globalQueueOpen && isRouteActive

                            return (
                                <m.div key={item.id} layout layoutDependency={navLayoutKey} transition={layoutTransition} className="flex">
                                    <Link
                                        to={item.to}
                                        aria-current={isPillActive ? "page" : undefined}
                                        aria-label={item.label}
                                        onClick={() => playSound("category", 0.3)}
                                        onPointerDown={(e) => {
                                            if (e.button === 0 && !globalQueueOpen) setPressed({ to: item.to, from: currentPath })
                                        }}
                                        onPointerCancel={() => setPressed(null)}
                                        onPointerLeave={() => setPressed((p) => (p?.to === item.to ? null : p))}
                                        className={cn(NAV_ITEM_CLASS, showLabels && "min-w-[104px]", isPillActive ? "text-black font-bold" : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10")}
                                    >
                                        {/* Radio en style: con layoutId framer escala el indicador entre pastillas de
                                            distinto ancho y solo corrige el radio que le llega por style, no por clase. */}
                                        {isPillActive && (
                                            <MagneticIndicator
                                                layoutId="pill-nav-active"
                                                className="bg-white/95 rounded-full"
                                                style={{ borderRadius: 9999 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-1.5">
                                            {item.icon}
                                            <NavLabel show={showLabels}>{item.label}</NavLabel>
                                        </span>
                                        <NavTooltip show={!showLabels}>{item.label}</NavTooltip>
                                    </Link>
                                </m.div>
                            )
                        })}

                        {/* Mi Lista */}
                        <m.div layout layoutDependency={navLayoutKey} transition={layoutTransition} className="flex">
                            <button
                                type="button"
                                onClick={() => {
                                    setGlobalQueueOpen(!globalQueueOpen)
                                    playSound("category", 0.3)
                                }}
                                aria-label={playlistQueue.length > 0 ? `Mi Lista, ${playlistQueue.length} ${playlistQueue.length === 1 ? "elemento" : "elementos"}` : "Mi Lista"}
                                aria-pressed={globalQueueOpen}
                                className={cn(NAV_ITEM_CLASS, showLabels && "min-w-[104px]", globalQueueOpen ? "text-black font-bold" : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10")}
                            >
                                {globalQueueOpen && (
                                    <MagneticIndicator
                                        layoutId="pill-nav-active"
                                        className="bg-white/95 rounded-full"
                                        style={{ borderRadius: 9999 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                    <IconNavigationLayers className="w-3.5 h-3.5" />
                                    <NavLabel show={showLabels}>Mi Lista</NavLabel>
                                    {playlistQueue.length > 0 && (
                                        <span aria-hidden="true" className={cn(
                                            "text-3xs font-black font-mono tabular-nums px-1.5 py-px rounded-full min-w-[17px] inline-flex items-center justify-center text-center shadow-elevation-1 bg-brand-accent text-on-primary"
                                        )}>
                                            <ElasticCounter value={playlistQueue.length} />
                                        </span>
                                    )}
                                </span>
                                <NavTooltip show={!showLabels}>Mi Lista</NavTooltip>
                            </button>
                        </m.div>
                    </m.nav>
                </m.div>
            </div>

            {/* ─── ISLA DERECHA: BUSCADOR Y CONFIGURACIÓN (GLASSMORFISMO) ── */}
            <m.div role="group" aria-label="Búsqueda y ajustes"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={islasSuperioresSpring}
                className="fixed top-3.5 right-4 sm:right-6 md:right-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
            >
                <div className="glass-frosted-pill flex items-center gap-1 px-2 py-1.5">
                    {/* Buscador expandible */}
                    <ExpandableSearch />

                    {/* Configuración (Administración vive dentro de Ajustes).
                        Hover, presión y estado activo son micro-feedback: todo en --duration-quick (150 ms),
                        como los destinos de la barra central. Se escribe --duration-quick y no --duration-fast,
                        aunque hoy valgan lo mismo: lo fija el guard, para que el nombre diga el valor. */}
                    <Link
                        to="/settings"
                        onClick={() => playSound("category", 0.3)}
                        aria-label="Ajustes"
                        aria-current={currentPath.startsWith("/settings") || currentPath.startsWith("/admin") ? "page" : undefined}
                        title="Ajustes"
                        className={cn(
                            "h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
                            "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),box-shadow_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]",
                            currentPath.startsWith("/settings") || currentPath.startsWith("/admin")
                                ? "bg-white/95 text-black font-bold"
                                : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                        )}
                    >
                        <IconNavigationSettings className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </m.div>

            {/* ─── ISLA FLOTANTE INFERIOR IZQUIERDA: MARATÓN, ALEATORIO Y MÚSICA ─────────────── */}
            {/* Entrada y salida simétricas: al entrar a una ficha de película se funde en 150 ms en vez de
                desaparecer de golpe. Mientras sale no recibe clics (pointer-events-none). */}
            <AnimatePresence>
                {!isMovieDetail && (
                    <m.div key="acciones-rapidas" role="group" aria-label="Acciones rápidas"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0, pointerEvents: "auto" }}
                        exit={{ opacity: 0, y: 20, pointerEvents: "none", transition: SALIDA_ISLA_INFERIOR }}
                        transition={islaInferiorSpring}
                        className="fixed bottom-5 left-4 sm:left-6 md:left-8 z-navbar hidden md:flex items-center pointer-events-auto transform-gpu"
                    >
                        <div className="glass-frosted-pill flex items-center gap-1.5 px-2.5 py-1.5">
                            {/* Maratón */}
                            <button
                                type="button"
                                onClick={handleToggleMarathon}
                                aria-label={marathonMode ? "Desactivar Maratón" : "Activar Maratón"}
                                aria-pressed={marathonMode}
                                title={marathonMode ? "Maratón activado: salta intros y créditos" : "Maratón desactivado"}
                                className={cn(
                                    "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
                                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),border-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),box-shadow_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]",
                                    marathonMode
                                        ? "bg-brand-accent/25 text-brand-accent border border-brand-accent/40"
                                        : "text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                                )}
                            >
                                <IconNavigationRocket className="w-4 h-4" />
                            </button>

                            {/* Sorpréndeme: algo al azar en modo TV */}
                            <button
                                type="button"
                                onClick={handleOpenRandom}
                                aria-label="Sorpréndeme"
                                title="Sorpréndeme: algo al azar en modo TV"
                                className={cn(
                                    "p-2 rounded-full text-xs text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10 active:scale-95 flex items-center justify-center cursor-pointer",
                                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]"
                                )}
                            >
                                <IconMediaRandom className="w-4 h-4" />
                            </button>

                            {/* Música de Fondo */}
                            <button
                                type="button"
                                onClick={handleToggleAudio}
                                aria-label={isAudioActive ? "Silenciar música" : "Activar música de fondo"}
                                aria-pressed={isAudioActive}
                                title={isAudioActive ? "Música de fondo activada" : "Música de fondo silenciada"}
                                className={cn(
                                    "p-2 rounded-full text-xs flex items-center justify-center cursor-pointer active:scale-95",
                                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),border-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),box-shadow_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]",
                                    isAudioActive
                                        ? "text-brand-secondary bg-brand-secondary/15 border border-brand-secondary/30"
                                        : "text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                                )}
                            >
                                <IconSwap swapKey={isAudioActive ? "active" : "muted"}>
                                    {isAudioActive ? <IconMediaVolume2 className="w-4 h-4" /> : <IconMediaVolumeX className="w-4 h-4" />}
                                </IconSwap>
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}
