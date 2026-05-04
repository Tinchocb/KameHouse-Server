import React from "react"
import { Loader2, AlertTriangle } from "lucide-react"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 text-white">
                <Loader2 className="w-14 h-14 text-orange-500 animate-spin drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                <p className="font-bold tracking-widest uppercase text-sm opacity-80 animate-pulse">
                    {streamType === "transcode" ? "Preparando Transmisión" : "Estableciendo Conexión"}
                </p>
            </div>
        )
    }

    if (isBuffering && status === "ready") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-white pointer-events-none bg-black/10 backdrop-blur-[2px]">
                <Loader2 className="w-14 h-14 text-orange-500 animate-spin drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
            </div>
        )
    }

    if (status === "error") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 px-6 text-center text-white bg-black/90">
                <AlertTriangle className="w-16 h-16 text-orange-500" />
                <h3 className="font-black text-2xl tracking-wide">Transmisión Caída</h3>
                <p className="text-gray-400 max-w-md">{errorMsg}</p>
                <button onClick={onClose} className="mt-4 px-8 py-3 rounded-md bg-orange-500 hover:bg-orange-600 font-bold transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                    Regresar
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
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-black/45 backdrop-blur-sm animate-[ping_0.5s_ease-out_forwards]">
                {flash === "play"
                    ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                }
            </div>
        </div>
    )
}

export function SkipIntroOverlay({
    show,
    onSkip
}: {
    show: boolean
    onSkip: () => void
}) {
    return (
        <div className={cn(
            "absolute bottom-24 left-8 md:left-10 z-30 transition-all duration-500 pointer-events-auto",
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}>
            <button
                id="skip-intro-btn"
                aria-label="Saltar Introducción"
                onClick={(e) => {
                    e.stopPropagation()
                    onSkip()
                }}
                className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg",
                    "bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40",
                    "backdrop-blur-md text-white text-sm font-semibold tracking-wide",
                    "transition-all duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
                    "active:scale-95"
                )}
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-80">
                    <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
                </svg>
                Saltar Intro
                <span className="text-white/40 text-xs font-normal ml-1 hidden sm:inline">[S]</span>
            </button>
        </div>
    )
}

export function NextEpisodeOverlay({
    show,
    marathonMode,
    countdownSeconds,
    nextEpisodeTitle,
    onNext,
    duration,
    remainingProgress
}: {
    show: boolean
    marathonMode: boolean
    countdownSeconds: number
    nextEpisodeTitle?: string
    onNext: () => void
    duration: number
    remainingProgress: number // 0 to 100
}) {
    return (
        <div className={cn(
            "absolute bottom-24 right-6 md:right-10 z-30 transition-all duration-500 pointer-events-auto",
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}>
            <div className={cn(
                "flex flex-col gap-3 p-4 rounded-xl w-64",
                "bg-zinc-900/80 border border-white/10 backdrop-blur-xl",
                "shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            )}>
                <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Siguiente episodio</span>
                    {marathonMode && (
                        <span className="text-orange-400 text-xs font-bold tabular-nums">
                            Auto en {countdownSeconds}s
                        </span>
                    )}
                </div>

                {nextEpisodeTitle && (
                    <p className="text-white text-sm font-semibold leading-snug line-clamp-2">
                        {nextEpisodeTitle}
                    </p>
                )}

                {/* Marathon mode progress bar */}
                {marathonMode && duration > 0 && (
                    <div className="w-full h-0.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-orange-500 transition-all duration-1000"
                            style={{ width: `${remainingProgress}%` }}
                        />
                    </div>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onNext()
                    }}
                    className={cn(
                        "w-full py-2 rounded-lg text-sm font-bold tracking-wide",
                        "bg-orange-500 hover:bg-orange-400 text-white",
                        "transition-all duration-200 active:scale-95",
                        "shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                    )}
                >
                    Ir al siguiente →
                </button>
            </div>
        </div>
    )
}
