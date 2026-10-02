import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { SpringSwitch } from "@/components/ui/switch/spring-switch"
import { buildApiQuery } from "@/api/client/requests"
import { useWebSocket } from "@/hooks/use-websocket"
import { useApiWebSocketUrl } from "@/api/client/use-api-websocket-url"
import { WSEvents, type WebSocketMessage } from "@/lib/server/ws-events"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

interface PlaybackSettingsProps {
    playbackRate: number
    onPlaybackRateChange: (rate: number) => void
    autoSkipIntro: boolean
    onAutoSkipIntroChange: (enabled: boolean) => void
    autoSkipOutro: boolean
    onAutoSkipOutroChange: (enabled: boolean) => void
    loopEnabled?: boolean
    onLoopEnabledChange?: (enabled: boolean) => void
    autoDisableSubtitlesWhenDubbed?: boolean
    onAutoDisableSubtitlesWhenDubbedChange?: (enabled: boolean) => void
    showSeparator?: boolean
    mediaFormat?: string | null
    tvMode?: boolean
    onTvModeChange?: (enabled: boolean) => void
    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void
    mediaId?: number | null
}

/** Botón que dispara la detección automática de OP/ED en el servidor y muestra el
 * progreso vía el evento websocket SKIP_SCAN_STATUS. La detección corre la cadena
 * AnimeThemes → cross-episodio → subtítulos y persiste las marcas; el player las
 * recoge en el siguiente refetch (el server emite invalidate-queries al terminar). */
function AutoDetectRow({ mediaId }: { mediaId: number }) {
    const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle")
    const [message, setMessage] = React.useState<string>("")
    const [percent, setPercent] = React.useState<number>(0)
    const timerRef = React.useRef<NodeJS.Timeout | null>(null)

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const wsUrl = useApiWebSocketUrl()
    useWebSocket(wsUrl, React.useCallback((data: WebSocketMessage) => {
        if (data?.type !== WSEvents.SKIP_SCAN_STATUS) return
        const p = data.payload
        if (!p || p.mediaId !== mediaId) return
        setMessage(p.message ?? "")
        if (typeof p.percent === "number") setPercent(p.percent)
        if (p.status === "done") {
            setStatus("done")
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setStatus("idle"), 4000)
        } else if (p.status === "error") {
            setStatus("error")
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setStatus("idle"), 4000)
        } else {
            setStatus("running")
        }
    }, [mediaId]))

    const handleScan = async () => {
        if (status === "running") return
        setStatus("running")
        setMessage("Iniciando detección...")
        setPercent(0)
        try {
            await buildApiQuery<unknown, { mediaId: number }>({
                endpoint: API_ENDPOINTS.MEDIASTREAM.ScanEpisodeSkipTimes.endpoint,
                method: API_ENDPOINTS.MEDIASTREAM.ScanEpisodeSkipTimes.methods[0],
                data: { mediaId },
            })
        } catch {
            setStatus("error")
            setMessage("No se pudo iniciar la detección.")
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setStatus("idle"), 4000)
        }
    }

    return (
        <div className="px-3 py-2 flex items-center justify-between text-left group">
            <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-wide text-white">
                    Detectar intros y outros
                </span>
                <span className="text-2xs text-on-surface-variant mt-0.5">
                    {message || "Detección inteligente con AnimeThemes"}
                </span>
            </div>
            <button
                onClick={handleScan}
                disabled={status === "running"}
                className={cn(
                    "min-h-[36px] px-3.5 rounded-full text-xs font-semibold tracking-wide transition-[background-color,color,transform] duration-fast ease-smooth-out cursor-pointer active:scale-95 disabled:cursor-not-allowed",
                    status === "running" && "bg-brand-accent/20 text-brand-accent animate-pulse",
                    status === "done" && "bg-emerald-500/20 text-emerald-400",
                    status === "error" && "bg-rose-500/20 text-rose-400",
                    status === "idle" && "bg-white/95 text-black [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white"
                )}
            >
                {status === "running" ? `${percent}%` : status === "done" ? "¡Listo!" : status === "error" ? "Error" : "Escanear"}
            </button>
        </div>
    )
}

