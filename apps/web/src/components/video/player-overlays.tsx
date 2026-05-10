import React from "react"
import { Loader2, AlertTriangle, Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

export function LoadingErrorOverlay({
    status,
    errorMsg,
    streamType,
    isBuffering,
    onClose
}: {
    status: "loading" | "ready" | "error"
    errorMsg: string
    streamType: string
    isBuffering: boolean
    onClose: () => void
}) {
    if (status === "loading") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 text-white bg-black">
                <Loader2 className="w-16 h-16 text-white animate-spin" />
                <p className="font-black tracking-[0.4em] uppercase text-[11px] opacity-60">
                    {streamType === "transcode" ? "// PREPARANDO TRANSMISIÓN" : "// ESTABLECIENDO CONEXIÓN"}
                </p>
            </div>
        )
    }

    if (isBuffering && status === "ready") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-white pointer-events-none bg-black/20">
                <Loader2 className="w-16 h-16 text-white animate-spin" />
            </div>
        )
    }

    if (status === "error") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 px-8 text-center text-white bg-black/95">
                <AlertTriangle className="w-16 h-16 text-white" />
                <h3 className="font-black text-3xl tracking-[0.2em] uppercase">TRANSMISIÓN CAÍDA</h3>
                <p className="text-zinc-500 max-w-md text-sm font-bold uppercase tracking-wide leading-relaxed">{errorMsg}</p>
                <button 
                    onClick={onClose} 
                    className="mt-6 px-10 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] transition-all hover:bg-zinc-200"
                >
                    REGRESAR
                </button>
            </div>
        )
    }

    return null
}

export function CenterPlayFlash({ flash }: { flash: "play" | "pause" | null }) {
    if (!flash) return null
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex items-center justify-center w-24 h-24 bg-white/10 border border-white/20 animate-[ping_0.4s_ease-out_forwards]">
                {flash === "play"
                    ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                }
            </div>
        </div>
    )
}

export function SkipIntroOverlay({
    show,
    onSkip,
    skipLabel = "SALTAR INTRO",
    remainingSeconds,
    shortcutKey = "S",
}: {
    show: boolean
    onSkip: () => void
    skipLabel?: string
    remainingSeconds?: number
    shortcutKey?: string
}) {
    return (
        <div className={cn(
            "absolute bottom-32 left-10 md:left-12 z-30 transition-all duration-300 pointer-events-auto",
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
            <button
                id="skip-intro-btn"
                aria-label="Saltar Introducción"
                onClick={(e) => {
                    e.stopPropagation()
                    onSkip()
                }}
                className={cn(
                    "flex items-center gap-3 px-6 py-3",
                    "bg-white/10 backdrop-blur-xl text-white border border-white/20",
                    "hover:bg-white hover:text-black hover:border-white",
                    "text-[10px] font-black uppercase tracking-[0.3em]",
                    "transition-all duration-200",
                    "active:scale-95",
                    "group"
                )}
            >
                {/* Skip icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-colors group-hover:text-black">
                    <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
                </svg>

                <span className="transition-colors group-hover:text-black">{skipLabel}</span>

                {/* Remaining seconds badge */}
                {remainingSeconds !== undefined && remainingSeconds > 0 && (
                    <span className={cn(
                        "text-[9px] font-mono tabular-nums tracking-widest",
                        "bg-white/10 px-2 py-0.5 rounded-sm",
                        "transition-colors group-hover:bg-black/10 group-hover:text-black"
                    )}>
                        {remainingSeconds}s
                    </span>
                )}

                <span className="text-white/30 text-[9px] font-black ml-1 hidden sm:inline transition-colors group-hover:text-black/40">
                    [{shortcutKey}]
                </span>
            </button>
        </div>
    )
}

export function NextEpisodeOverlay({
    show,
    marathonMode,
    countdownSeconds,
    nextEpisodeTitle,
    nextEpisodeImage,
    nextEpisodeNumber,
    onNext,
    duration: _duration,
    remainingProgress
}: {
    show: boolean
    marathonMode: boolean
    countdownSeconds: number
    nextEpisodeTitle?: string
    nextEpisodeImage?: string
    nextEpisodeNumber?: number
    onNext: () => void
    duration: number
    remainingProgress: number // 0 to 100
}) {
    return (
        <div className={cn(
            "absolute bottom-32 right-8 md:right-12 z-30 transition-all duration-300 pointer-events-auto",
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
        )}>
            <div className={cn(
                "flex flex-col gap-4 w-72 bg-black/90 backdrop-blur-md border border-white/10",
                "shadow-2xl overflow-hidden"
            )}>
                {/* Thumbnail */}
                {nextEpisodeImage && (
                    <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden">
                        <img
                            src={nextEpisodeImage}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {marathonMode && (
                            <div className="absolute top-3 right-3 bg-black/70 text-[9px] font-black uppercase tracking-widest text-white px-2 py-1">
                                AUTO: {countdownSeconds}S
                            </div>
                        )}
                        {/* Play icon overlay hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-10 h-10 text-white/80 fill-white/80" />
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 px-5 pb-5 pt-2">
                    {/* Label */}
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">
                            {nextEpisodeNumber ? `EPISODIO ${nextEpisodeNumber}` : "SIGUIENTE"}
                        </span>
                        {!nextEpisodeImage && marathonMode && (
                            <span className="text-white text-[10px] font-black tabular-nums tracking-widest">
                                AUTO: {countdownSeconds}S
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    {nextEpisodeTitle && (
                        <p className="text-white text-sm font-black leading-tight uppercase tracking-tight line-clamp-2">
                            {nextEpisodeTitle}
                        </p>
                    )}

                    {/* Marathon progress bar */}
                    {marathonMode && (
                        <div className="w-full h-1 bg-white/5 overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-1000 ease-linear"
                                style={{ width: `${remainingProgress}%` }}
                            />
                        </div>
                    )}

                    {/* Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onNext()
                        }}
                        className={cn(
                            "w-full py-3 text-[10px] font-black uppercase tracking-[0.3em]",
                            "bg-white text-black hover:bg-zinc-200",
                            "transition-all duration-200 active:scale-95"
                        )}
                    >
                        SIGUIENTE →
                    </button>
                </div>
            </div>
        </div>
    )
}
