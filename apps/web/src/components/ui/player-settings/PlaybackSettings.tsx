import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
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
    mediaFormat?: string | null
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
        setMessage("Iniciando detección…")
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
                <span className="text-xs font-semibold text-label-1">
                    Detectar intro y créditos
                </span>
                <span className="text-xs text-label-2 mt-0.5">
                    {message || "Busca la intro y los créditos con AnimeThemes"}
                </span>
            </div>
            <Button
                intent={status === "idle" ? "primary" : "secondary"}
                size="xs"
                onClick={handleScan}
                disabled={status === "running"}
                className={cn(
                    "shrink-0",
                    status === "running" && "text-brand-accent animate-pulse motion-reduce:animate-none",
                    status === "done" && "text-status-success",
                    status === "error" && "text-[color:color-mix(in_srgb,var(--status-error),white_35%)]",
                )}
            >
                {status === "running" ? `${percent}%` : status === "done" ? "Listo" : status === "error" ? "Reintentar" : "Detectar"}
            </Button>
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
            type="button"
            onClick={handleToggle}
            onPointerDown={() => !disabled && setIsPressing(true)}
            onPointerUp={() => setIsPressing(false)}
            onPointerLeave={() => setIsPressing(false)}
            disabled={disabled}
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            className={cn(
                "flex items-center justify-between w-full min-h-[44px] py-2 px-3 rounded-full transition-[background-color,transform] duration-fast ease-smooth-out group text-left relative overflow-hidden outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] focus-visible:bg-[var(--neutral-elev-3)] motion-safe:active:scale-[0.97] cursor-pointer",
                enabled ? "text-label-1" : "text-label-2",
                disabled && "opacity-60 cursor-default pointer-events-none"
            )}
        >
            
            <span className="flex flex-col">
                <span className="text-xs font-semibold text-label-1 text-left">{label}</span>
                {subtext && <span className="text-xs text-label-2 mt-0.5">{subtext}</span>}
            </span>
            
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
    mediaFormat,
    marathonMode,
    onMarathonModeChange,
    mediaId,
}: PlaybackSettingsProps) {
    const isMovie = mediaFormat?.toUpperCase() === "MOVIE"

    return (
        <div className="py-4">

            {/* Velocidad de reproducción */}
            <div className="px-3 py-2">
                <div className="text-xs font-semibold text-label-2 mb-3">Velocidad</div>
                <div className="flex flex-wrap gap-1.5">
                    {PLAYBACK_RATES.map((rate) => {
                        const isActive = Math.abs(playbackRate - rate) < 0.001
                        return (
                            <Button
                                key={rate}
                                intent={isActive ? "primary" : "secondary"}
                                size="xs"
                                aria-pressed={isActive}
                                onClick={() => onPlaybackRateChange(rate)}
                                className="tabular-nums"
                            >
                                {rate}x
                            </Button>
                        )
                    })}
                </div>
            </div>

            <ToggleRow label="Repetir video" enabled={loopEnabled} onChange={onLoopEnabledChange} />
            <ToggleRow label="Ocultar subtítulos si el audio está doblado" enabled={autoDisableSubtitlesWhenDubbed} onChange={onAutoDisableSubtitlesWhenDubbedChange} />
            {!isMovie && onMarathonModeChange && (
                <ToggleRow
                    label="Maratón"
                    enabled={Boolean(marathonMode)}
                    onChange={onMarathonModeChange}
                    subtext="Salta la intro y los créditos y sigue con el siguiente episodio"
                />
            )}
            {!isMovie && <ToggleRow label="Saltar intro automáticamente" enabled={marathonMode ? true : autoSkipIntro} onChange={onAutoSkipIntroChange} disabled={marathonMode} subtext={marathonMode ? "Lo controla Maratón" : undefined} />}
            {!isMovie && <ToggleRow label="Saltar créditos automáticamente" enabled={marathonMode ? true : autoSkipOutro} onChange={onAutoSkipOutroChange} disabled={marathonMode} subtext={marathonMode ? "Lo controla Maratón" : undefined} />}
            {!isMovie && typeof mediaId === "number" && mediaId > 0 && <AutoDetectRow mediaId={mediaId} />}
        </div>
    )
}
