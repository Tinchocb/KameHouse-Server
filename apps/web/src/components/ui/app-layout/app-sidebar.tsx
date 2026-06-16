"use client"

import { useAppStore } from "@/lib/store"
import { Vaul, VaulContent } from "@/components/vaul"
import { Link } from "@tanstack/react-router"
import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"
import { FaBook, FaCog, FaHome, FaFilm, FaTv, FaMoon, FaDownload, FaLayerGroup, FaBroadcastTower } from "react-icons/fa"
import { cn } from "../core/styling"
import { RandomPlayButton } from "./random-play-button"
import { useSound } from "@/hooks/use-sound"
import { useResponsive } from "@/hooks/use-responsive"
import { BackgroundMusicPlayer } from "./background-music"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface SidebarItem {
    to: string
    label: string
    icon: React.ReactNode
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    { to: "/home", label: "Inicio", icon: <FaHome className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" /> },
    { to: "/series", label: "Series", icon: <FaTv className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" /> },
    { to: "/movies", label: "Películas", icon: <FaFilm className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" /> },
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
            <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 h-screen w-20 border-r border-white/10 bg-zinc-950/80 backdrop-blur-2xl rounded-r-[32px] shadow-[8px_0_32px_rgba(0,0,0,0.5)] z-50 overflow-visible">
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
    const activeTheme = useAppStore(state => state.activeTheme)
    const setActiveTheme = useAppStore(state => state.setActiveTheme)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const globalQueueOpen = useAppStore(state => state.globalQueueOpen)
    const setGlobalQueueOpen = useAppStore(state => state.setGlobalQueueOpen)
    const tvMode = useAppStore(state => state.tvMode)
    const setTvMode = useAppStore(state => state.setTvMode)
    const isVideoActive = useAppStore(state => state.isVideoActive)

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

    const playTvModeRandom = async () => {
        if (isLoadingTarget) return
        setIsLoadingTarget(true)
        setTvMode(true)
        playSound("category", 0.4)

        try {
            const candidates = allEntries.filter(e => {
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

            const isMp4 = selectedFile.path.toLowerCase().endsWith(".mp4")
            const seriesTitle =
                randomEntry.media?.titleSpanish ||
                randomEntry.media?.titleRomaji ||
                randomEntry.media?.titleEnglish ||
                "Sin título"

            setPlayTarget({
                path: selectedFile.path,
                streamType: isMp4 ? "direct" : "transcode",
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
    }

    const playTvModeNext = async (currentMediaId: number, currentEpisodeNumber: number) => {
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
                const isMp4 = nextFile.path.toLowerCase().endsWith(".mp4")
                const series = allEntries.find(e => e.mediaId === currentMediaId)
                const seriesTitle =
                    series?.media?.titleSpanish ||
                    series?.media?.titleRomaji ||
                    series?.media?.titleEnglish ||
                    "Sin título"

                setPlayTarget({
                    path: nextFile.path,
                    streamType: isMp4 ? "direct" : "transcode",
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
    }

    return (
        <div className="flex flex-col h-full py-8 px-4 md:px-0 w-full items-center bg-transparent">
            {/* Header / Logo */}
            <div className="mb-10 px-2 flex justify-center group cursor-pointer" onClick={() => { setSidebarOpen(false); playChangeSound(); }}>
                <div className="relative">
                    <img
                        src="/kamehouse-logo.png"
                        alt="KameHouse"
                        className="h-9 w-9 shrink-0 object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-brand-orange/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-4 w-full px-3 md:px-0 flex flex-col items-center">
                {SIDEBAR_ITEMS.map((item) => (
                    <Magnetic key={item.to}>
                        <Link
                            to={item.to}
                            title={item.label}
                            onClick={() => { setSidebarOpen(false); playChangeSound(); }}
                        >
                            {({ isActive }) => (
                                <div className={cn(
                                    "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl transition-all duration-300 group px-4 md:px-0 relative liquid-glass-frosted-subtle",
                                    "active:scale-90 font-bold",
                                    isActive
                                        ? "text-white"
                                        : "text-zinc-400 hover:text-white hover:!border-white/15"
                                )}>
                                    {/* Active Indicator Sliding Dot/Bar */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebarActiveIndicator"
                                            className="absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full hidden md:block z-10"
                                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    {/* Active Background Sliding Pill */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebarActiveBackground"
                                            className="absolute inset-0 bg-brand-orange/[0.06] border border-brand-orange/30 rounded-2xl shadow-[0_8px_32px_rgba(255,110,58,0.15)] z-0"
                                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    <span className="shrink-0 z-10">
                                        {item.icon}
                                    </span>
                                    <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">{item.label}</span>
                                </div>
                            )}
                        </Link>
                    </Magnetic>
                ))}

                {/* Queue Toggle Button - Shown conditionally */}
                {playlistQueue.length > 0 && (
                    <Magnetic>
                        <button
                            onClick={() => {
                                setGlobalQueueOpen(!globalQueueOpen)
                                setSidebarOpen(false)
                                playChangeSound()
                            }}
                            title="Cola de Reproducción"
                            className={cn(
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl transition-all duration-500 group px-4 md:px-0 relative liquid-glass-frosted-subtle",
                                globalQueueOpen
                                    ? "text-brand-orange !bg-brand-orange/[0.06] !border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-400 hover:text-white hover:!border-white/15",
                                "active:scale-90 font-bold"
                            )}
                        >
                            {/* Active Indicator Dot */}
                            <div className={cn(
                                "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                                globalQueueOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                            )} />

                            <span className="shrink-0 z-10 relative">
                                <FaLayerGroup className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                {/* Badge count */}
                                <span className="absolute -top-2.5 -right-2.5 bg-brand-orange text-white text-[8px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border border-zinc-950 shadow-md px-[3px]">
                                    {playlistQueue.length}
                                </span>
                            </span>
                            <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">
                                Cola ({playlistQueue.length})
                            </span>
                        </button>
                    </Magnetic>
                )}

                {/* TV Mode Toggle Button */}
                <Magnetic>
                    <button
                        onClick={playTvModeRandom}
                        title="Sintonizar Modo TV (Aleatorio 24h)"
                        disabled={isLoadingTarget}
                        className={cn(
                            "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl transition-all duration-500 group px-4 md:px-0 relative liquid-glass-frosted-subtle",
                            isLoadingTarget
                                ? "!border-brand-orange/40 !bg-brand-orange/[0.06] text-brand-orange cursor-wait"
                                : (isVideoActive && tvMode)
                                    ? "text-brand-orange !bg-brand-orange/[0.06] !border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-400 hover:text-white hover:!border-white/15",
                            "active:scale-90 font-bold"
                        )}
                    >
                        {/* Active Indicator Dot */}
                        <div className={cn(
                            "absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full transition-all duration-500 hidden md:block",
                            (isVideoActive && tvMode) ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                        )} />

                        <span className="shrink-0 z-10 relative">
                            {isLoadingTarget ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <FaBroadcastTower className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                </>
                            )}
                        </span>
                        <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">
                            Modo TV {(isVideoActive && tvMode) ? "(24H)" : ""}
                        </span>
                    </button>
                </Magnetic>
            </nav>

            {/* Footer / Info */}
            <div className="mt-auto pb-6 w-full flex flex-col items-center gap-6 pt-8">
                {/* Background Music */}
                <BackgroundMusicPlayer />

                {/* Random Play */}
                <RandomPlayButton />

                {/* Settings (Always at the bottom) */}
                <Magnetic>
                    <Link
                        to="/settings"
                        title="Configuración"
                        onClick={() => { setSidebarOpen(false); playChangeSound(); }}
                    >
                        {({ isActive }) => (
                            <div className={cn(
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl transition-all duration-300 group px-4 md:px-0 relative liquid-glass-frosted-subtle",
                                "active:scale-90 font-bold",
                                isActive
                                    ? "text-white"
                                    : "text-zinc-400 hover:text-white hover:!border-white/15"
                            )}>
                                {/* Active Indicator Sliding Dot/Bar */}
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebarSettingsIndicator"
                                        className="absolute left-0 w-1 h-6 bg-brand-orange rounded-r-full hidden md:block z-10"
                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                )}
                                {/* Active Background Sliding Pill */}
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebarSettingsBackground"
                                        className="absolute inset-0 bg-brand-orange/[0.06] border border-brand-orange/30 rounded-2xl shadow-[0_8px_32px_rgba(255,110,58,0.15)] z-0"
                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <span className="shrink-0 z-10">
                                    <FaCog className="w-5 h-5 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110" />
                                </span>
                                <span className="md:hidden ml-6 flex-1 uppercase tracking-[0.2em] text-[10px] font-black z-10 text-left transition-colors group-hover:text-brand-orange">Configuración</span>
                            </div>
                        )}
                    </Link>
                </Magnetic>
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
 * Magnetic component using spring physics for a premium hover effect.
 */
function Magnetic({ children }: { children: React.ReactNode }) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [position, setPosition] = React.useState({ x: 0, y: 0 })

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!ref.current) return
        const { clientX, clientY } = e
        const { left, top, width, height } = ref.current.getBoundingClientRect()
        const centerX = left + width / 2
        const centerY = top + height / 2
        const distanceX = clientX - centerX
        const distanceY = clientY - centerY
        // Attract toward cursor up to a maximum strength
        setPosition({ x: distanceX * 0.35, y: distanceY * 0.3 })
    }

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 })
    }

    const springConfig = { type: "spring", stiffness: 150, damping: 15, mass: 0.1 } as const

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            animate={{ x: position.x, y: position.y }}
            transition={springConfig}
            className="w-full flex justify-center"
        >
            {children}
        </motion.div>
    )
}

