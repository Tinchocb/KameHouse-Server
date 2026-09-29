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

/**
 * El motor soporta cambiar de pista de audio en direct play (`video.audioTracks`).
 * En Chromium/WebView2 está detrás del flag Blink `AudioVideoTracks`, que la app
 * de escritorio activa; en un navegador común no está y se cae al transcode.
 */
export function supportsNativeAudioTracks(): boolean {
    return typeof HTMLMediaElement !== "undefined" && "audioTracks" in HTMLMediaElement.prototype
}

/**
 * Si el navegador decodifica este codec de audio en direct play. Chromium omite
 * de `video.audioTracks` las pistas que no decodifica (ej. AC3 en Chrome), así
 * que esto también define qué pistas aparecen en la lista nativa.
 */
export function isAudioCodecNativelyPlayable(codec: string | undefined): boolean {
    const c = (codec || "").toLowerCase()
    if (["aac", "mp3", "opus", "vorbis", "flac"].includes(c) || c.startsWith("pcm")) return true
    const caps = getClientCapabilities()
    if (c === "ac3") return caps.ac3
    if (c === "eac3") return caps.eac3
    if (c === "dts") return caps.dts
    return false
}
