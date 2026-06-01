"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Dices, Clapperboard, Tv, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/components/ui/core/styling"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { VideoPlayer } from "@/components/video/player"
import { useSound } from "@/hooks/use-sound"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayTarget {
    path: string
    streamType: "direct" | "transcode"
    title: string
    episodeLabel: string
    episodeNumber: number
    mediaId: number
    malId?: number | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RandomPlayButton() {
    const { playSound } = useSound()
    const [showPicker, setShowPicker] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [playTarget, setPlayTarget] = React.useState<PlayTarget | null>(null)
    const btnRef = React.useRef<HTMLButtonElement>(null)
    const pickerRef = React.useRef<HTMLDivElement>(null)

    const { data: collection } = useGetLibraryCollection()

    // All library entries flattened
    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const playRandomSound = () => {
        playSound("random", 0.5)
    }

    // Close picker on outside click
    React.useEffect(() => {
        if (!showPicker) return
        const handler = (e: MouseEvent) => {
            if (
                pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setShowPicker(false)
                playRandomSound()
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [showPicker])

    const showPickerRef = React.useRef(showPicker)
    React.useEffect(() => { showPickerRef.current = showPicker }, [showPicker])

    // Close picker on Escape (only when open)
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && showPickerRef.current) {
                setShowPicker(false)
                playRandomSound()
            }
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [])

    const pick = async (type: "movie" | "episode") => {
        setShowPicker(false)
        playRandomSound()
        setIsLoading(true)

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
                return
            }

            // ── 2. Pick a random candidate ─────────────────────────────────
            const randomEntry = candidates[Math.floor(Math.random() * candidates.length)]

            // ── 3. Fetch full entry to get local file paths ────────────────
            const fullEntry = await fetchAnimeEntry(randomEntry.mediaId)
            const localFiles = (fullEntry?.localFiles ?? []).filter(f => !!f.path)

            if (localFiles.length === 0) {
                toast.error("No se encontraron archivos locales para reproducir")
                return
            }

            // ── 4. Choose the file ─────────────────────────────────────────
            // Movies → first file (or most complete one by size heuristic isn't available, so first)
            // Episodes → random file across all local files
            const selectedFile = isMovie
                ? localFiles[0]
                : localFiles[Math.floor(Math.random() * localFiles.length)]

            if (!selectedFile?.path) {
                toast.error("Archivo no disponible")
                return
            }

            // ── 5. Resolve episode number ──────────────────────────────────
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
                episodeLabel: isMovie ? "Película" : `Episodio ${epNum}`,
                episodeNumber: epNum,
                mediaId: randomEntry.mediaId,
                malId: randomEntry.media?.idMal ?? null,
            })

            toast.success(`🎲 ${isMovie ? "Película" : "Episodio"} aleatorio seleccionado`, {
                description: `${seriesTitle}${!isMovie ? ` — Ep. ${epNum}` : ""}`,
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
            {/* ─── Trigger Button + Picker Popover ─────────────────────── */}
            <div className="relative flex items-center justify-center">
                <motion.button
                    ref={btnRef}
                    id="random-play-btn"
                    onClick={() => {
                        if (!isLoading) {
                            setShowPicker(p => !p)
                            playRandomSound()
                        }
                    }}
                    title="Reproducir Aleatorio"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    disabled={isLoading}
                    className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-500 group backdrop-blur-md",
                        isLoading
                            ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange cursor-wait"
                            : showPicker
                                ? "border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
                                : "border-white/5 text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/20"
                    )}
                >
                    {isLoading ? (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <Loader2 className="w-5 h-5" />
                        </motion.div>
                    ) : (
                        <Dices className={cn(
                            "w-5 h-5 transition-transform duration-300",
                            "group-hover:rotate-12 group-hover:scale-110"
                        )} />
                    )}
                </motion.button>

                {/* ─── Picker Popover ──────────────────────────────────── */}
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            ref={pickerRef}
                            role="menu"
                            aria-label="Seleccionar tipo de reproducción aleatoria"
                            initial={{ opacity: 0, scale: 0.88, x: 8, y: 4 }}
                            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, scale: 0.88, x: 8, y: 4 }}
                            transition={{ type: "spring", stiffness: 380, damping: 28 }}
                            className={cn(
                                "absolute left-full bottom-0 ml-4 z-[999]",
                                "w-56 bg-zinc-950/90 border border-white/15 rounded-2xl",
                                "shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-xl",
                                "p-1.5 overflow-hidden"
                            )}
                        >
                            {/* Header */}
                            <div className="px-3 pt-2.5 pb-2">
                                <div className="flex items-center gap-2">
                                    <Dices className="w-3 h-3 text-brand-orange opacity-75" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                        ¿Qué quieres ver?
                                    </p>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/10 mx-2 mb-1" />

                            {/* Movie option */}
                            <PickerOption
                                id="random-play-movie"
                                onClick={() => pick("movie")}
                                icon={<Clapperboard className="w-4 h-4 text-amber-400" />}
                                iconBg="bg-amber-500/10 border-amber-500/20"
                                label="Película"
                                description="Aleatoria de tu colección"
                                accentColor="group-hover:text-amber-400"
                            />

                            {/* Episode option */}
                            <PickerOption
                                id="random-play-episode"
                                onClick={() => pick("episode")}
                                icon={<Tv className="w-4 h-4 text-blue-400" />}
                                iconBg="bg-blue-500/10 border-blue-500/20"
                                label="Episodio"
                                description="De una serie aleatoria"
                                accentColor="group-hover:text-blue-400"
                            />

                            {/* Tip */}
                            <div className="px-3 py-2.5">
                                <p className="text-[9px] text-zinc-500 font-medium leading-tight">
                                    Solo se incluyen títulos con archivos descargados
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Video Player (rendered at the same root level) ──────── */}
            <AnimatePresence>
                {playTarget && (
                    <VideoPlayer
                        streamUrl={playTarget.path}
                        streamType={playTarget.streamType}
                        title={playTarget.title}
                        episodeLabel={playTarget.episodeLabel}
                        episodeNumber={playTarget.episodeNumber}
                        mediaId={playTarget.mediaId}
                        malId={playTarget.malId}
                        onClose={() => setPlayTarget(null)}
                    />
                )}
            </AnimatePresence>
        </>
    )
}

// ─── Picker Option Sub-component ──────────────────────────────────────────────

interface PickerOptionProps {
    id: string
    onClick: () => void
    icon: React.ReactNode
    iconBg: string
    label: string
    description: string
    accentColor: string
}

function PickerOption({ id, onClick, icon, iconBg, label, description, accentColor }: PickerOptionProps) {
    return (
        <motion.button
            id={id}
            role="menuitem"
            onClick={onClick}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-left group"
        >
            {/* Icon badge */}
            <div className={cn(
                "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-300",
                iconBg,
                "group-hover:scale-110"
            )}>
                {icon}
            </div>

            {/* Text */}
            <div>
                <p className={cn(
                    "text-sm font-bold text-white transition-colors duration-200",
                    accentColor
                )}>
                    {label}
                </p>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                    {description}
                </p>
            </div>

            {/* Arrow hint */}
            <motion.span
                className="ml-auto text-zinc-500 text-xs"
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
                ›
            </motion.span>
        </motion.button>
    )
}
