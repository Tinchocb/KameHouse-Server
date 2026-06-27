"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link, useRouterState } from "@tanstack/react-router"
import { AnimatePresence } from "framer-motion"
import * as React from "react"
import { Settings, Home, Film, Tv, Layers, RadioTower, Rocket, Loader2, ChevronRight, Menu } from "lucide-react"
import { cn } from "../core/styling"
import { RandomPlayButton } from "./random-play-button"
import { useSound } from "@/hooks/use-sound"
import { useResponsive } from "@/hooks/use-responsive"
import { BackgroundMusicPlayer } from "./background-music"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)

interface SidebarItem {
    to: string
    label: string
    icon: React.ReactNode
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    { to: "/home", label: "Inicio", icon: <Home className="w-5 h-5" /> },
    { to: "/series", label: "Series", icon: <Tv className="w-5 h-5" /> },
    { to: "/movies", label: "Películas", icon: <Film className="w-5 h-5" /> },
]

export function AppSidebar() {
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
    const isFullscreen = useAppStore(state => state.isFullscreen)
    const { isMobile } = useResponsive()

    if (isFullscreen) return null

    return (
        <>
            {/* Desktop Side Flap Sidebar */}
            <aside className={cn(
                "hidden md:flex flex-col fixed left-0 top-0 bottom-0 h-screen border-r border-white/10 bg-zinc-950/60 backdrop-blur-2xl rounded-r-[32px] shadow-[8px_0_32px_rgba(0,0,0,0.5)] z-50 overflow-visible transition-all duration-300 ease-in-out",
                sidebarOpen ? "w-[260px]" : "w-20"
            )}>
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            {isMobile && (
                <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                    <VaulContent
                        className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/5 liquid-glass-frosted !border-y-0 !border-l-0 !rounded-none shadow-2xl"
                        overlayClass="md:hidden bg-black/60 backdrop-blur-sm"
                    >
                        <SidebarContent setSidebarOpen={setSidebarOpen} />
                    </VaulContent>
                </Vaul>
            )}
        </>
    )
}

