import { persistLibraryPatch } from "@/lib/server/persist-settings"
import { IconUiSpinner, IconNavigationTv, IconUiClose, IconMediaClapperboard } from "@/components/ui/icons";

import * as React from "react"
import { m, AnimatePresence, useIsPresent } from "framer-motion"

import { toast } from "sonner"

import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
import { useSound } from "@/hooks/use-sound"
import { LoadSwap, useReducedMotion, useSpringPreset } from "@/components/ui/kinetics"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { usePlayerStore, useQueueStore, useUIStore, PlaylistItem } from "@/lib/store"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"

// ─── Component ────────────────────────────────────────────────────────────────

function PickerLayer({ children }: { children: React.ReactNode }) {
    const isPresent = useIsPresent()
    return (
        <div inert={!isPresent} aria-hidden={!isPresent || undefined}
            className={cn("fixed inset-0 z-modal flex items-center justify-center p-4 md:p-6", isPresent ? "pointer-events-auto" : "pointer-events-none")}>
            {children}
        </div>
    )
}

export function RandomPlayButton() {
    const { playSound } = useSound()
    const [showPicker, setShowPicker] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState<"movie" | "episode" | false>(false)
    // Hover solo con ratón; el ancho de pantalla no identifica dispositivos táctiles.
    const canHoverScale = useMediaQuery("(hover: hover) and (pointer: fine)")
    // El diálogo comparte la entrada gradual de las superficies grandes.
    const reduceMotion = useReducedMotion()
    const pressSpring = useSpringPreset("press")
    const setMarathonMode = usePlayerStore(state => state.setMarathonMode)

    const { data: collection } = useGetLibraryCollection({ enabled: showPicker })

    const modalRef = React.useRef<HTMLDivElement>(null)

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

    // All library entries flattened (solo se deriva al abrir el selector)
    const allEntries = React.useMemo(() => {
        if (!showPicker) return []
        return getSafeCollectionEntries(collection)
    }, [collection, showPicker])

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

            setMarathonMode(true)
            persistLibraryPatch({ marathonMode: true })

            toast.success(isMovie ? "Película al azar en modo maratón" : "Serie al azar en modo maratón", {
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
            {/* ─── Full-Screen Blurred Modal Overlay (Framer Motion) ─────────────── */}
            <AnimatePresence>
                {showPicker && (
                    <PickerLayer>
                        {/* Backdrop Overlay (sin blur duplicado debajo de .glass-frosted) */}
                        <m.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={closePicker}
                            className="absolute inset-0 bg-black/65 pointer-events-auto cursor-pointer"
                        />

                        {/* Modal Container — Animated from Bottom */}
                        <m.div
                            ref={modalRef}
                            role="dialog"
                                data-liquid-surface="panel"
                            aria-modal="true"
                            aria-labelledby="random-play-dialog-title"
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 0, scale: 1, transition: { duration: 0.15, ease: "easeInOut" } }}
                            transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: "easeInOut" }}
                            className={cn(
                                "glass-frosted relative z-10 w-full max-w-2xl flex flex-col rounded-3xl overflow-hidden pointer-events-auto text-on-surface border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow-strong)]"
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
                                        <h2 id="random-play-dialog-title" className="text-2xl md:text-3xl font-black tracking-tight text-on-surface text-balance">
                                            Sorpréndeme
                                        </h2>
                                        <p className="text-xs md:text-sm text-label-2 font-medium text-pretty">
                                            Elige qué quieres ver. Empezamos con algo al azar de tu biblioteca, en modo maratón.
                                        </p>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <IconButton
                                    intent="secondary"
                                    size="md"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        closePicker()
                                    }}
                                    className="pointer-events-auto"
                                    title="Cerrar (Esc)"
                                    aria-label="Cerrar"
                                    icon={<IconUiClose className="w-5 h-5" />}
                                />
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[var(--neutral-separator)] mx-6 md:mx-8" />

                            {/* Hero Cards Container */}
                            <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                {/* Option 1: Series / Episodes */}
                                <m.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("episode")}
                                    whileHover={canHoverScale && !reduceMotion ? { y: -3 } : undefined}
                                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                    transition={pressSpring}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-[background-color,border-color,box-shadow] duration-base ease-smooth-out outline-none pointer-events-auto cursor-pointer",
                                        "surface-content surface-content-row border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/70",
                                        "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-brand-accent/15",
                                        isLoading === "episode" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                     <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-accent/15 border border-brand-accent/30 text-brand-accent flex items-center justify-center transition-transform duration-fast ease-out-strong motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 shadow-[shadow:var(--double-bezel-ring)]">
                                            <LoadSwap
                                                loading={isLoading === "episode"}
                                                skeleton={<IconUiSpinner className="w-6 h-6 animate-spin text-brand-accent" />}
                                            >
                                                <IconNavigationTv className="w-7 h-7" />
                                            </LoadSwap>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-[var(--neutral-elev-2)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-brand-accent/20 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent-readable text-2xs font-semibold transition-colors border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-brand-accent/30">
                                            Maratón
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent-readable transition-colors">
                                        Series
                                    </h3>
                                    <p className="text-xs text-label-2 mt-1 leading-relaxed font-medium">
                                        Empieza un maratón con una serie al azar.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-accent-readable motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1 transition-transform">
                                        <span>Ver una serie</span>
                                        <span aria-hidden="true">›</span>
                                    </div>
                                </m.button>

                                {/* Option 2: Movies */}
                                <m.button
                                    type="button"
                                    disabled={Boolean(isLoading)}
                                    onClick={() => pick("movie")}
                                    whileHover={canHoverScale && !reduceMotion ? { y: -3 } : undefined}
                                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                    transition={pressSpring}
                                    className={cn(
                                        "group relative flex flex-col p-6 rounded-2xl text-left transition-[background-color,border-color,box-shadow] duration-base ease-smooth-out outline-none pointer-events-auto cursor-pointer",
                                        "surface-content surface-content-row border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/70 [@media(hover:hover)_and_(pointer:fine)]:hover:border-brand-secondary/60",
                                        "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-brand-secondary/15",
                                        isLoading === "movie" && "opacity-75 pointer-events-none"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-secondary/15 border border-brand-secondary/30 text-brand-secondary flex items-center justify-center transition-transform duration-fast ease-out-strong motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 shadow-[shadow:var(--double-bezel-ring)]">
                                            <LoadSwap
                                                loading={isLoading === "movie"}
                                                skeleton={<IconUiSpinner className="w-6 h-6 animate-spin text-brand-secondary" />}
                                            >
                                                <IconMediaClapperboard className="w-7 h-7" />
                                            </LoadSwap>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-[var(--neutral-elev-2)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-brand-secondary/20 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-secondary text-2xs font-semibold transition-colors border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-brand-secondary/30">
                                            Cine
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-secondary transition-colors">
                                        Películas
                                    </h3>
                                    <p className="text-xs text-label-2 mt-1 leading-relaxed font-medium">
                                        Reproduce una película, OVA o especial al azar.
                                    </p>

                                    <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-secondary motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1 transition-transform">
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
                    </PickerLayer>
                )}
            </AnimatePresence>
        </>
    )
}

