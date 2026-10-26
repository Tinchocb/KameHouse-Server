"use client"

import * as React from "react"
import { useDebounce } from "use-debounce"
import { useUIStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { IconStatusMusic, IconStatusMusicOff } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { getServerBaseUrl } from "@/api/client/server-url"


import { resolveSeriesSoundtrackPlaylist, SERIES_SOUNDTRACKS, getSeriesEraKey } from "@/lib/config/series_soundtracks"
import { persistThemePatch } from "@/lib/server/persist-settings"

// Playlist por defecto (bundleada con la app) que se usa cuando el usuario
// todavía no ha escaneado una carpeta de música propia.
const DEFAULT_PLAYLIST = [
    "/sounds/music/Dragon ball dvd.m4a",
    "/sounds/music/Dragon ball dvd 2.m4a",
    "/sounds/music/the-meteor.m4a"
]

// Construye la URL de streaming para un track escaneado del servidor.
function buildTrackUrl(dir: string, file: string): string {
    const base = getServerBaseUrl() || window.location.origin
    const params = new URLSearchParams({ dir, file })
    return `${base}/api/v1/music/stream?${params.toString()}`
}

// El estante escribe el contexto en cada selección: la banda sonora espera a
// que la selección se asiente para no recargar la pista en cada flecha.
const SERIES_CONTEXT_SETTLE_MS = 600
// El audio necesita tiempos más largos que una transición visual.
const TRACK_CROSSFADE_MS = 1800
const TRACK_FADE_IN_MS = 1200

function cancelVolumeRamp(rampRef: React.RefObject<number | null>) {
    if (rampRef.current !== null) {
        window.clearInterval(rampRef.current)
        rampRef.current = null
    }
}

/**
 * Lleva el volumen hacia `getTarget()` (valor del deslizador, 0..1) en `durationMs`.
 * La rampa tiene entrada y salida suaves y el audio usa el cuadrado del deslizador.
 * Va con setInterval y no con rAF: con la ventana oculta en la
 * bandeja rAF se congela y la pista quedaría muda a mitad del fundido.
 */
function rampVolume(
    audio: HTMLAudioElement,
    rampRef: React.RefObject<number | null>,
    getTarget: () => number,
    durationMs: number,
    onDone?: () => void,
) {
    cancelVolumeRamp(rampRef)
    const from = Math.sqrt(audio.volume)
    const start = performance.now()
    rampRef.current = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / durationMs)
        const eased = t * t * (3 - 2 * t)
        const level = from + (getTarget() - from) * eased
        audio.volume = Math.min(1, Math.max(0, level * level))
        if (t >= 1) {
            cancelVolumeRamp(rampRef)
            onDone?.()
        }
    }, 16)
}

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL AUDIO ARCHITECTURE - NO MODIFICAR ESTA LÓGICA
// 1. Reproductor global: una pista principal y una saliente solo durante el cruce.
//    Previene "audios huérfanos / zombies" que sigan sonando en dev (HMR) o cuando
//    el Sidebar se monta dos veces (desktop aside + mobile drawer).
// 2. Control Síncrono: Zustand sincroniza el estado en 0ms y pausa inmediatamente
//    la instancia global sin esperar ciclos de re-render de React.
// ═══════════════════════════════════════════════════════════════════════════

function getGlobalBgAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null
    if (!window.__kamehouse_bg_audio) {
        const audio = new Audio()
        window.__kamehouse_bg_audio = audio
    }
    return window.__kamehouse_bg_audio
}

// Limpieza proactiva en dev / HMR: si la música está deshabilitada en el store,
// pausamos y limpiamos el audio inmediatamente al cargar el módulo.
if (typeof window !== "undefined") {
    if (window.__kamehouse_bg_audio && !useUIStore.getState().bgMusicEnabled) {
        try {
            window.__kamehouse_bg_audio.pause()
            window.__kamehouse_bg_audio_outgoing?.pause()
            window.__kamehouse_bg_audio.src = ""
        } catch {}
    }
}

