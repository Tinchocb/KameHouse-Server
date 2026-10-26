import { IconUiSpinner, IconNavigationTv, IconUiClose, IconMediaClapperboard } from "@/components/ui/icons";

import * as React from "react"
import { m, AnimatePresence } from "framer-motion"

import { toast } from "sonner"

import { cn } from "@/components/ui/core/styling"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
import { useSound } from "@/hooks/use-sound"
import { LoadSwap, useSpringPreset } from "@/components/ui/kinetics"
import { useMinWidth } from "@/components/ui/app-layout/use-nav-compact"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { useAppStore, usePlayerStore, useQueueStore, useUIStore, PlaylistItem } from "@/lib/store"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"

// ─── Component ────────────────────────────────────────────────────────────────

export function RandomPlayButton({ modalOnly = false }: { modalOnly?: boolean } = {}) {
    const { playSound } = useSound()
    const [showPicker, setShowPicker] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState<"movie" | "episode" | false>(false)
    // La escala de hover solo desde `sm`: en celular el hover de framer queda pegado tras el toque.
    // La pulsación (whileTap) sigue activa en todos los tamaños.
    const canHoverScale = useMinWidth(640)
    // Resorte del diálogo (preset "selector"): antes estaba escrito a mano en el motion.div del modal.
    const selectorSpring = useSpringPreset("selector")
    const tvMode = useAppStore(state => state.tvMode)
    const setTvMode = usePlayerStore(state => state.setTvMode)

    const { data: collection } = useGetLibraryCollection()

    const modalRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)

    const operationRef = React.useRef(0)
    const pickingRef = React.useRef(false)
    const pickerOpenRef = React.useRef(false)
    const closePicker = React.useCallback(() => {
        pickerOpenRef.current = false
        operationRef.current += 1
        pickingRef.current = false
        setIsLoading(false)
        setShowPicker(false)
    }, [])
    const openPicker = React.useCallback(() => {
        pickerOpenRef.current = true
        operationRef.current += 1
        pickingRef.current = false
        setIsLoading(false)
        setShowPicker(true)
    }, [])
    React.useEffect(() => () => {
        pickerOpenRef.current = false
        operationRef.current += 1
    }, [])

    // All library entries flattened (sin huecos nulos del backend)
    const allEntries = React.useMemo(() => {
        return getSafeCollectionEntries(collection)
    }, [collection])

    const playRandomSound = React.useCallback(() => {
        playSound("random", 0.5)
    }, [playSound])

    // Focus management: trampa de foco canónica (lleva el foco adentro y lo devuelve al cerrar)
    useFocusTrap(modalRef, showPicker)

    // Keyboard navigation (ESC to close) & custom event listener
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showPicker) return
            if (e.key === "Escape") {
                closePicker()
            }
        }
        const handleOpenPicker = () => {
            openPicker()
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("open-random-picker", handleOpenPicker)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("open-random-picker", handleOpenPicker)
        }
    }, [showPicker, closePicker, openPicker])

    const pick = async (type: "movie" | "episode") => {
        if (!pickerOpenRef.current || pickingRef.current) return
        pickingRef.current = true
        const operation = ++operationRef.current
        playRandomSound()
        setIsLoading(type)

        try {
            const isMovie = type === "movie"

            // ── 1. Filter candidates from collection ───────────────────────
            const MOVIE_FORMATS = ["MOVIE", "OVA", "SPECIAL"]
            const candidates = allEntries.filter(e => {
                if (!e || !e?.media || (e.libraryData?.mainFileCount ?? 0) === 0) return false
                const fmt = e?.media?.format || ""
                return isMovie ? MOVIE_FORMATS.includes(fmt) : fmt === "TV"
            })

            if (candidates.length === 0) {
                toast.error(isMovie ? "No hay películas en tu biblioteca" : "No hay series en tu biblioteca", {
                    description: "Escanea la biblioteca desde Ajustes para añadirlas.",
                })
                setIsLoading(false)
                return
            }

            // ── 2. Pick a random candidate ─────────────────────────────────
            const randomEntry = candidates[Math.floor(Math.random() * candidates.length)]

            // ── 3. Fetch full entry to get local file paths ────────────────
            const localFiles = await fetchAnimeEntryLocalFiles(randomEntry.mediaId)
            if (operation !== operationRef.current) return

            if (!localFiles || localFiles.length === 0) {
                toast.error("No se encontraron archivos de este título", {
                    description: "Revisa que la carpeta esté disponible e inténtalo de nuevo.",
                })
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
                    toast.error("El archivo no está disponible", { description: "Revisa que la carpeta esté disponible e inténtalo de nuevo." })
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
                    toast.error("El archivo no está disponible", { description: "Revisa que la carpeta esté disponible e inténtalo de nuevo." })
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
            pickerOpenRef.current = false
            setShowPicker(false)

            useQueueStore.setState({
                playlistQueue: newQueue,
                currentQueueIndex: 0,
                activeQueuePlayItem: activeItem,
            })
            useUIStore.getState().setGlobalQueueOpen(false)

            setTvMode(true)

            toast.success(isMovie ? "Película al azar en modo TV" : "Serie al azar en modo TV", {
                description: `${seriesTitle}${!isMovie ? ` · ep. ${activeItem.episodeNumber}` : ""}`,
                duration: 3000,
            })
        } catch (err) {
            if (operation !== operationRef.current) return
            console.error("[RandomPlay] error:", err)
            toast.error("No se pudo elegir algo al azar", { description: "Inténtalo de nuevo." })
        } finally {
            if (operation === operationRef.current) {
                pickingRef.current = false
                setIsLoading(false)
            }
        }
    }

    return (
        <>
            {/* ─── Hero Trigger Button (Sidebar / Footer) ─────────────────── */}
            {!modalOnly && (
                <div className="w-full flex justify-center">
                    <m.button
                        ref={triggerRef}
                        id="random-play-btn"
                        disabled={Boolean(isLoading)}
                        title="Sorpréndeme"
                        aria-label="Sorpréndeme"
                        onClick={() => {
                            playRandomSound()
                            openPicker()
                        }}
                        whileHover={canHoverScale ? { scale: 1.02 } : undefined}
                        whileTap={{ scale: 0.96 }}
                        className={cn(
                            "group relative flex items-center rounded-2xl transition-[width,height,padding,gap,background-color,border-color,color,box-shadow,transform] duration-base ease-smooth-out w-full outline-none overflow-hidden",
                            "border shadow-elevation-2",
                            "h-14 md:w-14 w-full justify-center px-0",
                            tvMode || showPicker
                                ? "bg-brand-accent/20 border-brand-accent/50 text-on-surface shadow-brand-accent/20"
                                : "bg-white/[0.04] border-white/[0.08] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.08] text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface"
                        )}
                    >
                        {/* Glowing background hint */}
                        <div className={cn(
                            "absolute inset-0 bg-gradient-to-r from-brand-accent/20 via-transparent to-transparent opacity-0 transition-opacity duration-base ease-smooth-out pointer-events-none",
                            (tvMode || showPicker) ? "opacity-100" : "group-hover:opacity-100"
                        )} />

                        {/* Active vertical bar indicator */}
                        <div className={cn(
                            "absolute left-0 w-1.5 h-8 bg-brand-accent rounded-r-full transition-[transform,opacity] duration-base ease-smooth-out hidden md:block",
                            (tvMode || showPicker) ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                        )} />
                        
                        {/* Icon with glowing badge */}
                        <div className={cn(
                            "relative shrink-0 z-10 flex items-center justify-center rounded-xl transition-[background-color,color,transform,box-shadow] duration-fast ease-out-strong w-10 h-10",
                            (tvMode || showPicker)
                                ? "bg-brand-accent text-on-primary shadow-brand-primary scale-105"
                                : "bg-white/[0.06] group-hover:bg-brand-accent/20 group-hover:text-brand-accent text-on-surface-variant"
                        )}>
                            <LoadSwap
                                loading={Boolean(isLoading)}
                                skeleton={<IconUiSpinner className="w-5 h-5 animate-spin" />}
                            >
                                <IconNavigationTv className="w-5 h-5 transition-transform duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105" />
                            </LoadSwap>
                        </div>
                        
                        {/* Text Label */}
                        <div className="z-10 flex flex-col text-left transition-colors duration-fast ease-out-strong whitespace-nowrap overflow-hidden hidden md:hidden">
                            <span className="text-label-md font-bold text-on-surface leading-tight">
                                Sorpréndeme
                            </span>
                            <span className="text-3xs font-medium text-label-2">
                                {tvMode ? "Modo TV activado" : "Algo al azar"}
                            </span>
                        </div>
                    </m.button>
                </div>
            )}

            {/* ─── Full-Screen Blurred Modal Overlay (Framer Motion) ─────────────── */}
            <AnimatePresence>
                {showPicker && (
                    <div className="fixed inset-0 z-modal pointer-events-auto flex items-end sm:items-center justify-center p-4 md:p-6">
                        {/* Backdrop Blur Overlay */}
                        <m.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={closePicker}
                            className="absolute inset-0 bg-black/65 backdrop-blur-overlay-xs pointer-events-auto cursor-pointer"
                        />

                        {/* Modal Container — Animated from Bottom */}
                        <m.div
                            ref={modalRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="tv-mode-dialog-title"
                            initial={{ opacity: 0, y: 100, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 80, scale: 0.95 }}
                            transition={selectorSpring}
                            className={cn(
                                "glass-frosted relative z-10 w-full max-w-2xl flex flex-col rounded-3xl overflow-hidden pointer-events-auto text-on-surface"
                            )}
                        >
                            {/* Top Ambient Glow */}
                            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-accent/15 to-transparent pointer-events-none" />

                            {/* Header */}
                            <div className="relative flex items-center justify-between p-6 md:p-8 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 rounded-2xl bg-brand-accent/15 border border-brand-accent/30 text-brand-accent shadow-brand-primary">
                                        <IconNavigationTv className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 id="tv-mode-dialog-title" className="text-2xl md:text-3xl font-black tracking-tight text-on-surface text-balance">
                                            Sorpréndeme
                                        </h2>
                                        <p className="text-xs md:text-sm text-label-2 font-medium text-pretty">
                                            Elige qué quieres ver. Empezamos con algo al azar de tu biblioteca, en modo TV.
                                        </p>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        closePicker()
                                    }}
                                    className="p-2.5 rounded-xl bg-white/[0.05] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.1] border border-white/15 border-t-white/30 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface transition-[background-color,border-color,color,transform] duration-fast ease-smooth-out active:scale-95 outline-none pointer-events-auto cursor-pointer shadow-glass-highlight-md"
                                    title="Cerrar (Esc)"
                                    aria-label="Cerrar"
                                >
                                    <IconUiClose className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/10 mx-6 md:mx-8" />

                            {/* Hero Cards Container */}
                            <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                {/* Option 1: Series / Episodes */}
                                <m.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("episode")}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-[background-color,border-color,box-shadow] duration-base ease-smooth-out outline-none pointer-events-auto cursor-pointer",
                                        "surface-content surface-content-row [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/70",
                                        "shadow-glass-highlight-md [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-brand-accent/15",
                                        isLoading === "episode" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                     <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-accent/15 border border-brand-accent/30 text-brand-accent flex items-center justify-center transition-transform duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 shadow-md shadow-brand-accent/20">
                                            <LoadSwap
                                                loading={isLoading === "episode"}
                                                skeleton={<IconUiSpinner className="w-6 h-6 animate-spin text-brand-accent" />}
                                            >
                                                <IconNavigationTv className="w-7 h-7" />
                                            </LoadSwap>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-white/[0.06] group-hover:bg-brand-accent/20 text-on-surface-variant group-hover:text-brand-accent-readable text-2xs font-semibold transition-colors border border-white/10 group-hover:border-brand-accent/30">
                                            Maratón
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-on-surface group-hover:text-brand-accent-readable transition-colors">
                                        Series
                                    </h3>
                                    <p className="text-xs text-label-2 mt-1 leading-relaxed font-medium">
                                        Empieza un maratón con una serie al azar.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-accent-readable group-hover:translate-x-1 transition-transform">
                                        <span>Ver una serie</span>
                                        <span aria-hidden="true">›</span>
                                    </div>
                                </m.button>

                                {/* Option 2: Movies */}
                                <m.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("movie")}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-[background-color,border-color,box-shadow] duration-base ease-smooth-out outline-none pointer-events-auto cursor-pointer",
                                        "surface-content surface-content-row [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/70 [@media(hover:hover)_and_(pointer:fine)]:hover:border-brand-secondary/60",
                                        "shadow-glass-highlight-md [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-brand-secondary/15",
                                        isLoading === "movie" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-secondary/15 border border-brand-secondary/30 text-brand-secondary flex items-center justify-center transition-transform duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 shadow-md shadow-brand-secondary/20">
                                            <LoadSwap
                                                loading={isLoading === "movie"}
                                                skeleton={<IconUiSpinner className="w-6 h-6 animate-spin text-brand-secondary" />}
                                            >
                                                <IconMediaClapperboard className="w-7 h-7" />
                                            </LoadSwap>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-white/[0.06] group-hover:bg-brand-secondary/20 text-on-surface-variant group-hover:text-brand-secondary text-2xs font-semibold transition-colors border border-white/10 group-hover:border-brand-secondary/30">
                                            Cine
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-on-surface group-hover:text-brand-secondary transition-colors">
                                        Películas
                                    </h3>
                                    <p className="text-xs text-label-2 mt-1 leading-relaxed font-medium">
                                        Reproduce una película, OVA o especial al azar.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-secondary group-hover:translate-x-1 transition-transform">
                                        <span>Ver una película</span>
                                        <span aria-hidden="true">›</span>
                                    </div>
                                </m.button>
                            </div>

                            {/* Footer info note */}
                            <div className="px-6 md:px-8 pb-6 text-center">
                                <p className="text-2xs text-label-2 font-medium">
                                    Pulsa <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-on-surface text-3xs font-mono">Esc</kbd> o haz clic afuera para salir
                                </p>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

