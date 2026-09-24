'use no memo'
import { useCallback, useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { usePlayerStore } from "@/lib/store"

interface UsePlayerVolumeInput {
    videoRef: React.RefObject<HTMLVideoElement | null>
    status: "loading" | "ready" | "error"
}

function setVideoElementProps(video: HTMLVideoElement | null, volume?: number, muted?: boolean): void {
    if (!video) return
    if (volume !== undefined && Math.abs(video.volume - volume) > 0.001) {
        video.volume = volume
    }
    if (muted !== undefined) {
        video.muted = muted
    }
}

/**
 * Volumen del player con persistencia en store y sincronización con el
 * elemento <video>. Extraído de player-core (cluster D3).
 */
export function usePlayerVolume({ videoRef, status }: UsePlayerVolumeInput) {
    // D3: initialize from the persisted store so volume survives page reloads.
    const { playerVolume: persistedVolume, setPlayerVolume } = usePlayerStore(
        useShallow(state => ({ playerVolume: state.playerVolume, setPlayerVolume: state.setPlayerVolume }))
    )
    const [volume, setVolume] = useState(() => persistedVolume ?? 1)
    const [isMuted, setIsMuted] = useState(false)
    const isMutedRef = useRef(isMuted)
    useEffect(() => {
        isMutedRef.current = isMuted
    }, [isMuted])

    // D3: last non-zero volume before a mute, so we can restore it on unmute.
    const lastNonZeroVolumeRef = useRef(persistedVolume > 0 ? persistedVolume : 1)

    // D3: Sync the <video> element volume with the persisted value.
    const [prevPersistedVolume, setPrevPersistedVolume] = useState(persistedVolume)
    if (persistedVolume !== prevPersistedVolume) {
        setPrevPersistedVolume(persistedVolume)
        const v = persistedVolume ?? 1
        setVolume(v)
        setIsMuted(v === 0)
    }

    // Antes era single-shot con volumeSyncedRef; si el <video> aún no existía
    // (Hls montaje tardío) nunca sincronizaba, y cambios posteriores en
    // settings (persistedVolume) no propagaban al elemento.
    useEffect(() => {
        const v = persistedVolume ?? 1
        setVideoElementProps(videoRef.current, v, v === 0)
    }, [videoRef, persistedVolume])

    useEffect(() => {
        if (status !== "ready") return
        const v = persistedVolume ?? 1
        // Respetar el silencio del usuario (tecla M / botón): al pasar al siguiente
        // episodio o cambiar de pista el estado vuelve a "ready" y antes se forzaba
        // muted=false mientras el ícono seguía mostrando "silenciado".
        setVideoElementProps(videoRef.current, v, isMutedRef.current || v === 0)
    }, [videoRef, status, persistedVolume])

    const handleVolume = useCallback((eOrVal: React.ChangeEvent<HTMLInputElement> | number) => {
        const video = videoRef.current
        if (!video) return
        const rawVal = typeof eOrVal === "number" ? eOrVal : parseFloat(eOrVal.target.value)
        const val = Math.max(0, Math.min(1, rawVal))
        setVideoElementProps(video, val, val === 0)
        setVolume(val)
        setIsMuted(val === 0)
        // D3: persist and track last non-zero volume.
        setPlayerVolume(val)
        if (val > 0) lastNonZeroVolumeRef.current = val
    }, [videoRef, setPlayerVolume])

    const toggleMute = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const nextMute = !isMuted

        if (!nextMute) {
            // Restore the last non-zero volume instead of defaulting to 1.
            const restore = lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 1
            setVideoElementProps(video, restore, false)
            setVolume(restore)
            setPlayerVolume(restore)
        } else {
            setVideoElementProps(video, undefined, true)
        }

        setIsMuted(nextMute)
    }, [videoRef, isMuted, setPlayerVolume])

    return { volume, isMuted, setVolume, setIsMuted, handleVolume, toggleMute }
}
