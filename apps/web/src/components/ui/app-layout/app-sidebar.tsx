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
import { BackgroundMusicPlayer } from "./background-music"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
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
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768) // 768px is the 'md' breakpoint
        }
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    if (isFullscreen) return null

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside className="hidden md:flex flex-col shrink-0 h-full w-24 border-r border-white/5 bg-zinc-950/40 backdrop-blur-[64px] z-50">
                <SidebarContent setSidebarOpen={setSidebarOpen} />
            </aside>

            {/* Mobile Drawer */}
            {isMobile && (
                <Vaul open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
                    <VaulContent
                        className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-white/5 bg-zinc-950/60 backdrop-blur-[64px] shadow-2xl"
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
            const fullEntry = await fetchAnimeEntry(randomEntry.mediaId)
            const localFiles = (fullEntry?.localFiles ?? []).filter(f => !!f.path)

            if (localFiles.length === 0) {
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
            const fullEntry = await fetchAnimeEntry(currentMediaId)
            const localFiles = (fullEntry?.localFiles ?? []).filter(f => !!f.path)

            if (localFiles.length === 0) {
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
                const seriesTitle =
                    fullEntry?.media?.titleSpanish ||
                    fullEntry?.media?.titleRomaji ||
                    fullEntry?.media?.titleEnglish ||
                    "Sin título"

                setPlayTarget({
                    path: nextFile.path,
                    streamType: isMp4 ? "direct" : "transcode",
                    title: seriesTitle,
                    episodeLabel: `Episodio ${nextEpNum}`,
                    episodeNumber: nextEpNum,
                    mediaId: currentMediaId,
                    malId: fullEntry?.media?.idMal ?? null,
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
        <div className="flex flex-col h-full py-10 px-4 md:px-0 w-full items-center bg-transparent">
            {/* Header / Logo */}
            <div className="mb-14 px-2 flex justify-center group cursor-pointer" onClick={() => { setSidebarOpen(false); playChangeSound(); }}>
                <div className="relative">
                    <img 
                        src="/kamehouse-logo.png" 
                        alt="KameHouse" 
                        className="h-10 w-10 shrink-0 object-contain group-hover:scale-110 transition-transform duration-500" 
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
                                    "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-300 group px-4 md:px-0 relative backdrop-blur-md",
                                    "active:scale-90 font-bold",
                                    isActive 
                                        ? "text-white border-transparent" 
                                        : "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent"
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
                                            className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-0"
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
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative backdrop-blur-md",
                                globalQueueOpen
                                    ? "text-brand-orange bg-brand-orange/10 border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]"
                                    : "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
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
                                <span className="absolute -top-2.5 -right-2.5 bg-brand-orange text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-zinc-950 shadow-md">
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
                            "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-500 group px-4 md:px-0 relative backdrop-blur-md",
                            isLoadingTarget
                                ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange cursor-wait"
                                : (isVideoActive && tvMode)
                                    ? "text-brand-orange bg-brand-orange/10 border-brand-orange/30"
                                    : "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent",
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
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Loader2 className="w-5 h-5" />
                                </motion.div>
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
                                "flex items-center justify-center md:w-14 w-full h-14 rounded-2xl border transition-all duration-300 group px-4 md:px-0 relative backdrop-blur-md",
                                "active:scale-90 font-bold",
                                isActive 
                                    ? "text-white border-transparent" 
                                    : "text-zinc-500 hover:text-white hover:bg-white/[0.02] border-transparent"
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
                                        className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-0"
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
 * Magnetic component (disabled to remove physical hover effect).
 */
function Magnetic({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