export function BackgroundMusicPlayer({ headless = false }: { headless?: boolean } = {}) {
    const {
        bgMusicEnabled,
        setBgMusicEnabled,
        uiSoundsEnabled,
        setUiSoundsEnabled,
        bgMusicVolume,
        bgMusicDir,
        bgMusicTracks,
        isVideoActive,
        eraOpeningPlaying,
        activeSeriesContext,
        seriesSoundtrackMode,
    } = useUIStore(
        useShallow((state) => ({
            bgMusicEnabled: state.bgMusicEnabled,
            setBgMusicEnabled: state.setBgMusicEnabled,
            uiSoundsEnabled: state.uiSoundsEnabled,
            setUiSoundsEnabled: state.setUiSoundsEnabled,
            bgMusicVolume: state.bgMusicVolume,
            bgMusicDir: state.bgMusicDir,
            bgMusicTracks: state.bgMusicTracks,
            isVideoActive: state.isVideoActive,
            eraOpeningPlaying: state.eraOpeningPlaying,
            activeSeriesContext: state.activeSeriesContext,
            seriesSoundtrackMode: state.seriesSoundtrackMode,
        }))
    )

    // El botón de la sidebar es el interruptor MAESTRO de audio: agrupa la
    // música de fondo y los efectos de UI, igual que el switch de audio global
    // en Ajustes → Audio. Está "encendido" si cualquiera de los dos suena.
    const audioMasterOn = bgMusicEnabled || uiSoundsEnabled

    // Serie activa detectada
    const activeEraKey = React.useMemo(() => getSeriesEraKey(activeSeriesContext), [activeSeriesContext])
    const activeSeriesInfo = activeEraKey ? SERIES_SOUNDTRACKS[activeEraKey] : null

    // Era de la banda sonora: sale del contexto ya asentado y solo cuenta con el modo
    // soundtrack encendido. Elegir otra serie de la misma era no cambia la playlist.
    const [settledSeriesContext] = useDebounce(activeSeriesContext, SERIES_CONTEXT_SETTLE_MS)
    const settledEraKey = React.useMemo(() => getSeriesEraKey(settledSeriesContext), [settledSeriesContext])
    const playlistEraKey = seriesSoundtrackMode ? settledEraKey : null

    // La playlist activa: si hay una era asentada y el modo soundtrack está encendido,
    // se resuelve la banda sonora de esa era; si no, la playlist global. Depende de la
    // era y no del id crudo, así la referencia se mantiene entre selecciones del estante.
    const PLAYLIST = React.useMemo(() => {
        if (playlistEraKey) {
            const seriesTracks = resolveSeriesSoundtrackPlaylist(playlistEraKey, bgMusicTracks, bgMusicDir)
            return seriesTracks.map(t => t.url)
        }

        if (bgMusicDir && bgMusicTracks.length > 0) {
            return bgMusicTracks.map((t) => buildTrackUrl(bgMusicDir, t.file))
        }
        return DEFAULT_PLAYLIST
    }, [bgMusicDir, bgMusicTracks, playlistEraKey])

    const [isAnyVideoPlaying, setIsAnyVideoPlaying] = React.useState(false)
    const [currentTrackIndex, setCurrentTrackIndex] = React.useState(0)
    // Intervalo del fundido de volumen en curso (null si no hay ninguno).
    const volumeRampRef = React.useRef<number | null>(null)

    // Si cambia la era de la banda sonora, reseteamos al primer track durante el render
    const [prevPlaylistEraKey, setPrevPlaylistEraKey] = React.useState(playlistEraKey)
    if (playlistEraKey !== prevPlaylistEraKey) {
        setPrevPlaylistEraKey(playlistEraKey)
        setCurrentTrackIndex(0)
    }

    // Si el índice actual queda fuera de rango, lo reiniciamos a 0
    React.useEffect(() => {
        if (currentTrackIndex >= PLAYLIST.length) {
            const timer = setTimeout(() => setCurrentTrackIndex(0), 0)
            return () => clearTimeout(timer)
        }
    }, [PLAYLIST, currentTrackIndex])

    // Sync volume when bgMusicVolume changes (NO incluir bgMusicVolume en el hook
    // de reproducción para evitar que cambiar el volumen reinicie o corte la música).
    const bgMusicVolumeRef = React.useRef(bgMusicVolume)
    React.useEffect(() => {
        bgMusicVolumeRef.current = bgMusicVolume
        const audio = getGlobalBgAudio()
        // Durante un fundido manda la rampa, que lee el ref en cada paso.
        if (audio && volumeRampRef.current === null && !window.__kamehouse_bg_audio_outgoing) {
            audio.volume = Math.pow(bgMusicVolume, 2)
        }
    }, [bgMusicVolume])

    // Sincronización del estado de reproducción con las preferencias del store
    React.useEffect(() => {
        const audio = getGlobalBgAudio()
        if (!audio) return

        // Corte inmediato si la música está apagada, un video está activo,
        // o suena un opening de saga.
        if (!bgMusicEnabled || isVideoActive || isAnyVideoPlaying || eraOpeningPlaying || PLAYLIST.length === 0) {
            cancelVolumeRamp(volumeRampRef)
            audio.pause()
            window.__kamehouse_bg_audio_outgoing?.pause()
            return
        }

        // Una sola pista no cambia el índice al terminar; el elemento debe repetirla.
        audio.loop = PLAYLIST.length === 1

        // Manejo de bucle / siguiente pista al terminar
        const handleEnded = () => {
            setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length)
        }
        audio.addEventListener("ended", handleEnded)

        const startPlayback = () => {
            audio.play()
                .catch((err) => {
                    console.warn("Could not autoplay background music:", err)
                })
        }
        const sliderTarget = () => bgMusicVolumeRef.current

        // Carga de la pista esperada si cambió
        const expectedSrc = PLAYLIST[currentTrackIndex]
        const needsSwap = !!expectedSrc && audio.src !== new URL(expectedSrc, window.location.origin).href

        if (expectedSrc && needsSwap && !audio.paused && audio.volume > 0) {
            const incoming = new Audio()
            incoming.volume = 0
            incoming.loop = PLAYLIST.length === 1
            incoming.src = expectedSrc
            incoming.load()
            incoming.addEventListener("ended", handleEnded)
            audio.removeEventListener("ended", handleEnded)
            window.__kamehouse_bg_audio_outgoing = audio
            window.__kamehouse_bg_audio = incoming
            let cancelled = false
            let pending = true

            // play() se resuelve al comenzar la reproducción: conservar la pista
            // anterior mientras carga evita un hueco con archivos locales o remotos.
            incoming.play().then(() => {
                if (cancelled) return
                pending = false
                const from = audio.volume
                const start = performance.now()
                volumeRampRef.current = window.setInterval(() => {
                    const t = Math.min(1, (performance.now() - start) / TRACK_CROSSFADE_MS)
                    const eased = t * t * (3 - 2 * t)
                    const angle = eased * Math.PI / 2
                    // Potencia constante: evita el bajón de un cruce lineal.
                    audio.volume = from * Math.cos(angle)
                    incoming.volume = Math.pow(sliderTarget(), 2) * Math.sin(angle)
                    if (t >= 1) {
                        cancelVolumeRamp(volumeRampRef)
                        audio.pause()
                        delete window.__kamehouse_bg_audio_outgoing
                    }
                }, 16)
            }).catch(err => {
                if (cancelled) return
                incoming.pause()
                window.__kamehouse_bg_audio = audio
                delete window.__kamehouse_bg_audio_outgoing
                audio.addEventListener("ended", handleEnded)
                console.warn("Could not crossfade background music:", err)
            })

            return () => {
                cancelled = true
                cancelVolumeRamp(volumeRampRef)
                audio.removeEventListener("ended", handleEnded)
                incoming.removeEventListener("ended", handleEnded)
                if (pending) {
                    incoming.pause()
                    window.__kamehouse_bg_audio = audio
                } else {
                    audio.pause()
                }
                delete window.__kamehouse_bg_audio_outgoing
            }
        } else {
            if (expectedSrc && needsSwap) {
                audio.src = expectedSrc
                audio.load()
            }
            const targetVolume = Math.pow(bgMusicVolumeRef.current, 2)
            if (!needsSwap && !audio.paused && Math.abs(audio.volume - targetVolume) > 0.001) {
                // Retoma un fundido interrumpido sin salto de volumen.
                rampVolume(audio, volumeRampRef, sliderTarget, TRACK_FADE_IN_MS)
            } else {
                audio.volume = targetVolume
            }
            startPlayback()
        }

        return () => {
            cancelVolumeRamp(volumeRampRef)
            audio.removeEventListener("ended", handleEnded)
        }
    }, [bgMusicEnabled, isVideoActive, currentTrackIndex, isAnyVideoPlaying, PLAYLIST, eraOpeningPlaying])

    // Detectar si se reproduce un video en la página para pausar la música automáticamente
    React.useEffect(() => {
        const updateMediaState = () => {
            const mediaElements = document.querySelectorAll("video")
            let playing = false
            mediaElements.forEach((el) => {
                const media = el as HTMLMediaElement
                if (!media.paused && !media.ended) {
                    playing = true
                }
            })
            setIsAnyVideoPlaying(playing)
        }

        document.addEventListener("play", updateMediaState, true)
        document.addEventListener("playing", updateMediaState, true)
        document.addEventListener("pause", updateMediaState, true)
        document.addEventListener("ended", updateMediaState, true)

        // Verificación inicial
        updateMediaState()

        return () => {
            document.removeEventListener("play", updateMediaState, true)
            document.removeEventListener("playing", updateMediaState, true)
            document.removeEventListener("pause", updateMediaState, true)
            document.removeEventListener("ended", updateMediaState, true)
        }
    }, [])

    const togglePlayback = () => {
        // Interruptor maestro de audio: activa / desactiva música de fondo y efectos de UI a la vez.
        // NOTA CRÍTICA: Llamar a audio.play() directamente dentro del click del usuario
        // garantiza el cumplimiento estricto de las políticas de autoplay del navegador.
        const next = !audioMasterOn
        setBgMusicEnabled(next)
        setUiSoundsEnabled(next)
        persistThemePatch({ bgMusicEnabled: next, uiSoundsEnabled: next })

        const audio = getGlobalBgAudio()
        if (!next) {
            if (audio) {
                audio.pause()
            }
        } else {
            if (audio && PLAYLIST.length > 0 && !isVideoActive && !eraOpeningPlaying && !isAnyVideoPlaying) {
                const expectedSrc = PLAYLIST[currentTrackIndex]
                if (expectedSrc) {
                    const expectedAbsolute = new URL(expectedSrc, window.location.origin).href
                    if (audio.src !== expectedAbsolute) {
                        audio.src = expectedSrc
                        audio.load()
                    }
                }
                audio.volume = Math.pow(bgMusicVolume, 2)
                audio.play()
                    .catch((err) => {
                        console.warn("Could not start background music on click:", err)
                    })
            }
        }
    }

    if (headless) return null

    return (
        <div className="w-full flex justify-center">
            <button
                id="bg-music-toggle-btn"
                onClick={togglePlayback}
                title={audioMasterOn ? "Silenciar audio" : "Activar audio"}
                aria-label={audioMasterOn ? "Silenciar audio" : "Activar audio"}
                aria-pressed={audioMasterOn}
                className={cn(
                    "flex items-center h-14 rounded-xl group px-4 relative transition-[background-color,border-color,color,transform] duration-fast ease-out-strong w-full",
                    "active:scale-95 font-bold justify-center md:w-14 w-full md:px-0",
                    audioMasterOn
                        ? "text-on-surface bg-white/[0.08]"
                        : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] text-on-surface-variant hover:text-on-surface"
                )}
            >
                {/* Active Indicator Line */}
                <div className={cn(
                    "absolute left-0 w-1 h-6 bg-on-surface rounded-r-full transition-[transform,opacity] duration-base ease-smooth-out hidden md:block",
                    audioMasterOn ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                )} />

                <span className={cn(
                    "shrink-0 z-10 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-fast ease-out-strong relative",
                    audioMasterOn && "text-on-surface"
                )}>
                    {audioMasterOn ? (
                        <IconStatusMusic className="w-5 h-5 text-on-surface" />
                    ) : (
                        <IconStatusMusicOff className="w-5 h-5 relative z-10" />
                    )}
                </span>

                <div className="flex flex-col text-left transition-colors whitespace-nowrap min-w-0 flex-1 hidden md:hidden">
                    <span className={cn(
                        "text-xs font-bold z-10",
                        audioMasterOn ? "text-on-surface" : "group-hover:text-on-surface"
                    )}>
                        {audioMasterOn ? "Audio activado" : "Audio silenciado"}
                    </span>
                    {activeSeriesInfo && audioMasterOn && (
                        <span className="text-2xs text-brand-accent-readable truncate font-medium">
                            {activeSeriesInfo.shortName} OST
                        </span>
                    )}
                </div>
            </button>
        </div>
    )
}