function ToggleRow({
    label,
    subtext,
    enabled,
    onChange,
    disabled = false,
}: {
    label: string
    subtext?: string
    enabled: boolean
    onChange: (enabled: boolean) => void
    disabled?: boolean
}) {
    const [isPressing, setIsPressing] = React.useState(false)

    const handleToggle = () => {
        if (disabled) return
        onChange(!enabled)
    }

    return (
        <button
            onClick={handleToggle}
            onPointerDown={() => !disabled && setIsPressing(true)}
            onPointerUp={() => setIsPressing(false)}
            onPointerLeave={() => setIsPressing(false)}
            disabled={disabled}
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            className={cn(
                "flex items-center justify-between w-full min-h-[44px] py-2 px-3 rounded-full transition-[background-color,transform] duration-fast ease-smooth-out group text-left relative overflow-hidden outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10 focus-visible:bg-white/10 active:scale-95 cursor-pointer",
                enabled ? "text-white" : "text-on-surface-variant",
                disabled && "opacity-60 cursor-default pointer-events-none"
            )}
        >
            
            <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-wide text-white text-left">{label}</span>
                {subtext && <span className="text-2xs text-on-surface-variant mt-0.5">{subtext}</span>}
            </div>
            
            <SpringSwitch
                checked={enabled}
                disabled={disabled}
                size="sm"
                ariaHidden={true}
                isPressingExternal={isPressing}
                className="ml-4 pointer-events-none"
            />
        </button>
    )
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

export function PlaybackSettings({
    playbackRate = 1,
    onPlaybackRateChange = () => {},
    autoSkipIntro,
    onAutoSkipIntroChange,
    autoSkipOutro,
    onAutoSkipOutroChange,
    loopEnabled = false,
    onLoopEnabledChange = () => {},
    autoDisableSubtitlesWhenDubbed = true,
    onAutoDisableSubtitlesWhenDubbedChange = () => {},
    showSeparator = true,
    mediaFormat,
    marathonMode,
    onMarathonModeChange,
    tvMode,
    onTvModeChange,
    mediaId,
}: PlaybackSettingsProps) {
    const isMovie = mediaFormat?.toUpperCase() === "MOVIE"

    return (
        <div className="py-4">
            {showSeparator && <div className="mx-6 h-px bg-white/10 mb-4" />}

            {/* Velocidad de reproducción */}
            <div className="px-3 py-2">
                <div className="text-2xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Velocidad</div>
                <div className="flex flex-wrap gap-1.5">
                    {PLAYBACK_RATES.map((rate) => {
                        const isActive = Math.abs(playbackRate - rate) < 0.001
                        return (
                            <button
                                key={rate}
                                onClick={() => onPlaybackRateChange(rate)}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-full text-xs font-medium tabular-nums transition-[background-color,color,transform] duration-fast ease-out-strong active:scale-95 cursor-pointer",
                                    "focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                                    isActive
                                        ? "bg-white/95 text-black"
                                        : "bg-white/5 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white"
                                )}
                            >
                                {rate}x
                            </button>
                        )
                    })}
                </div>
            </div>

            <ToggleRow label="Repetir (loop)" enabled={loopEnabled} onChange={onLoopEnabledChange} />
            <ToggleRow label="Ocultar subtítulos si está doblado" enabled={autoDisableSubtitlesWhenDubbed} onChange={onAutoDisableSubtitlesWhenDubbedChange} />
            {!isMovie && onMarathonModeChange && (
                <ToggleRow
                    label="Modo Maratón"
                    enabled={Boolean(marathonMode)}
                    onChange={onMarathonModeChange}
                    subtext="Salta intro/outro y avanza automáticamente"
                />
            )}
            {onTvModeChange && (
                <ToggleRow
                    label="Modo Smart TV (D-Pad)"
                    enabled={Boolean(tvMode)}
                    onChange={onTvModeChange}
                />
            )}
            {!isMovie && <ToggleRow label="Omitir Intro (automático)" enabled={marathonMode ? true : autoSkipIntro} onChange={onAutoSkipIntroChange} disabled={marathonMode} subtext={marathonMode ? "(controlado por Maratón)" : undefined} />}
            {!isMovie && <ToggleRow label="Saltar Final (automático)" enabled={marathonMode ? true : autoSkipOutro} onChange={onAutoSkipOutroChange} disabled={marathonMode} subtext={marathonMode ? "(controlado por Maratón)" : undefined} />}
            {!isMovie && typeof mediaId === "number" && mediaId > 0 && <AutoDetectRow mediaId={mediaId} />}
        </div>
    )
}
