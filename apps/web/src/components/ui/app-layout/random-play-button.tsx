"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Dices, Clapperboard, Tv, Loader2 } from "lucide-react"
import { toast } from "sonner"
import * as Popover from "@radix-ui/react-popover"

import { cn } from "@/components/ui/core/styling"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
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
    mediaFormat?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RandomPlayButton() {
    const { playSound } = useSound()
    const [showPicker, setShowPicker] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [playTarget, setPlayTarget] = React.useState<PlayTarget | null>(null)

    const { data: collection } = useGetLibraryCollection()

    // All library entries flattened
    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const playRandomSound = React.useCallback(() => {
        playSound("random", 0.5)
    }, [playSound])

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
            const localFiles = await fetchAnimeEntryLocalFiles(randomEntry.mediaId)

            if (!localFiles || localFiles.length === 0) {
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

            const seriesTitle =
                randomEntry.media?.titleSpanish ||
                randomEntry.media?.titleRomaji ||
                randomEntry.media?.titleEnglish ||
                "Sin título"

            setPlayTarget({
                path: selectedFile.path,
                streamType: "direct",
                title: seriesTitle,
                episodeLabel: isMovie ? "Película" : `Episodio ${epNum}`,
                episodeNumber: epNum,
                mediaId: randomEntry.mediaId,
                malId: randomEntry.media?.idMal ?? null,
                mediaFormat: randomEntry.media?.format,
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
                <Popover.Root 
                    open={showPicker} 
                    onOpenChange={(open) => {
                        setShowPicker(open)
                        playRandomSound()
                    }}
                >
                    <Popover.Trigger asChild>
                        <motion.button
                            id="random-play-btn"
                            disabled={isLoading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            className={cn(
                                "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-500 group liquid-glass-frosted-subtle",
                                isLoading
                                    ? "!border-brand-orange/40 !bg-brand-orange/[0.08] text-brand-orange cursor-wait"
                                    : showPicker
                                        ? "!border-brand-orange/30 !bg-brand-orange/[0.08] text-brand-orange shadow-[0_0_20px_rgba(255,110,58,0.1)]"
                                        : "text-zinc-500 hover:text-white hover:!border-white/15"
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
                    </Popover.Trigger>
                    
                    <Popover.Portal>
                        <Popover.Content
                            side="right"
                            align="end"
                            sideOffset={16}
                            className={cn(
                                "z-[999] w-56 liquid-glass-popup rounded-2xl p-1.5 outline-none",
                                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                                "data-[state=open]:fade-in-50 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
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
                        mediaFormat={playTarget.mediaFormat}
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
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:liquid-glass-frosted-subtle transition-all duration-200 text-left group"
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
