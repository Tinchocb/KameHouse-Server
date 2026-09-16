import type { Mediastream_ClientCapabilities } from "@/api/generated/types"

let cached: Mediastream_ClientCapabilities | null = null

function canPlay(video: HTMLVideoElement, type: string): boolean {
    // canPlayType returns "probably" | "maybe" | "" — anything non-empty counts.
    if (video.canPlayType(type) !== "") return true
    try {
        return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(type)
    } catch {
        return false
    }
}

/**
 * Probes the codecs/containers this browser can decode natively so the server
 * can make the direct-play-vs-transcode decision against the real client
 * instead of assuming a Chromium engine. Result is cached for the session
 * (browser capabilities don't change at runtime).
 */
export function getClientCapabilities(): Mediastream_ClientCapabilities {
    if (cached) return cached
    if (typeof document === "undefined" || typeof navigator === "undefined") {
        // SSR/prerender: sin DOM no se puede probar; reportar conservador (todo false).
        cached = {
            hevc: false,
            hevc10Bit: false,
            av1: false,
            vp9: false,
            ac3: false,
            eac3: false,
            dts: false,
            matroska: false,
        }
        return cached
    }
    const video = document.createElement("video")

    // Matroska solo si el contenedor + codecs base son decodificables de verdad.
    // El hack anterior (isChromium → true siempre) marcaba MKV/HEVC como direct-play
    // aunque el codec interno no fuera soportado → pantalla negra + fallback tardío.
    const matroskaByCodec =
        canPlay(video, 'video/x-matroska; codecs="avc1.42E01E, mp4a.40.2"') ||
        canPlay(video, 'video/x-matroska; codecs="avc1.42E01E"')
    const h264 = canPlay(video, 'video/mp4; codecs="avc1.42E01E"')
    const matroska = matroskaByCodec && h264

    cached = {
        // hvc1.1.6.L123.B0 = Main profile (8-bit); hvc1.2.4.L123.B0 = Main 10.
        hevc: canPlay(video, 'video/mp4; codecs="hvc1.1.6.L123.B0"'),
        hevc10Bit: canPlay(video, 'video/mp4; codecs="hvc1.2.4.L123.B0"'),
        av1: canPlay(video, 'video/mp4; codecs="av01.0.08M.08"'),
        vp9: canPlay(video, 'video/webm; codecs="vp9"'),
        ac3: canPlay(video, 'audio/mp4; codecs="ac-3"'),
        eac3: canPlay(video, 'audio/mp4; codecs="ec-3"'),
        dts: canPlay(video, 'audio/mp4; codecs="dtsc"'),
        matroska,
    }
    return cached
}
