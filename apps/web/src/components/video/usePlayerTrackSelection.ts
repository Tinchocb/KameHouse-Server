'use no memo'
import { useCallback, useEffect, useRef, useState } from "react"
import type Hls from "hls.js"
import { useShallow } from "zustand/react/shallow"
import { usePlayerStore } from "@/lib/store"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { PlayerCoreProps } from "./player-core.types"
import {
    computeAudioTracksKey,
    computeSubtitleTracksKey,
    matchPendingAudioTrack,
    matchPreferredAudioTrack,
    resolveAutoSubtitleTarget,
} from "./track-selection"

interface UsePlayerTrackSelectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.RefObject<Hls | null>
    playableUrl: string
    mediaId?: number | null
    streamType?: PlayerCoreProps["streamType"]
    onRequestStreamTypeChange?: PlayerCoreProps["onRequestStreamTypeChange"]
    /** La pista de audio forzó un direct → transcode; `resumeAt` es la posición a retomar. */
    onAudioStreamSwitch: (resumeAt: number | null) => void
}

/**
 * Pistas de audio/subtítulos: estado, selección manual y auto-selección por
 * preferencias (una sola vez por lista de pistas, para no pisar la elección
 * manual del usuario).
 */
export function usePlayerTrackSelection({
    videoRef,
    hlsRef,
    playableUrl,
    mediaId,
    streamType,
    onRequestStreamTypeChange,
    onAudioStreamSwitch,
}: UsePlayerTrackSelectionProps) {
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)

    const {
        preferredAudioProfile,
        preferredAudioLang,
        setPreferredAudioLang,
        preferredAudioTrackIndexMap,
        setPreferredAudioTrackIndexMap,
        preferredSubtitleLang,
        setPreferredSubtitleLang,
        subtitlesEnabled,
        setSubtitlesEnabled,
        autoDisableSubtitlesWhenDubbed,
    } = usePlayerStore(
        useShallow(state => ({
            preferredAudioProfile: state.preferredAudioProfile,
            preferredAudioLang: state.preferredAudioLang,
            setPreferredAudioLang: state.setPreferredAudioLang,
            preferredAudioTrackIndexMap: state.preferredAudioTrackIndex,
            setPreferredAudioTrackIndexMap: state.setPreferredAudioTrackIndex,
            preferredSubtitleLang: state.preferredSubtitleLang,
            setPreferredSubtitleLang: state.setPreferredSubtitleLang,
            subtitlesEnabled: state.subtitlesEnabled,
            setSubtitlesEnabled: state.setSubtitlesEnabled,
            autoDisableSubtitlesWhenDubbed: state.autoDisableSubtitlesWhenDubbed,
        }))
    )

    const preferredAudioTrackIndex = mediaId ? (preferredAudioTrackIndexMap[mediaId] ?? -1) : -1
    const setPreferredAudioTrackIndex = useCallback((index: number) => {
        if (mediaId) setPreferredAudioTrackIndexMap(mediaId, index)
    }, [mediaId, setPreferredAudioTrackIndexMap])

    // Nuevo episodio o URL distinta: las pistas del stream anterior ya no aplican.
    // Reset en render (no en un setTimeout de efecto): usePlayerHls siembra las
    // pistas del backend en un efecto del mismo commit, y el timer las vaciaba
    // después — en direct play (URL + mediaInfo juntos) el menú quedaba sin pistas.
    const [tracksUrl, setTracksUrl] = useState(playableUrl)
    if (tracksUrl !== playableUrl) {
        setTracksUrl(playableUrl)
        setAudioTracks([])
        setSubtitleTracks([])
        setActiveAudioIndex(0)
        setActiveSubtitleIndex(null)
    }

    // Selección de audio pendiente tras un cambio de stream (direct → transcode):
    // se aplica cuando llega la nueva lista de pistas HLS.
    const pendingAudioSelectionRef = useRef<AudioTrack | null>(null)

    // opts.auto === true → selección automática (preferencia): nunca forzar transcode.
    // Sin opts (o auto === false) → selección manual del usuario.
    const onSelectAudio = useCallback((track: AudioTrack, opts?: { auto?: boolean }) => {
        const isAuto = opts?.auto === true
        const hls = hlsRef.current
        if (hls) {
            // Use hlsId (hls.js sequential manifest position) for hls.audioTrack.
            // `track.index` is the ABSOLUTE container index (used in backend URIs);
            // hls.js expects the positional id within its own audioTracks list.
            // hlsId is set during AUDIO_TRACKS_UPDATED merging; fall back to index
            // only when hlsId is not available (e.g. backend-only fallback list).
            // eslint-disable-next-line react-compiler/react-compiler -- instancia hls.js vía ref (hook con use no memo)
            hls.audioTrack = track.hlsId ?? track.index
        } else if (videoRef.current && 'audioTracks' in videoRef.current && (videoRef.current as HTMLVideoElement & { audioTracks: AudioTrackList }).audioTracks?.length > 0) {
            const video = videoRef.current as HTMLVideoElement & { audioTracks: AudioTrackList }
            const trackList = Array.from(video.audioTracks)
            for (let i = 0; i < trackList.length; i++) {
                trackList[i].enabled = i === track.index
            }
        } else if (streamType === "direct" || streamType === "local") {
            // Chromium/WebView2 no soporta la API nativa de audioTracks en direct play.
            if (isAuto) {
                // Auto-selección: solo persistir la preferencia de idioma y mantener
                // direct play con la pista por defecto. No disparar transcode.
                if (track.language && track.language.toLowerCase() !== "und") {
                    setPreferredAudioLang(track.language)
                }
                return
            } else if (onRequestStreamTypeChange) {
                // Selección manual explícita del usuario. Chromium/WebView2 no puede
                // cambiar de pista sin reconstruir el stream, así que forzamos el salto a
                // HLS transcode aunque el toggle global esté apagado: force:true permite al
                // backend inicializar el transcoder on-demand. Para fuentes H264 el video se
                // copia (-c:v copy) y solo se re-encodea el audio a AAC, así que es barato.
                pendingAudioSelectionRef.current = track
                onAudioStreamSwitch(videoRef.current?.currentTime ?? null)
                onRequestStreamTypeChange("transcode", { force: true })
            }
        }
        setActiveAudioIndex(track.index)
        if (!isAuto) {
            // Guardar el índice como fallback persistido, ideal para "und".
            setPreferredAudioTrackIndex(track.index)
            // "und" (unlabeled track, común en MKVs de anime) no identifica un idioma:
            // persistirlo hacía que en el siguiente episodio se auto-seleccionara la
            // PRIMERA pista sin etiqueta (normalmente japonés) en vez de la elegida.
            if (track.language && track.language.toLowerCase() !== "und") {
                setPreferredAudioLang(track.language)
            }
        }
    }, [hlsRef, videoRef, setPreferredAudioLang, setPreferredAudioTrackIndex, onRequestStreamTypeChange, onAudioStreamSwitch, streamType])

    const onSelectSubtitle = useCallback((track: SubtitleTrack | null, opts?: { auto?: boolean }) => {
        const isAuto = opts?.auto === true
        const hls = hlsRef.current
        if (track === null) {
            setActiveSubtitleIndex(null)
            if (!isAuto) setSubtitlesEnabled(false)
            if (hls) hls.subtitleTrack = -1
        } else {
            if (hls) hls.subtitleTrack = track.index
            setActiveSubtitleIndex(track.index)
            if (!isAuto) setSubtitlesEnabled(true)
            if (!isAuto && track.language) {
                setPreferredSubtitleLang(track.language)
            }
        }
    }, [hlsRef, setPreferredSubtitleLang, setSubtitlesEnabled])

    // Guarda: auto-seleccionar UNA sola vez por lista de pistas (por stream).
    // Este efecto también se re-dispara cuando el usuario cambia de pista
    // manualmente (activeAudioIndex está en las deps) — sin esta guarda, la
    // heurística "Latino primero" revertía la selección manual al instante
    // y el menú de audio parecía no funcionar.
    //
    // D4: La guarda usa una clave de CONTENIDO estable en lugar de identidad de array.
    // Si React crea un nuevo array con los mismos elementos (ej. re-render de HLS),
    // la comparación por referencia fallaba y se re-ejecutaba la auto-selección,
    // pisando la elección manual. La clave "index:lang|..." es estable mientras
    // el contenido de las pistas no cambie.
    const audioAutoSelectedForRef = useRef<string | null>(null)
    const audioTracksKey = computeAudioTracksKey(audioTracks)
    useEffect(() => {
        if (audioTracks.length === 0) return

        // Prioridad máxima: pista elegida explícitamente por el usuario antes
        // de un cambio de stream (direct → transcode).
        const pending = pendingAudioSelectionRef.current
        if (pending) {
            pendingAudioSelectionRef.current = null
            const match = matchPendingAudioTrack(audioTracks, pending)
            if (match) {
                audioAutoSelectedForRef.current = audioTracksKey
                if (activeAudioIndex !== match.index) onSelectAudio(match)
                return
            }
        } else if (audioAutoSelectedForRef.current === audioTracksKey) {
            return
        }
        audioAutoSelectedForRef.current = audioTracksKey

        const preferred = matchPreferredAudioTrack({
            tracks: audioTracks,
            preferredAudioProfile,
            preferredAudioLang,
            preferredAudioTrackIndex,
        })

        if (preferred && activeAudioIndex !== preferred.index) {
            // Pasar { auto: true } para que en direct play no dispare transcode.
            onSelectAudio(preferred, { auto: true })
        }
    }, [audioTracksKey, preferredAudioProfile, preferredAudioLang, preferredAudioTrackIndex, activeAudioIndex, onSelectAudio, audioTracks])

    // Misma guarda que el audio: auto-configurar subtítulos UNA vez por lista
    // de pistas.
    const subtitleAutoSelectedForRef = useRef<string | null>(null)
    const subtitleTracksKey = computeSubtitleTracksKey(subtitleTracks)
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []
        if (subtitleTracks.length > 0 && subtitleAutoSelectedForRef.current !== subtitleTracksKey) {
            subtitleAutoSelectedForRef.current = subtitleTracksKey
            const currentAudio = audioTracks.find(t => t.index === activeAudioIndex)
            const targetSubtitle = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio,
                subtitlesEnabled,
                autoDisableSubtitlesWhenDubbed,
                preferredSubtitleLang,
            })

            if (targetSubtitle === null) {
                if (activeSubtitleIndex !== null) {
                    timers.push(setTimeout(() => onSelectSubtitle(null, { auto: true }), 0))
                }
            } else if (activeSubtitleIndex !== targetSubtitle.index) {
                timers.push(setTimeout(() => onSelectSubtitle(targetSubtitle, { auto: true }), 0))
            }
        }
        return () => timers.forEach(clearTimeout)
    }, [subtitleTracksKey, subtitleTracks, audioTracks, activeAudioIndex, preferredSubtitleLang, autoDisableSubtitlesWhenDubbed, activeSubtitleIndex, onSelectSubtitle, subtitlesEnabled])

    return {
        audioTracks,
        setAudioTracks,
        activeAudioIndex,
        setActiveAudioIndex,
        subtitleTracks,
        setSubtitleTracks,
        activeSubtitleIndex,
        onSelectAudio,
        onSelectSubtitle,
    }
}
