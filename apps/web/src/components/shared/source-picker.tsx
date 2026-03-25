import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { MediaSource, UnifiedResolutionResponse } from "@/api/types/unified.types"
import { X, HardDrive, Zap, Magnet, Play } from "lucide-react"

export interface SourcePickerProps {
    response: UnifiedResolutionResponse | null
    onSelect: (source: MediaSource) => void
    onClose: () => void
}

function extractTags(text: string): string[] {
    const tags = []
    const lower = (text || "").toLowerCase()
    if (lower.includes("hdr")) tags.push("HDR")
    if (lower.includes("10bit")) tags.push("10bit")
    if (lower.includes("hevc") || lower.includes("x265") || lower.includes("h265")) tags.push("HEVC")
    return tags
}

export function SourcePicker({ response, onSelect, onClose }: SourcePickerProps) {
    const firstLocalRef = React.useRef<HTMLButtonElement>(null)

    React.useEffect(() => {
        if (response && response.sources && firstLocalRef.current) {
            firstLocalRef.current.focus()
        }
    }, [response])

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [onClose])

    if (!response) return null

    const sources = response.sources || []
    const localSources = sources.filter((s) => s.type === "Local")
    const externalSources = sources.filter((s) => s.type !== "Local")

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={cn(
                        "relative flex w-full max-w-3xl flex-col overflow-hidden",
                        "rounded-t-3xl sm:rounded-2xl",
                        "bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-2xl",
                        "max-h-[85vh]",
                    )}
                >
                    <div className="flex items-center justify-between border-b border-white/5 p-4 sm:p-6 pb-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-bold tracking-tight text-white">Seleccionar Fuente</h2>
                            <p className="text-sm font-medium text-zinc-400">{response.title}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-8">
                        {sources.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                                <Magnet className="mb-4 h-10 w-10 opacity-50" />
                                <span className="mb-1 font-medium text-white">Sin fuentes disponibles</span>
                                <span className="max-w-[250px] text-sm">No pudimos resolver este contenido.</span>
                            </div>
                        ) : (
                            <>
                                {localSources.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500/90">
                                                Almacenamiento Local
                                            </h3>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {localSources.map((source, i) => (
                                                <SourceCard
                                                    key={`local-${i}`}
                                                    source={source}
                                                    onClick={() => onSelect(source)}
                                                    ref={i === 0 ? firstLocalRef : undefined}
                                                    isRecommended
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {externalSources.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.5)]" />
                                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                                                    Redes Externas
                                                </h3>
                                            </div>
                                            <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                                                P2P & Cloud
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {externalSources.map((source, i) => (
                                                <SourceCard
                                                    key={`ext-${i}`}
                                                    source={source}
                                                    onClick={() => onSelect(source)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

interface SourceCardProps {
    source: MediaSource
    onClick: () => void
    isRecommended?: boolean
}

const SourceCard = React.forwardRef<HTMLButtonElement, SourceCardProps>(
    ({ source, onClick, isRecommended }, ref) => {
        const isLocal = source.type === "Local"
        const isDebrid = (source.type as any) === "Debrid"

        const Icon = isLocal ? HardDrive : isDebrid ? Zap : Magnet
        const iconBg = isLocal
            ? "bg-emerald-500/20 text-emerald-400"
            : isDebrid
              ? "bg-purple-500/20 text-purple-400"
              : "bg-orange-500/20 text-orange-400"

        const tags = [source.resolution > 0 ? `${source.resolution}p` : "SD", ...extractTags(source.quality)]
        const sizeMB = source.size ? (source.size / (1024 * 1024)).toFixed(0) + " MB" : ""

        const cardStyle = isRecommended
            ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)] animate-[pulse_3s_ease-in-out_infinite]"
            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15"

        return (
            <button
                ref={ref}
                onClick={onClick}
                className={cn(
                    "group relative flex w-full items-center gap-4 overflow-hidden rounded-xl p-4 text-left transition-all duration-300",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                    "border",
                    cardStyle,
                )}
            >
                <div
                    className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg backdrop-blur-md transition-transform duration-300 group-hover:scale-105",
                        iconBg,
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>

                <div className="flex flex-1 flex-col justify-center gap-1.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                        {isRecommended && (
                            <span className="flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-950">
                                ⭐ Recomendado
                            </span>
                        )}
                        <span className="truncate text-sm font-bold text-zinc-100 transition-colors group-hover:text-white">
                            {source.provider || source.type}
                        </span>
                        {sizeMB && (
                            <span className="truncate text-[10px] font-medium text-zinc-500">
                                • {sizeMB}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {tags.map((tag, i) => (
                            <span
                                key={`${tag}-${i}`}
                                className="rounded-md border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-300"
                            >
                                {tag}
                            </span>
                        ))}
                        {source.seeders > 0 && !isLocal && (
                            <span className="ml-1 text-[11px] font-medium text-blue-400/80">
                                👥 {source.seeders}
                            </span>
                        )}
                    </div>
                </div>

                {isLocal && source.urlPath && (
                    <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 max-w-[150px] truncate text-xs text-zinc-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {source.urlPath.split(/[\\/]/).pop()}
                    </div>
                )}

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 backdrop-blur-md transition-all duration-300 group-hover:bg-white/10 group-hover:text-white">
                    <Play className="ml-0.5 h-4 w-4" />
                </div>
            </button>
        )
    },
)
SourceCard.displayName = "SourceCard"
