import { IconUiSpinner, IconNavigationTv, IconUiClose, IconMediaClapperboard } from "@/components/ui/icons";

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

import { toast } from "sonner"

import { cn } from "@/components/ui/core/styling"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
import { useSound } from "@/hooks/use-sound"
import { useAppStore, PlaylistItem } from "@/lib/store"

// ─── Component ────────────────────────────────────────────────────────────────

export function RandomPlayButton({ modalOnly = false }: { modalOnly?: boolean } = {}) {
    const { playSound } = useSound()
    const [showPicker, setShowPicker] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState<"movie" | "episode" | false>(false)
    const tvMode = useAppStore(state => state.tvMode)
    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const setTvMode = useAppStore(state => state.setTvMode)

    const { data: collection } = useGetLibraryCollection()

    // All library entries flattened
    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const playRandomSound = React.useCallback(() => {
        playSound("random", 0.5)
    }, [playSound])

    // Keyboard navigation (ESC to close) & custom event listener
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && showPicker) {
                setShowPicker(false)
            }
        }
        const handleOpenPicker = () => setShowPicker(true)

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("open-random-picker", handleOpenPicker)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("open-random-picker", handleOpenPicker)
        }
    }, [showPicker])

    const pick = async (type: "movie" | "episode") => {
        playRandomSound()
        setIsLoading(type)

        try {
            const isMovie = type === "movie"

            // ── 1. Filter candidates from collection ───────────────────────
            const MOVIE_FORMATS = ["MOVIE", "OVA", "SPECIAL"]
            const candidates = allEntries.filter(e => {
                if (!e?.media || (e.libraryData?.mainFileCount ?? 0) === 0) return false
                const fmt = e.media.format || ""
                return isMovie ? MOVIE_FORMATS.includes(fmt) : fmt === "TV"
            })

            if (candidates.length === 0) {
                toast.error(isMovie ? "No hay películas en tu biblioteca" : "No hay series en tu biblioteca")
                setIsLoading(false)
                return
            }

            // ── 2. Pick a random candidate ─────────────────────────────────
            const randomEntry = candidates[Math.floor(Math.random() * candidates.length)]

            // ── 3. Fetch full entry to get local file paths ────────────────
            const localFiles = await fetchAnimeEntryLocalFiles(randomEntry.mediaId)

            if (!localFiles || localFiles.length === 0) {
                toast.error("No se encontraron archivos locales para reproducir")
                setIsLoading(false)
                return
            }

            // ── 4. Choose files and populate queue ─────────────────────────
            const sortedLocalFiles = [...localFiles].sort((a, b) => {
                const rawA = a.metadata?.episode ?? a.parsedInfo?.episode ?? 1
                const rawB = b.metadata?.episode ?? b.parsedInfo?.episode ?? 1
                const numA = Number.isFinite(Number(rawA)) ? Number(rawA) : 1
                const numB = Number.isFinite(Number(rawB)) ? Number(rawB) : 1
                return numA - numB
            })

            const seriesTitle =
                randomEntry.media?.titleSpanish ||
                randomEntry.media?.titleRomaji ||
                randomEntry.media?.titleEnglish ||
                "Sin título"
                
            let newQueue: PlaylistItem[] = []
            let activeItem: PlaylistItem | null = null

            if (isMovie) {
                const selectedFile = sortedLocalFiles[0]
                if (!selectedFile?.path) {
                    toast.error("Archivo no disponible")
                    setIsLoading(false)
                    return
                }
                const epNum = selectedFile.metadata?.episode || Number(selectedFile.parsedInfo?.episode) || 1
                activeItem = {
                    id: String(selectedFile.path),
                    title: seriesTitle,
                    playableUrl: selectedFile.path,
                    episodeNumber: Number(epNum),
                    mediaId: randomEntry.mediaId,
                    malId: randomEntry.media?.idMal ?? null,
                    mediaFormat: randomEntry.media?.format,
                    subtitle: "Película"
                }
                newQueue = [activeItem]
            } else {
                if (sortedLocalFiles.length === 0 || !sortedLocalFiles[0]?.path) {
                    toast.error("Archivo no disponible")
                    setIsLoading(false)
                    return
                }
                
                // Pick a random episode as starting point
                const startIdx = Math.floor(Math.random() * sortedLocalFiles.length)
                
                // Add from startIdx to the end
                for (let i = startIdx; i < sortedLocalFiles.length; i++) {
                    const file = sortedLocalFiles[i]
                    if (!file.path) continue
                    const epNum = file.metadata?.episode || Number(file.parsedInfo?.episode) || 1
                    const item: PlaylistItem = {
                        id: String(file.path),
                        title: seriesTitle,
                        playableUrl: file.path,
                        episodeNumber: Number(epNum),
                        mediaId: randomEntry.mediaId,
                        malId: randomEntry.media?.idMal ?? null,
                        mediaFormat: randomEntry.media?.format,
                        subtitle: `Episodio ${epNum}`
                    }
                    newQueue.push(item)
                    if (i === startIdx) {
                        activeItem = item
                    }
                }
            }
            
            if (!activeItem) {
                setIsLoading(false)
                return
            }

            // Close full-screen modal
            setShowPicker(false)

            useAppStore.setState({
                playlistQueue: newQueue,
                currentQueueIndex: 0,
                activeQueuePlayItem: activeItem,
                globalQueueOpen: false
            })

            setTvMode(true)

            toast.success(`📺 Modo TV ${isMovie ? "Películas" : "Series"} iniciado`, {
                description: `${seriesTitle}${!isMovie ? ` — Ep. ${activeItem.episodeNumber}` : ""}`,
                duration: 3000,
            })
        } catch (err) {
            console.error("[RandomPlay] error:", err)
            toast.error("Ocurrió un error al seleccionar el contenido")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            {/* ─── Hero Trigger Button (Sidebar / Footer) ─────────────────── */}
            {!modalOnly && (
                <div className="w-full flex justify-center">
                    <motion.button
                        id="random-play-btn"
                        disabled={Boolean(isLoading)}
                        title="Modo TV Leanback"
                        onClick={() => {
                            playRandomSound()
                            setShowPicker(true)
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        className={cn(
                            "group relative flex items-center rounded-2xl transition-all duration-300 w-full outline-none overflow-hidden",
                            "border shadow-elevation-2",
                            sidebarOpen ? "h-16 px-4 justify-start gap-3.5" : "h-14 md:w-14 w-full justify-center px-0",
                            tvMode || showPicker
                                ? "bg-brand-accent/20 border-brand-accent/50 text-on-surface shadow-brand-accent/20"
                                : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-brand-accent/40 text-on-surface-variant hover:text-on-surface"
                        )}
                    >
                        {/* Glowing background hint */}
                        <div className={cn(
                            "absolute inset-0 bg-gradient-to-r from-brand-accent/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 pointer-events-none",
                            (tvMode || showPicker) ? "opacity-100" : "group-hover:opacity-100"
                        )} />

                        {/* Active vertical bar indicator */}
                        <div className={cn(
                            "absolute left-0 w-1.5 h-8 bg-brand-accent rounded-r-full transition-all duration-300 hidden md:block",
                            (tvMode || showPicker) ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                        )} />
                        
                        {/* Icon with glowing badge */}
                        <div className={cn(
                            "relative shrink-0 z-10 flex items-center justify-center rounded-xl transition-all duration-300",
                            sidebarOpen ? "w-10 h-10" : "w-10 h-10",
                            (tvMode || showPicker)
                                ? "bg-brand-accent text-on-primary shadow-lg shadow-brand-accent/40 scale-105"
                                : "bg-white/[0.06] group-hover:bg-brand-accent/20 group-hover:text-brand-accent text-on-surface-variant"
                        )}>
                            {isLoading ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <IconUiSpinner className="w-5 h-5" />
                                </motion.div>
                            ) : (
                                <IconNavigationTv className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                            )}
                        </div>
                        
                        {/* Text Label */}
                        <div className={cn(
                            "z-10 flex flex-col text-left transition-all duration-300 whitespace-nowrap overflow-hidden",
                            sidebarOpen ? "block" : "hidden md:hidden"
                        )}>
                            <span className="uppercase tracking-ultra text-label-md font-black text-on-surface leading-tight">
                                Modo TV
                            </span>
                            <span className="text-[10px] font-bold text-on-surface-variant/70 tracking-wider uppercase">
                                {tvMode ? "Activado" : "Leanback / Maratón"}
                            </span>
                        </div>

                        {/* Badge Pill for TV Mode active state */}
                        {tvMode && sidebarOpen && (
                            <div className="ml-auto z-10 px-2 py-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent text-[9px] font-black uppercase tracking-widest">
                                ON
                            </div>
                        )}
                    </motion.button>
                </div>
            )}

            {/* ─── Full-Screen Blurred Modal Overlay (Framer Motion) ─────────────── */}
            <AnimatePresence>
                {showPicker && (
                    <div className="fixed inset-0 z-modal pointer-events-auto flex items-end sm:items-center justify-center p-4 md:p-6">
                        {/* Backdrop Blur Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={() => setShowPicker(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-overlay-2xl pointer-events-auto cursor-pointer"
                        />

                        {/* Modal Container — Animated from Bottom */}
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            initial={{ opacity: 0, y: 100, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 80, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 350, damping: 26 }}
                            className={cn(
                                "relative z-10 w-full max-w-2xl flex flex-col rounded-3xl overflow-hidden shadow-2xl pointer-events-auto",
                                "bg-zinc-950/85 backdrop-blur-overlay-2xl border border-white/20 border-t-white/40 border-b-white/10 text-on-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_24px_48px_rgba(0,0,0,0.9)]"
                            )}
                        >
                            {/* Top Ambient Glow */}
                            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-accent/15 to-transparent pointer-events-none" />

                            {/* Header */}
                            <div className="relative flex items-center justify-between p-6 md:p-8 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 rounded-2xl bg-brand-accent/15 border border-brand-accent/30 text-brand-accent shadow-lg shadow-brand-primary">
                                        <IconNavigationTv className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-brand-accent/20 text-brand-accent text-caption font-black uppercase tracking-widest border border-brand-accent/30">
                                                Leanback Experience
                                            </span>
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-on-surface mt-1">
                                            Modo TV
                                        </h2>
                                        <p className="text-xs md:text-sm text-on-surface-variant/80 font-medium">
                                            Selecciona la modalidad para iniciar la reproducción inmersiva aleatoria
                                        </p>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowPicker(false)
                                    }}
                                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 border-t-white/30 text-on-surface-variant hover:text-on-surface transition-all duration-200 active:scale-95 outline-none pointer-events-auto cursor-pointer shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)]"
                                    title="Cerrar (ESC)"
                                >
                                    <IconUiClose className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/10 mx-6 md:mx-8" />

                            {/* Hero Cards Container */}
                            <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                {/* Option 1: Series / Episodes */}
                                <motion.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("episode")}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-all duration-300 outline-none pointer-events-auto cursor-pointer",
                                        "bg-zinc-950/50 hover:bg-zinc-900/70 border border-white/15 hover:border-brand-accent/60 border-t-white/35",
                                        "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15)] hover:shadow-brand-accent/15",
                                        isLoading === "episode" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-accent/15 border border-brand-accent/30 text-brand-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-md shadow-brand-accent/20">
                                            {isLoading === "episode" ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                >
                                                    <IconUiSpinner className="w-6 h-6" />
                                                </motion.div>
                                            ) : (
                                                <IconNavigationTv className="w-7 h-7" />
                                            )}
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-white/[0.06] group-hover:bg-brand-accent/20 text-on-surface-variant group-hover:text-brand-accent text-[10px] font-black uppercase tracking-widest transition-colors border border-white/10 group-hover:border-brand-accent/30">
                                            Maratón
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-black uppercase tracking-wide text-on-surface group-hover:text-brand-accent transition-colors">
                                        Series
                                    </h3>
                                    <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed font-medium">
                                        Inicia un maratón continuado de episodios de anime seleccionando una serie al azar.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-accent group-hover:translate-x-1 transition-transform">
                                        <span>Iniciar Series</span>
                                        <span>›</span>
                                    </div>
                                </motion.button>

                                {/* Option 2: Movies */}
                                <motion.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("movie")}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-all duration-300 outline-none pointer-events-auto cursor-pointer",
                                        "bg-zinc-950/50 hover:bg-zinc-900/70 border border-white/15 hover:border-brand-secondary/60 border-t-white/35",
                                        "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15)] hover:shadow-brand-secondary/15",
                                        isLoading === "movie" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-secondary/15 border border-brand-secondary/30 text-brand-secondary flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-md shadow-brand-secondary/20">
                                            {isLoading === "movie" ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                >
                                                    <IconUiSpinner className="w-6 h-6" />
                                                </motion.div>
                                            ) : (
                                                <IconMediaClapperboard className="w-7 h-7" />
                                            )}
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-white/[0.06] group-hover:bg-brand-secondary/20 text-on-surface-variant group-hover:text-brand-secondary text-[10px] font-black uppercase tracking-widest transition-colors border border-white/10 group-hover:border-brand-secondary/30">
                                            Cine
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-black uppercase tracking-wide text-on-surface group-hover:text-brand-secondary transition-colors">
                                        Películas
                                    </h3>
                                    <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed font-medium">
                                        Reproduce un largometraje, OVA o especial al azar directo desde tu biblioteca.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-secondary group-hover:translate-x-1 transition-transform">
                                        <span>Iniciar Cine</span>
                                        <span>›</span>
                                    </div>
                                </motion.button>
                            </div>

                            {/* Footer info note */}
                            <div className="px-6 md:px-8 pb-6 text-center">
                                <p className="text-[11px] text-on-surface-variant/60 font-medium">
                                    Presiona <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-on-surface text-[10px] font-mono">ESC</kbd> o haz clic afuera para salir
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