function SidebarContent({ setSidebarOpen }: { setSidebarOpen: (open: boolean) => void }) {
    const { playSound } = useSound()
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const activeTheme = useAppStore(state => state.activeTheme)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const globalQueueOpen = useAppStore(state => state.globalQueueOpen)
    const setGlobalQueueOpen = useAppStore(state => state.setGlobalQueueOpen)
    const tvMode = useAppStore(state => state.tvMode)
    const setTvMode = useAppStore(state => state.setTvMode)
    const marathonMode = useAppStore(state => state.marathonMode)
    const setMarathonMode = useAppStore(state => state.setMarathonMode)
    const isVideoActive = useAppStore(state => state.isVideoActive)
    const { isMobile } = useResponsive()

    const containerRef = React.useRef<HTMLDivElement>(null)
    const activeIndicatorRef = React.useRef<HTMLDivElement>(null)
    const activeBgRef = React.useRef<HTMLDivElement>(null)
    const navRef = React.useRef<HTMLDivElement>(null)

    const routerState = useRouterState()
    const currentPath = routerState.location.pathname

    const playChangeSound = () => {
        playSound("category", 0.4)
    }

    const [playTarget, setPlayTarget] = React.useState<{
        path: string
        streamType: "direct" | "transcode"
        title: string
        episodeLabel: string
        episodeNumber: number
        mediaId: number
        malId?: number | null
        mediaFormat?: string | null
    } | null>(null)
    const [isLoadingTarget, setIsLoadingTarget] = React.useState(false)

    const { data: collection } = useGetLibraryCollection()

    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const allEntriesRef = React.useRef(allEntries)
    React.useEffect(() => {
        allEntriesRef.current = allEntries
    }, [allEntries])

    const playTvModeRandom = React.useCallback(async () => {
        if (isLoadingTarget) return
        setIsLoadingTarget(true)
        setTvMode(true)
        playSound("category", 0.4)

        try {
            const candidates = allEntriesRef.current.filter(e => {
                if (!e?.media || (e.libraryData?.mainFileCount ?? 0) === 0) return false
                return e.media.format === "TV" || e.media.format === "TV_SHORT"
            })

            if (candidates.length === 0) {
                toast.error("No hay series en tu biblioteca para iniciar el Modo TV")
                setIsLoadingTarget(false)
                return
            }

            const randomEntry = candidates[Math.floor(Math.random() * candidates.length)]
            const localFiles = await fetchAnimeEntryLocalFiles(randomEntry.mediaId)

            if (!localFiles || localFiles.length === 0) {
                toast.error("No se encontraron archivos locales para esta serie")
                setIsLoadingTarget(false)
                return
            }

            const selectedFile = localFiles[Math.floor(Math.random() * localFiles.length)]
            if (!selectedFile?.path) {
                toast.error("Archivo no disponible")
                setIsLoadingTarget(false)
                return
            }

            const rawEp = selectedFile.metadata?.episode || Number(selectedFile.parsedInfo?.episode)
            const epNum = typeof rawEp === "number" ? rawEp : Number(rawEp) || 1

            const seriesTitle =
                randomEntry.media?.titleSpanish ||
                randomEntry.media?.titleRomaji ||
                randomEntry.media?.titleEnglish ||
                "Sin título"

            setPlayTarget({
                path: selectedFile.path,
                streamType: "direct",
                title: seriesTitle,
                episodeLabel: `Episodio ${epNum}`,
                episodeNumber: epNum,
                mediaId: randomEntry.mediaId,
                malId: randomEntry.media?.idMal ?? null,
                mediaFormat: randomEntry.media?.format,
            })

            toast.success(`📺 Modo TV sintonizado: reproduciendo episodio aleatorio`, {
                description: `${seriesTitle} — Ep. ${epNum}`,
                duration: 3500,
            })
        } catch (err) {
            console.error("[TvModeRandom] error:", err)
            toast.error("Ocurrió un error al sintonizar el canal")
        } finally {
            setIsLoadingTarget(false)
        }
    }, [isLoadingTarget, playSound, setTvMode, setPlayTarget])

    const playTvModeNext = React.useCallback(async (currentMediaId: number, currentEpisodeNumber: number) => {
        setIsLoadingTarget(true)
        try {
            const localFiles = await fetchAnimeEntryLocalFiles(currentMediaId)

            if (!localFiles || localFiles.length === 0) {
                playTvModeRandom()
                return
            }

            const nextEpNum = currentEpisodeNumber + 1
            const nextFile = localFiles.find(f => {
                const rawEp = f.metadata?.episode || Number(f.parsedInfo?.episode)
                const epNum = typeof rawEp === "number" ? rawEp : Number(rawEp)
                return epNum === nextEpNum
            })

            if (nextFile) {
                const series = allEntriesRef.current.find(e => e.mediaId === currentMediaId)
                const seriesTitle =
                    series?.media?.titleSpanish ||
                    series?.media?.titleRomaji ||
                    series?.media?.titleEnglish ||
                    "Sin título"

                setPlayTarget({
                    path: nextFile.path,
                    streamType: "direct",
                    title: seriesTitle,
                    episodeLabel: `Episodio ${nextEpNum}`,
                    episodeNumber: nextEpNum,
                    mediaId: currentMediaId,
                    malId: series?.media?.idMal ?? null,
                    mediaFormat: series?.media?.format,
                })

                toast.success(`📺 Siguiente episodio cargado`, {
                    description: `${seriesTitle} — Ep. ${nextEpNum}`,
                    duration: 3000,
                })
            } else {
                playTvModeRandom()
            }
        } catch (err) {
            console.error("[TvModeNext] error:", err)
            playTvModeRandom()
        } finally {
            setIsLoadingTarget(false)
        }
    }, [playTvModeRandom, setPlayTarget])

    // GSAP staggered entrance animations & active state transitions
    useGSAP(() => {
        // Staggered entrance for all navigatable/button items
        const items = containerRef.current?.querySelectorAll(".gsap-sidebar-item")
        if (items && items.length > 0) {
            gsap.fromTo(items,
                { opacity: 0, x: -16, scale: 0.95 },
                { opacity: 1, x: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
            )
        }
    }, { scope: containerRef })

    // Move active indicator to the currently active link element in desktop layout
    useGSAP(() => {
        if (!navRef.current) return
        const activeLink = navRef.current.querySelector(".active-sidebar-link") as HTMLElement
        if (activeLink) {
            // Find absolute coordinates relative to nav container
            const navRect = navRef.current.getBoundingClientRect()
            const linkRect = activeLink.getBoundingClientRect()
            const targetY = linkRect.top - navRect.top
            const targetHeight = linkRect.height
            const targetWidth = linkRect.width
            const targetX = linkRect.left - navRect.left

            // Move the line active indicator
            if (activeIndicatorRef.current) {
                gsap.to(activeIndicatorRef.current, {
                    y: targetY + (targetHeight - 24) / 2, // Centered vertically (height: 24px)
                    opacity: 1,
                    duration: 0.4,
                    ease: "elastic.out(1, 0.75)"
                })
            }

            // Move the pill active background
            if (activeBgRef.current) {
                gsap.to(activeBgRef.current, {
                    y: targetY,
                    x: targetX,
                    width: targetWidth,
                    opacity: 1,
                    height: targetHeight,
                    duration: 0.4,
                    ease: "power3.out"
                })
            }
        } else {
            // Hide indicators if no active route is matched in main list (e.g. settings)
            if (activeIndicatorRef.current) {
                gsap.to(activeIndicatorRef.current, { opacity: 0, duration: 0.2 })
            }
            if (activeBgRef.current) {
                gsap.to(activeBgRef.current, { opacity: 0, duration: 0.2 })
            }
        }
    }, [currentPath, playlistQueue.length, sidebarOpen])

    return (
        <div ref={containerRef} className={cn(
            "flex flex-col h-full py-8 w-full items-center bg-transparent transition-all duration-300",
            sidebarOpen ? "px-4" : "px-4 md:px-0"
        )}>
            {/* Header / Logo */}
            <div className={cn(
                "mb-10 w-full flex items-center gsap-sidebar-item transition-all duration-300",
                sidebarOpen ? "justify-between px-2" : "justify-center"
            )}>
                <Link
                    to="/home"
                    onClick={() => { if (isMobile) setSidebarOpen(false); playChangeSound(); }}
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <div className="relative">
                        <img
                            src="/kamehouse-logo.png"
                            alt="KameHouse"
                            className="h-9 w-9 shrink-0 object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-brand-orange/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                    </div>
                    {sidebarOpen && (
                        <span className="font-bebas text-xl text-white tracking-wider whitespace-nowrap">
                            KAMEHOUSE
                        </span>
                    )}
                </Link>
                
                {sidebarOpen && !isMobile && (
                    <button
                        onClick={() => { setSidebarOpen(false); playChangeSound(); }}
                        className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/5"
                        title="Contraer Menú"
                    >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                )}
            </div>

            {/* Expand arrow below logo when collapsed on desktop */}
            {!sidebarOpen && !isMobile && (
                <button
                    onClick={() => { setSidebarOpen(true); playChangeSound(); }}
                    className="hidden md:flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/5 mb-6"
                    title="Expandir Menú"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}

            {/* Navigation */}
            <div ref={navRef} className="flex-1 space-y-4 w-full flex flex-col items-center relative">

                {/* Active Indicator Sliding Dot/Bar */}
                <div
                    ref={activeIndicatorRef}
                    className="absolute left-0 top-0 !mt-0 w-1 h-6 bg-brand-orange rounded-r-full hidden md:block z-10 pointer-events-none opacity-0"
                />

                {/* Active Background Sliding Pill */}
                <div
                    ref={activeBgRef}
                    className="absolute left-0 top-0 !mt-0 bg-brand-orange/[0.06] border border-brand-orange/30 rounded-2xl shadow-[0_8px_32px_rgba(255,110,58,0.15)] z-0 pointer-events-none opacity-0"
                />

                {SIDEBAR_ITEMS.map((item) => {
                    const isActive = currentPath === item.to
                    return (
                        <div key={item.to} className="gsap-sidebar-item w-full flex justify-center">
                            <Link
                                to={item.to}
                                title={item.label}
                                onClick={() => { if (isMobile) setSidebarOpen(false); playChangeSound(); }}
                                className={cn("w-full flex justify-center", isActive && "active-sidebar-link")}
                            >
                                <div className={cn(
                                    "flex items-center h-14 rounded-2xl group px-4 relative liquid-glass-frosted-subtle transition-all duration-300",
                                    "active:scale-95 font-bold",
                                    sidebarOpen ? "w-full justify-start gap-4 px-5" : "justify-center md:w-14 w-full md:px-0",
                                    isActive
                                        ? "text-white"
                                        : "text-zinc-400 hover:text-white hover:!border-white/15"
                                )}>
                                    <span className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300">
                                        {item.icon}
                                    </span>
                                    <span className={cn(
                                        "uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange whitespace-nowrap",
                                        (sidebarOpen || isMobile) ? "block" : "hidden md:hidden"
                                    )}>
                                        {item.label}
                                    </span>
                                </div>
                            </Link>
                        </div>
                    )
                })}

                {/* Queue Toggle Button - Shown conditionally */}
                {playlistQueue.length > 0 && (
                    <div className="gsap-sidebar-item w-full flex justify-center">
                        <button
                            onClick={() => {
                                setGlobalQueueOpen(!globalQueueOpen)
                                if (isMobile) setSidebarOpen(false)
                                playChangeSound()
                            }}
                            title="Cola de Reproducción"
                            className={cn(
                                "flex items-center h-14 rounded-2xl group px-4 relative liquid-glass-frosted-subtle transition-all duration-300",
                                "active:scale-95 font-bold",
                                sidebarOpen ? "w-full justify-start gap-4 px-5" : "justify-center md:w-14 w-full md:px-0",
                                globalQueueOpen
                                    ? "text-brand-orange !bg-brand-orange/[0.06] !border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-400 hover:text-white hover:!border-white/15"
                            )}
                        >
                            {/* Active Indicator Dot */}
                            <div className={cn(
                                "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                                globalQueueOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                            )} />

                            <span className="shrink-0 z-10 relative group-hover:scale-110 transition-transform duration-300">
                                <Layers className="w-5 h-5" />
                                {/* Badge count */}
                                <span className="absolute -top-2.5 -right-2.5 bg-brand-orange text-white text-[8px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border border-zinc-950 shadow-md px-[3px]">
                                    {playlistQueue.length}
                                </span>
                            </span>
                            <span className={cn(
                                "uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange whitespace-nowrap",
                                (sidebarOpen || isMobile) ? "block" : "hidden md:hidden"
                            )}>
                                Cola ({playlistQueue.length})
                            </span>
                        </button>
                    </div>
                )}

                {/* TV Mode Toggle Button */}
                <div className="gsap-sidebar-item w-full flex justify-center">
                    <button
                        onClick={playTvModeRandom}
                        title="Sintonizar Modo TV (Aleatorio 24h)"
                        disabled={isLoadingTarget}
                        className={cn(
                            "flex items-center h-14 rounded-2xl group px-4 relative liquid-glass-frosted-subtle transition-all duration-300",
                            "active:scale-95 font-bold",
                            sidebarOpen ? "w-full justify-start gap-4 px-5" : "justify-center md:w-14 w-full md:px-0",
                            isLoadingTarget
                                ? "!border-brand-orange/40 !bg-brand-orange/[0.06] text-brand-orange cursor-wait"
                                : (isVideoActive && tvMode)
                                    ? "text-brand-orange !bg-brand-orange/[0.06] !border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-400 hover:text-white hover:!border-white/15"
                        )}
                    >
                        {/* Active Indicator Dot */}
                        <div className={cn(
                            "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                            (isVideoActive && tvMode) ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                        )} />

                        <span className="shrink-0 z-10 relative group-hover:scale-110 transition-transform duration-300">
                            {isLoadingTarget ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <RadioTower className="w-5 h-5" />
                            )}
                        </span>
                        <span className={cn(
                            "uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange whitespace-nowrap",
                            (sidebarOpen || isMobile) ? "block" : "hidden md:hidden"
                        )}>
                            Modo TV {(isVideoActive && tvMode) ? "(24H)" : ""}
                        </span>
                    </button>
                </div>

                {/* Marathon Mode Toggle Button */}
                <div className="gsap-sidebar-item w-full flex justify-center">
                    <button
                        onClick={() => { setMarathonMode(!marathonMode); playChangeSound() }}
                        title={marathonMode ? "Desactivar Modo Maratón" : "Activar Modo Maratón"}
                        className={cn(
                            "flex items-center h-14 rounded-2xl group px-4 relative liquid-glass-frosted-subtle transition-all duration-300",
                            "active:scale-95 font-bold",
                            sidebarOpen ? "w-full justify-start gap-4 px-5" : "justify-center md:w-14 w-full md:px-0",
                            marathonMode
                                ? "text-brand-orange !bg-brand-orange/[0.06] !border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                : "text-zinc-400 hover:text-white hover:!border-white/15"
                        )}
                    >
                        <div className={cn(
                            "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                            marathonMode ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                        )} />
                        <span className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300">
                            <Rocket className="w-5 h-5" />
                        </span>
                        <span className={cn(
                            "uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange whitespace-nowrap",
                            (sidebarOpen || isMobile) ? "block" : "hidden md:hidden"
                        )}>
                            Maratón {marathonMode ? "(ON)" : ""}
                        </span>
                    </button>
                </div>
            </div>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 w-full flex flex-col items-center gap-6 pt-8">
                {/* Background Music and Random Play buttons */}
                <div className={cn(
                    "flex gsap-sidebar-item transition-all duration-300 w-full justify-center items-center",
                    sidebarOpen ? "flex-row gap-4 px-4" : "flex-col gap-6"
                )}>
                    <BackgroundMusicPlayer />
                    <RandomPlayButton />
                </div>

                {/* Settings (Always at the bottom) */}
                <div className="gsap-sidebar-item w-full flex justify-center">
                    <Link
                        to="/settings"
                        title="Configuración"
                        onClick={() => { if (isMobile) setSidebarOpen(false); playChangeSound(); }}
                        className={cn("w-full flex justify-center", currentPath === "/settings" && "active-sidebar-link")}
                    >
                        <div className={cn(
                            "flex items-center h-14 rounded-2xl group px-4 relative liquid-glass-frosted-subtle transition-all duration-300",
                            "active:scale-95 font-bold",
                            sidebarOpen ? "w-full justify-start gap-4 px-5" : "justify-center md:w-14 w-full md:px-0",
                            currentPath === "/settings"
                                ? "text-white"
                                : "text-zinc-400 hover:text-white hover:!border-white/15"
                        )}>
                            <span className="shrink-0 z-10 group-hover:rotate-45 group-hover:scale-110 transition-transform duration-500">
                                <Settings className="w-5 h-5" />
                            </span>
                            <span className={cn(
                                "uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange whitespace-nowrap",
                                (sidebarOpen || isMobile) ? "block" : "hidden md:hidden"
                            )}>
                                Configuración
                            </span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Video Player overlay */}
            <AnimatePresence>
                {playTarget && (
                    <React.Suspense fallback={null}>
                        <VideoPlayer
                            streamUrl={playTarget.path}
                            streamType={playTarget.streamType}
                            title={playTarget.title}
                            episodeLabel={playTarget.episodeLabel}
                            episodeNumber={playTarget.episodeNumber}
                            mediaId={playTarget.mediaId}
                            malId={playTarget.malId}
                            mediaFormat={playTarget.mediaFormat}
                            onClose={() => {
                                setPlayTarget(null);
                                setTvMode(false);
                            }}
                            onNextEpisode={() => playTvModeNext(playTarget.mediaId, playTarget.episodeNumber)}
                            hasNextEpisode={true}
                        />
                    </React.Suspense>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * Magnetic component using GSAP for a high-performance GPU-accelerated cursor pull effect.
 */
function Magnetic({ children, className }: { children: React.ReactNode, className?: string }) {
    const ref = React.useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (!ref.current) return

        const el = ref.current

        // GPU-accelerated GSAP quickTo properties for zero-lag coordinates movement
        const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" })
        const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" })

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e
            const { left, top, width, height } = el.getBoundingClientRect()
            const centerX = left + width / 2
            const centerY = top + height / 2
            const distanceX = clientX - centerX
            const distanceY = clientY - centerY

            // Dynamic magnetic pull physics
            xTo(distanceX * 0.35)
            yTo(distanceY * 0.3)
        }

        const handleMouseLeave = () => {
            xTo(0)
            yTo(0)
        }

        el.addEventListener("mousemove", handleMouseMove)
        el.addEventListener("mouseleave", handleMouseLeave)

        return () => {
            el.removeEventListener("mousemove", handleMouseMove)
            el.removeEventListener("mouseleave", handleMouseLeave)
        }
    }, { scope: ref })

    return (
        <div
            ref={ref}
            className={cn("w-full flex justify-center", className)}
        >
            {children}
        </div>
    )
}
