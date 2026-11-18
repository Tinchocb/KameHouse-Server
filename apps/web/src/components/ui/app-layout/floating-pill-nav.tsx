"use client"

import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { AnimatePresence, m } from "framer-motion"
import { IconNavigationHome, IconNavigationTv, IconNavigationFilm, IconStatusSparkles, IconNavigationLayers, IconNavigationSettings, IconNavigationRocket } from "@/components/ui/icons";
import { IconMediaRandom, IconMediaVolume2, IconMediaVolumeX, IconUiMoreHorizontal } from "@/components/ui/icons"
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
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
import { Popover } from "@/components/ui/popover"
import { QuickActionsIsland } from "./quick-actions-island"

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
 * 36 px de alto con puntero fino, 44 px con puntero grueso o navegación inferior móvil.
 */
const NAV_ITEM_CLASS = cn(
    "group relative max-md:flex-1 px-3 lg:px-3.5 xl:px-4 py-1.5 min-h-[36px] max-md:min-h-[44px] [@media(pointer:coarse)]:min-h-[44px] min-w-[36px] justify-center rounded-full text-xs font-semibold tracking-wide transition-[color,background-color,transform] duration-quick ease-out-strong motion-safe:active:scale-[0.97] flex items-center gap-1.5 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
)

export function FloatingPillNav() {
    const { playSound } = useSound()
    const isFullscreen = useAppStore(state => state.isFullscreen)

    // Store state & actions
    const playlistQueueLength = useAppStore(state => state.playlistQueue.length)
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
    const isDesktop = useMinWidth(768)
    const isMinimalist = useIsMinimalistMode()
    const isMinimalistDesktop = isMinimalist && isDesktop
    const showLabels = isMinimalistDesktop || (!isMinimalist && isWide && !compact)
    // La marca (KAMEHOUSE) se compacta con la misma señal que la barra central o en modo minimalista.
    const showBrandText = !isMinimalist && (isWide && !compact)
    const layoutTransition = useNavTransition()
    // Islas superiores (marca, centro y ajustes): preset "island", antes escrito a mano en cada una. También va antes del return null.
    const islasSuperioresSpring = useSpringPreset("island")

    // Solo la ruta: con el estado completo del router la barra se re-renderizaba con cada filtro,
    // orden o búsqueda de las páginas (25 ms por clic de era en Películas, medido).
    const currentPath = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/" })
    const isMovieDetail = currentPath.startsWith("/movies/") && currentPath !== "/movies"
    const isSeriesDetail = currentPath.startsWith("/series/") && currentPath !== "/series"
    const isSettingsOrAdmin = currentPath.startsWith("/settings") || currentPath.startsWith("/admin")
    // En escritorio Minimalista y en móvil (< 768 px, donde la barra principal vive abajo)
    // las acciones rápidas se agrupan en el menú superior para evitar islas solapadas.
    const showQuickActionsMenu = isMinimalistDesktop || (!isDesktop && !isMovieDetail && !isSeriesDetail && !isSettingsOrAdmin)
    const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
    const quickActionsRef = React.useRef<HTMLDivElement>(null)
    // El menú pertenece a esta ruta y este shell; volver a ellos no debe reabrirlo.
    const quickActionsContext = `${currentPath}|${showQuickActionsMenu}|${isFullscreen}`
    const [lastQuickActionsContext, setLastQuickActionsContext] = React.useState(quickActionsContext)
    if (lastQuickActionsContext !== quickActionsContext) {
        setLastQuickActionsContext(quickActionsContext)
        setQuickActionsOpen(false)
    }
    React.useEffect(() => {
        const closeForFullscreen = () => { if (document.fullscreenElement) setQuickActionsOpen(false) }
        document.addEventListener("fullscreenchange", closeForFullscreen)
        return () => document.removeEventListener("fullscreenchange", closeForFullscreen)
    }, [])

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
    const navLayoutKey = `${activePath}|${showLabels}|${isDesktop}|${globalQueueOpen}|${playlistQueueLength}`
    const [isSearchExpanded, setIsSearchExpanded] = React.useState(false)
    const searchContext = `${isMinimalistDesktop}|${currentPath}|${isFullscreen}`
    const [previousSearchContext, setPreviousSearchContext] = React.useState(searchContext)
    if (previousSearchContext !== searchContext) {
        setPreviousSearchContext(searchContext)
        setIsSearchExpanded(false)
    }

    if (isFullscreen) return null

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
        if (showQuickActionsMenu) {
            setQuickActionsOpen(false)
            // Espera al desmontaje del Popover antes de que el diálogo reclame el foco.
            requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("open-random-picker")))
        } else {
            window.dispatchEvent(new CustomEvent("open-random-picker"))
        }
    }

    const quickActionBaseClass = showQuickActionsMenu
        ? "w-full justify-start gap-3 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold"
        : "p-2 min-h-[36px] min-w-[36px] [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] justify-center rounded-full text-xs"

    const quickActions = (
        <div
            ref={quickActionsRef}
            className={cn(
                "floating-nav-quick-actions",
                showQuickActionsMenu
                    ? "flex flex-col items-stretch gap-1 p-0"
                    : "floating-nav-island glass-frosted-pill flex items-center gap-1.5 px-2.5 py-1.5"
            )}
        >
            {/* Maratón */}
            <button
                type="button"
                onClick={handleToggleMarathon}
                aria-label={marathonMode ? "Desactivar Maratón" : "Activar Maratón"}
                aria-pressed={marathonMode}
                title={marathonMode ? "Maratón activado: salta intros y créditos" : "Maratón desactivado"}
                className={cn(
                    quickActionBaseClass,
                    "flex items-center cursor-pointer motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),border-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),box-shadow_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]",
                    marathonMode
                        ? "bg-[var(--control-selected-bg,hsl(var(--brand-accent)/0.2))] text-brand-accent-readable border border-[var(--control-selected-border,hsl(var(--brand-accent)/0.4))]"
                        : "text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                )}
            >
                <IconNavigationRocket className="w-4 h-4 shrink-0" />
                <span className={cn("floating-nav-quick-label", showQuickActionsMenu ? "inline" : "hidden")}>Maratón</span>
            </button>

            {/* Sorpréndeme: algo al azar en modo maratón */}
            <button
                type="button"
                onClick={handleOpenRandom}
                aria-label="Sorpréndeme"
                title="Sorpréndeme: algo al azar en modo maratón"
                className={cn(
                    quickActionBaseClass,
                    "text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10 motion-safe:active:scale-[0.97] flex items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]"
                )}
            >
                <IconMediaRandom className="w-4 h-4 shrink-0" />
                <span className={cn("floating-nav-quick-label", showQuickActionsMenu ? "inline" : "hidden")}>Sorpréndeme</span>
            </button>

            {/* Música de Fondo */}
            <button
                type="button"
                onClick={handleToggleAudio}
                aria-label={isAudioActive ? "Silenciar música" : "Activar música de fondo"}
                aria-pressed={isAudioActive}
                title={isAudioActive ? "Música de fondo activada" : "Música de fondo silenciada"}
                className={cn(
                    quickActionBaseClass,
                    "flex items-center cursor-pointer motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                    "[transition:background-color_var(--duration-quick)_var(--ease-smooth-out),border-color_var(--duration-quick)_var(--ease-smooth-out),color_var(--duration-quick)_var(--ease-smooth-out),box-shadow_var(--duration-quick)_var(--ease-smooth-out),transform_var(--duration-quick)_var(--ease-out)]",
                    isAudioActive
                        ? "bg-[var(--control-selected-bg,hsl(var(--brand-accent)/0.2))] text-brand-accent-readable border border-[var(--control-selected-border,hsl(var(--brand-accent)/0.4))]"
                        : "text-on-surface-variant border border-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
                )}
            >
                <IconSwap subtle swapKey={isAudioActive ? "active" : "muted"}>
                    {isAudioActive ? <IconMediaVolume2 className="w-4 h-4 shrink-0" /> : <IconMediaVolumeX className="w-4 h-4 shrink-0" />}
                </IconSwap>
                <span className={cn("floating-nav-quick-label", showQuickActionsMenu ? "inline" : "hidden")}>Sonidos</span>
            </button>
        </div>
    )

    if (isMinimalistDesktop) {
        return (
            <div role="region" aria-label="Navegación flotante" className="select-none pointer-events-none">
                {/* Background Music Engine & Random Play Picker Modal */}
                <BackgroundMusicPlayer />
                <div className="pointer-events-auto">
                    <RandomPlayButton />
                </div>
                <header
                    role="banner"
                    aria-label="Navegación principal"
                    className="floating-nav-strip pointer-events-auto fixed top-0 left-0 right-0 z-navbar h-14 min-h-[56px] px-4 md:px-6 lg:px-8 flex items-center justify-between border-b border-[var(--minimal-line-2)] bg-[var(--minimal-surface)] select-none"
                >
                    {/* Marca: símbolo a 768-1023px, símbolo + nombre desde 1024px */}
                    <div className="flex items-center shrink-0">
                        <Link
                            to="/home"
                            onClick={() => playSound("category", 0.3)}
                            aria-label="KameHouse, ir al inicio"
                            className="flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer motion-safe:active:scale-[0.98] transition-colors hover:bg-[var(--minimal-fill-1)]"
                        >
                            <img
                                src="/kamehouse-logo.png"
                                alt=""
                                className="w-5 h-5 object-contain"
                            />
                            {isWide && (
                                <span className="font-display font-semibold tracking-wider text-xs text-[var(--minimal-text-1)]">
                                    KAMEHOUSE
                                </span>
                            )}
                        </Link>
                    </div>

                    {/* Destinos principales (Inicio, Series, Películas, Cronología, Mi Lista) */}
                    <nav
                        role="navigation"
                        aria-label="Destinos principales"
                        aria-hidden={isSearchExpanded ? "true" : undefined}
                        inert={isSearchExpanded ? true : undefined}
                        className={cn(
                            "flex items-center gap-1 sm:gap-1.5 transition-opacity duration-150",
                            isSearchExpanded && "opacity-0 pointer-events-none"
                        )}
                    >
                        {NAV_ITEMS.map((item) => {
                            const isRouteActive = activePath === item.to || (item.to !== "/home" && activePath.startsWith(item.to))
                            const isPillActive = !globalQueueOpen && isRouteActive

                            return (
                                <Link
                                    key={item.id}
                                    to={item.to}
                                    aria-current={isPillActive ? "page" : undefined}
                                    aria-label={item.label}
                                    onClick={() => playSound("category", 0.3)}
                                    onPointerDown={(e) => {
                                        if (e.button === 0 && !globalQueueOpen) setPressed({ to: item.to, from: currentPath })
                                    }}
                                    onPointerCancel={() => setPressed(null)}
                                    onPointerLeave={() => setPressed((p) => (p?.to === item.to ? null : p))}
                                    className={cn(
                                        "flex items-center gap-1.5 min-h-[44px] px-3 lg:px-3.5 rounded-xl text-xs cursor-pointer select-none transition-colors motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                        isPillActive
                                            ? "bg-[var(--minimal-fill-3)] text-[var(--minimal-text-1)] border border-[var(--minimal-line-4)] font-semibold shadow-none"
                                            : "text-[var(--minimal-text-2)] border border-transparent hover:text-[var(--minimal-text-hi)] hover:bg-[var(--minimal-fill-1)]"
                                    )}
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}

                        {/* Mi Lista */}
                        <button
                            type="button"
                            onClick={() => {
                                setGlobalQueueOpen(!globalQueueOpen)
                                playSound("category", 0.3)
                            }}
                            aria-label={playlistQueueLength > 0 ? `Mi Lista, ${playlistQueueLength} ${playlistQueueLength === 1 ? "elemento" : "elementos"}` : "Mi Lista"}
                            aria-pressed={globalQueueOpen}
                            className={cn(
                                "flex items-center gap-1.5 min-h-[44px] px-3 lg:px-3.5 rounded-xl text-xs cursor-pointer select-none transition-colors motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                globalQueueOpen
                                    ? "bg-[var(--minimal-fill-3)] text-[var(--minimal-text-1)] border border-[var(--minimal-line-4)] font-semibold shadow-none"
                                    : "text-[var(--minimal-text-2)] border border-transparent hover:text-[var(--minimal-text-hi)] hover:bg-[var(--minimal-fill-1)]"
                            )}
                        >
                            <span className="shrink-0"><IconNavigationLayers className="w-3.5 h-3.5" /></span>
                            <span>Mi Lista</span>
                            {playlistQueueLength > 0 && (
                                <span aria-hidden="true" className="text-3xs font-black font-mono tabular-nums px-1.5 py-px rounded-full min-w-[17px] inline-flex items-center justify-center text-center bg-brand-accent text-on-primary">
                                    <ElasticCounter value={playlistQueueLength} />
                                </span>
                            )}
                        </button>
                    </nav>

                    {/* Herramientas derechas: Búsqueda, Acciones Rápidas y Ajustes */}
                    <div role="group" aria-label="Búsqueda y ajustes" className="floating-nav-strip-tools flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <ExpandableSearch onExpandedChange={setIsSearchExpanded} />

                        <Popover
                            open={quickActionsOpen}
                            onOpenChange={setQuickActionsOpen}
                            modal={false}
                            align="end"
                            aria-label="Acciones rápidas"
                            className="floating-nav-quick-menu w-60 max-w-[calc(100vw-2rem)] p-1.5"
                            onOpenAutoFocus={(event) => {
                                event.preventDefault()
                                quickActionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
                            }}
                            trigger={
                                <button
                                    type="button"
                                    aria-label="Acciones rápidas"
                                    title="Acciones rápidas"
                                    className="flex items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded-xl text-xs text-[var(--minimal-text-2)] hover:text-[var(--minimal-text-hi)] hover:bg-[var(--minimal-fill-1)] cursor-pointer motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-colors"
                                >
                                    <IconUiMoreHorizontal className="w-4 h-4" />
                                </button>
                            }
                        >
                            {quickActions}
                        </Popover>

                        <Link
                            to="/settings"
                            onClick={() => playSound("category", 0.3)}
                            aria-label="Ajustes"
                            aria-current={currentPath.startsWith("/settings") || currentPath.startsWith("/admin") ? "page" : undefined}
                            title="Ajustes"
                            className={cn(
                                "flex items-center justify-center min-h-[44px] min-w-[44px] px-2.5 rounded-xl text-xs cursor-pointer motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-colors",
                                currentPath.startsWith("/settings") || currentPath.startsWith("/admin")
                                    ? "bg-[var(--minimal-fill-3)] text-[var(--minimal-text-1)] border border-[var(--minimal-line-4)] font-semibold"
                                    : "text-[var(--minimal-text-2)] hover:text-[var(--minimal-text-hi)] hover:bg-[var(--minimal-fill-1)]"
                            )}
                        >
                            <IconNavigationSettings className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </header>
            </div>
        )
    }

    return (
        <div role="region" aria-label="Navegación flotante" className="select-none pointer-events-none">
            {/* Background Music Engine & Random Play Picker Modal */}
            <BackgroundMusicPlayer />
            <div className="pointer-events-auto">
                <RandomPlayButton />
            </div>
            <div className="floating-nav-header contents">
            {/* ─── ISLAS FLOTANTES DE NAVEGACIÓN ─────────────────────────── */}
            {/* ─── ISLA IZQUIERDA: LOGO FLOTANTE (GLASSMORFISMO) ──────────── */}
            <m.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={islasSuperioresSpring}
                className="floating-nav-brand fixed top-3.5 left-4 sm:left-6 md:left-8 z-navbar flex items-center pointer-events-auto transform-gpu"
            >
                {/* Misma señal que la barra central (scroll con histéresis, puntero, foco): las islas se abren y se cierran juntas.
                    `layout` + radio en style: la cápsula se reacomoda al perder el texto sin animar el ancho a mano. */}
                <m.div
                    layout
                    layoutDependency={showBrandText}
                    transition={layoutTransition}
                    style={{ borderRadius: 9999 }}
                    data-compact={!showBrandText ? "true" : undefined}
                    className="floating-nav-island glass-frosted-pill [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/30"
                    {...engageHandlers}
                >
                    <Link
                        to="/home"
                        onClick={() => playSound("category", 0.3)}
                        aria-label="KameHouse, ir al inicio"
                        className={cn(
                            "group relative flex items-center justify-center gap-2.5 px-4 py-1.5 min-h-[36px] min-w-[36px] [@media(pointer:coarse)]:min-h-[44px] rounded-full motion-safe:active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            "[transition:transform_var(--duration-quick)_var(--ease-out)]"
                        )}
                    >
                        <img
                            src="/kamehouse-logo.png"
                            alt=""
                            className="relative z-10 w-5 h-5 object-contain motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-quick ease-out-strong drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
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
            <div className="floating-nav-main fixed max-md:top-auto max-md:bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:top-3.5 left-0 right-0 max-md:px-3 z-navbar flex justify-center items-center pointer-events-none">
                <m.div
                    initial={{ opacity: 0, y: isDesktop ? -20 : 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={islasSuperioresSpring}
                    className="pointer-events-auto transform-gpu max-md:w-full max-md:max-w-sm"
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
                        className="floating-nav-island glass-frosted-pill flex items-center max-md:justify-between gap-1 p-1.5 max-md:w-full"
                        {...engageHandlers}
                    >
                        {NAV_ITEMS.map((item) => {
                            const isRouteActive = activePath === item.to || (item.to !== "/home" && activePath.startsWith(item.to))
                            const isPillActive = !globalQueueOpen && isRouteActive

                            return (
                                <m.div key={item.id} layout layoutDependency={navLayoutKey} transition={layoutTransition} className="flex max-md:flex-1">
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
                                        className={cn(NAV_ITEM_CLASS, showLabels && "min-w-[88px] xl:min-w-[104px]", isPillActive ? "text-black font-bold" : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10")}
                                    >
                                        {/* Radio en style: con layoutId framer escala el indicador entre pastillas de
                                            distinto ancho y solo corrige el radio que le llega por style, no por clase. */}
                                        {isPillActive && (
                                            <MagneticIndicator
                                                layoutId="pill-nav-active"
                                                className="floating-nav-active-indicator bg-white/95 rounded-full"
                                                style={{ borderRadius: 9999 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-1.5">
                                            <span className="floating-nav-destination-icon contents">{item.icon}</span>
                                            <NavLabel show={showLabels}>{item.label}</NavLabel>
                                        </span>
                                        <NavTooltip show={!showLabels}>{item.label}</NavTooltip>
                                    </Link>
                                </m.div>
                            )
                        })}

                        {/* Mi Lista */}
                        <m.div layout layoutDependency={navLayoutKey} transition={layoutTransition} className="flex max-md:flex-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setGlobalQueueOpen(!globalQueueOpen)
                                    playSound("category", 0.3)
                                }}
                                aria-label={playlistQueueLength > 0 ? `Mi Lista, ${playlistQueueLength} ${playlistQueueLength === 1 ? "elemento" : "elementos"}` : "Mi Lista"}
                                aria-pressed={globalQueueOpen}
                                className={cn(NAV_ITEM_CLASS, showLabels && "min-w-[88px] xl:min-w-[104px]", globalQueueOpen ? "text-black font-bold" : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10")}
                            >
                                {globalQueueOpen && (
                                    <MagneticIndicator
                                        layoutId="pill-nav-active"
                                        className="floating-nav-active-indicator bg-white/95 rounded-full"
                                        style={{ borderRadius: 9999 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                    <span className="floating-nav-destination-icon contents"><IconNavigationLayers className="w-3.5 h-3.5" /></span>
                                    <NavLabel show={showLabels}>Mi Lista</NavLabel>
                                    {playlistQueueLength > 0 && (
                                        <span aria-hidden="true" className={cn(
                                            "floating-nav-queue-badge text-3xs font-black font-mono tabular-nums px-1.5 py-px rounded-full min-w-[17px] inline-flex items-center justify-center text-center shadow-elevation-1 bg-brand-accent text-on-primary"
                                        )}>
                                            <ElasticCounter value={playlistQueueLength} />
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
                className="floating-nav-tools fixed top-3.5 right-4 sm:right-6 md:right-8 z-navbar flex items-center pointer-events-auto transform-gpu"
            >
                <div className="floating-nav-island glass-frosted-pill flex items-center gap-1 px-2 py-1.5">
                    {/* Buscador expandible */}
                    <ExpandableSearch />

                    {showQuickActionsMenu && (
                        <Popover
                            open={quickActionsOpen}
                            onOpenChange={setQuickActionsOpen}
                            modal={false}
                            align="end"
                            aria-label="Acciones rápidas"
                            className="floating-nav-quick-menu w-60 max-w-[calc(100vw-2rem)] p-1.5"
                            onOpenAutoFocus={(event) => {
                                event.preventDefault()
                                quickActionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
                            }}
                            trigger={
                                <button type="button" className={cn(NAV_ITEM_CLASS, "max-md:flex-none px-2.5")} aria-label="Acciones rápidas" title="Acciones rápidas">
                                    <IconUiMoreHorizontal className="w-4 h-4" />
                                </button>
                            }
                        >
                            {quickActions}
                        </Popover>
                    )}

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
                            "h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 rounded-full text-xs flex items-center justify-center cursor-pointer motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
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
            {/* La isla conserva su interacción al interrumpir una salida. */}
            <AnimatePresence>
                {!showQuickActionsMenu && !isMovieDetail && !isSeriesDetail && !isSettingsOrAdmin && (
                    <QuickActionsIsland key="acciones-rapidas">
                        {quickActions}
                    </QuickActionsIsland>
                )}
            </AnimatePresence>
            </div>
        </div>
    )
}
