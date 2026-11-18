import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type React from "react"
import type Hls from "hls.js"
import { usePlayerStore } from "@/lib/store"
import type { SubtitleTrack } from "@/components/ui/track-types"
import { usePlayerTrackSelection } from "./usePlayerTrackSelection"

// El perfil de audio por serie viene del servidor: aquí no interesa.
vi.mock("@/api/hooks/media_audio.hooks", () => ({
    useMediaAudioProfiles: () => ({ isPending: false, data: [] }),
}))

afterEach(() => {
    cleanup() // desmontar antes de reiniciar el store: evita updates fuera de act
    usePlayerStore.setState(usePlayerStore.getInitialState(), true)
    localStorage.removeItem("kamehouse-player-settings")
})

function renderSelection() {
    const videoRef = { current: null } as React.RefObject<HTMLVideoElement | null>
    const hlsRef = { current: null } as React.RefObject<Hls | null>
    return renderHook(() => usePlayerTrackSelection({
        videoRef,
        hlsRef,
        playableUrl: "/video",
        mediaId: 1,
        onAudioStreamSwitch: vi.fn(),
    }))
}

const spanish: SubtitleTrack = { index: 0, language: "spa", title: "Español", codec: "ass" }

describe("usePlayerTrackSelection: idioma preferido de subtítulos", () => {
    it("recuerda el idioma de la pista que elige el usuario", () => {
        usePlayerStore.getState().setPreferredSubtitleLang("eng")
        const { result } = renderSelection()

        act(() => result.current.onSelectSubtitle(spanish))

        expect(usePlayerStore.getState().preferredSubtitleLang).toBe("spa")
    })

    it.each(["und", "UND", "unknown", ""])(
        'una pista con idioma "%s" no pisa la preferencia, pero sí activa los subtítulos',
        (language) => {
            usePlayerStore.getState().setPreferredSubtitleLang("spa")
            usePlayerStore.getState().setSubtitlesEnabled(false)
            const { result } = renderSelection()

            act(() => result.current.onSelectSubtitle({ index: 1, language, title: "", codec: "ass" }))

            expect(usePlayerStore.getState().preferredSubtitleLang).toBe("spa")
            expect(usePlayerStore.getState().subtitlesEnabled).toBe(true)
            expect(result.current.activeSubtitleIndex).toBe(1)
        },
    )

    it("la auto-selección nunca cambia la preferencia", () => {
        usePlayerStore.getState().setPreferredSubtitleLang("eng")
        const { result } = renderSelection()

        act(() => result.current.onSelectSubtitle(spanish, { auto: true }))

        expect(usePlayerStore.getState().preferredSubtitleLang).toBe("eng")
        expect(result.current.activeSubtitleIndex).toBe(0)
    })
})
