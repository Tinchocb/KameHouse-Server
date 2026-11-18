import React from "react"
import { useShallow } from "zustand/react/shallow"
import { useUIStore } from "@/lib/store"
import { IconMediaPause, IconMediaPlay } from "@/components/ui/icons";
import { IconSwap } from "@/components/ui/kinetics";
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { getEraOpening, ERA_OPENINGS_SUBDIR } from "@/lib/config/era_openings"
import { getServerBaseUrl } from "@/api/client/server-url"
import { authorizeResourceUrl } from "@/api/client/auth"

interface EraOpeningPlayerProps {
    sagaId: string
    className?: string
}

const BAR_HEIGHTS = ["55%", "90%", "70%", "100%"]

export function EraOpeningPlayer({ sagaId, className }: EraOpeningPlayerProps) {
    const opening = getEraOpening(sagaId)
    // useShallow: el selector devuelve un objeto nuevo en cada render; sin
    // igualdad shallow useSyncExternalStore entra en loop infinito de re-renders.
    const { bgMusicDir, isVideoActive, setEraOpeningPlaying, uiSoundsVolume } = useUIStore(useShallow((state) => ({
        bgMusicDir: state.bgMusicDir,
        isVideoActive: state.isVideoActive,
        setEraOpeningPlaying: state.setEraOpeningPlaying,
        uiSoundsVolume: state.uiSoundsVolume
    })))

    const audioRef = React.useRef<HTMLAudioElement | null>(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    // El archivo no existe en <bgMusicDir>/openings/ → ocultamos el pill.
    const [unavailable, setUnavailable] = React.useState(false)

    // Detener y liberar el audio si cambiamos de saga o se desmonta
    React.useEffect(() => {
        const timer = setTimeout(() => setUnavailable(false), 0)
        return () => {
            clearTimeout(timer)
            const audio = audioRef.current
            if (audio) {
                audio.pause()
                audio.onended = null
                audio.onpause = null
                audio.onplay = null
                audio.onerror = null
                audio.removeAttribute("src")
                audio.load()
                audioRef.current = null
            }
            setEraOpeningPlaying(false)
        }
    }, [sagaId, setEraOpeningPlaying])

    // Update the app store state when isPlaying changes
    React.useEffect(() => {
        setEraOpeningPlaying(isPlaying)
    }, [isPlaying, setEraOpeningPlaying])

    // Si arranca un video, el opening se calla
    React.useEffect(() => {
        if (isVideoActive && audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause()
        }
    }, [isVideoActive])

    // El volumen se sincroniza acá y no en el handler: mutar audioRef fuera de un
    // effect rompe react-hooks/immutability (el ref ya es dependencia de effects).
    React.useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.pow(uiSoundsVolume, 2)
        }
    }, [uiSoundsVolume])

    if (!opening || !bgMusicDir || unavailable) return null

    const base = getServerBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "http://localhost")
    // /api/v1/music/stream rechaza separadores en `file`; la subcarpeta va en `dir`.
    const openingsDir = `${bgMusicDir.replace(/[\\/]+$/, "")}/${ERA_OPENINGS_SUBDIR}`
    const streamUrl = authorizeResourceUrl(`${base}/api/v1/music/stream?dir=${encodeURIComponent(openingsDir)}&file=${encodeURIComponent(opening.file)}`)

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation()

        let audio = audioRef.current
        if (!audio) {
            audio = new Audio(streamUrl)
            audio.volume = Math.pow(uiSoundsVolume, 2)
            audio.onended = () => setIsPlaying(false)
            audio.onpause = () => setIsPlaying(false)
            audio.onplay = () => setIsPlaying(true)
            audio.onerror = () => {
                setIsPlaying(false)
                setUnavailable(true)
            }
            audioRef.current = audio
        }

        if (isPlaying) {
            audio.pause()
        } else {
            audio.play().catch(() => setUnavailable(true))
        }
    }

    return (
        <Button
            intent="glass"
            size="lg"
            onClick={togglePlay}
            className={cn(
                "era-opening-player font-bold",
                className
            )}
            title={`Tema de la saga: ${opening.title}`}
            aria-label={`${isPlaying ? "Pausar" : "Reproducir"} el tema de la saga: ${opening.title}`}
            aria-pressed={isPlaying}
            leftIcon={
                <IconSwap swapKey={isPlaying ? "pause" : "play"} className="shrink-0 flex items-center justify-center">
                    {isPlaying ? (
                        <IconMediaPause size={16} className="shrink-0" />
                    ) : (
                        <IconMediaPlay size={16} className="shrink-0 ml-0.5" />
                    )}
                </IconSwap>
            }
        >
            <span>{opening.title}</span>

            {isPlaying && (
                <span aria-hidden="true" className="flex items-end gap-[2px] h-3 ml-1.5">
                    {BAR_HEIGHTS.map((height, i) => (
                        <span
                            key={i}
                            className="w-[2px] bg-brand-accent rounded-full animate-music-bars motion-reduce:animate-none"
                            style={{
                                animationDelay: `${i * 0.15}s`,
                                height
                            }}
                        />
                    ))}
                </span>
            )}
        </Button>
    )
}
