'use no memo'
import { useEffect, useRef } from "react"
import { VideoCorePgsRenderer, PgsEvent } from "./player-pgs-renderer"
import { SubtitleTrack } from "@/components/ui/track-types"

interface UsePlayerPgsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    setIsPgsLoading: (loading: boolean) => void
    setIsPgsActive: (active: boolean) => void
}

export function usePlayerPgs({
    videoRef,
    subtitleTracks,
    activeSubtitleIndex,
    setIsPgsLoading,
    setIsPgsActive,
}: UsePlayerPgsProps) {
    const pgsRendererRef = useRef<VideoCorePgsRenderer | null>(null)

    const activeTrack = activeSubtitleIndex !== null && subtitleTracks 
        ? subtitleTracks.find(t => t.index === activeSubtitleIndex) ?? null 
        : null

    const trackUrl = activeTrack?.url
    const trackCodec = activeTrack?.codec

    useEffect(() => {
        return () => {
            if (pgsRendererRef.current) {
                pgsRendererRef.current.destroy()
                pgsRendererRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const video = videoRef.current
        
        if (!video || activeSubtitleIndex === null || !trackUrl) {
            if (pgsRendererRef.current) {
                pgsRendererRef.current.clear()
                pgsRendererRef.current.destroy()
                pgsRendererRef.current = null
                Promise.resolve().then(() => {
                    setIsPgsLoading(false)
                    setIsPgsActive(false)
                })
            }
            return
        }

        const codec = trackCodec?.toLowerCase() ?? ""
        const isSupported = codec === "hdmv_pgs_subtitle" || codec === "pgssub" || codec === "pgs"

        if (!isSupported) {
            if (pgsRendererRef.current) {
                pgsRendererRef.current.clear()
                pgsRendererRef.current.destroy()
                pgsRendererRef.current = null
                Promise.resolve().then(() => {
                    setIsPgsLoading(false)
                    setIsPgsActive(false)
                })
            }
            return
        }

        let isCancelled = false
        const aborter = new AbortController()

        Promise.resolve().then(() => {
            setIsPgsLoading(true)
        })

        const loadPgs = async () => {
            try {
                if (!pgsRendererRef.current) {
                    pgsRendererRef.current = new VideoCorePgsRenderer({
                        videoElement: video,
                        debug: process.env.NODE_ENV === "development",
                    })
                }

                const pgsUrl = trackUrl

                const res = await fetch(pgsUrl, { signal: aborter.signal })
                if (!res.ok) throw new Error(`PGS fetch ${res.status}`)
                const events = (await res.json()) as PgsEvent[]

                if (isCancelled || aborter.signal.aborted) return

                pgsRendererRef.current.clear()
                if (events && events.length > 0) {
                    pgsRendererRef.current.addEvents(events)
                }

                setIsPgsActive(true)
                setIsPgsLoading(false)
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return
                console.error("Failed to load PGS events:", err)
                if (!isCancelled) {
                    setIsPgsLoading(false)
                    setIsPgsActive(false)
                }
            }
        }

        loadPgs()

        return () => {
            isCancelled = true
            try {
                aborter.abort()
            } catch {}
            if (pgsRendererRef.current) {
                pgsRendererRef.current.clear()
                pgsRendererRef.current.destroy()
                pgsRendererRef.current = null
                setIsPgsLoading(false)
                setIsPgsActive(false)
            }
        }
    }, [activeSubtitleIndex, trackUrl, trackCodec, videoRef, setIsPgsLoading, setIsPgsActive])
}
