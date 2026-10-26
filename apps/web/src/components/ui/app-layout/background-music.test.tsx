import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useUIStore } from "@/lib/store"
import { BackgroundMusicPlayer } from "./background-music"

vi.mock("@/lib/server/persist-settings", () => ({ persistThemePatch: vi.fn() }))

let audio: HTMLAudioElement
let createdAudio: HTMLAudioElement[]

function createAudio() {
    const element = document.createElement("audio")
    vi.spyOn(element, "play").mockResolvedValue(undefined)
    vi.spyOn(element, "pause").mockImplementation(() => {})
    vi.spyOn(element, "load").mockImplementation(() => {})
    return element
}

beforeEach(() => {
    vi.useFakeTimers()
    audio = createAudio()
    createdAudio = []
    vi.stubGlobal("Audio", vi.fn(function () {
        const incoming = createAudio()
        createdAudio.push(incoming)
        return incoming
    }))
    window.__kamehouse_bg_audio = audio
    useUIStore.setState({ bgMusicEnabled: true, bgMusicVolume: 0.25, bgMusicDir: "", bgMusicTracks: [], isVideoActive: false, eraOpeningPlaying: false, activeSeriesContext: "dragon_ball", seriesSoundtrackMode: true })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete window.__kamehouse_bg_audio
    delete window.__kamehouse_bg_audio_outgoing
})

describe("música contextual", () => {
    it("usa el instrumental de la tarjeta y repite una playlist de una pista", () => {
        render(<BackgroundMusicPlayer headless />)
        expect(audio.src).toContain("/opening-instrumentals/db.m4a")
        expect(audio.loop).toBe(true)
        expect(audio.play).toHaveBeenCalledOnce()
    })

    it("mantiene la pista al entrar a episodios de la misma serie", () => {
        render(<BackgroundMusicPlayer headless />)
        vi.mocked(audio.load).mockClear()
        act(() => useUIStore.setState({ activeSeriesContext: "12609" }))
        act(() => vi.advanceTimersByTime(650))
        expect(audio.load).not.toHaveBeenCalled()
        expect(audio.src).toContain("/opening-instrumentals/db.m4a")
    })

    it("cambia a la nueva serie después de asentarse la selección", () => {
        render(<BackgroundMusicPlayer headless />)
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        expect(audio.src).toContain("/opening-instrumentals/db.m4a")
        act(() => vi.advanceTimersByTime(650))
        expect(audio.src).toContain("/opening-instrumentals/dbz.m4a")
    })

    it("cancela el fundido pendiente si comienza un episodio", () => {
        render(<BackgroundMusicPlayer headless />)
        vi.spyOn(audio, "paused", "get").mockReturnValue(false)
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        act(() => vi.advanceTimersByTime(650))
        vi.mocked(audio.play).mockClear()
        act(() => useUIStore.setState({ isVideoActive: true }))
        act(() => vi.advanceTimersByTime(1500))
        expect(audio.pause).toHaveBeenCalled()
        expect(audio.play).not.toHaveBeenCalled()
        expect(audio.src).toContain("/opening-instrumentals/db.m4a")
        expect(createdAudio[0].pause).toHaveBeenCalled()
    })

    it("cruza las pistas sin perder potencia y libera la anterior al terminar", async () => {
        render(<BackgroundMusicPlayer headless />)
        vi.spyOn(audio, "paused", "get").mockReturnValue(false)
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        await act(async () => { vi.advanceTimersByTime(650) })
        const incoming = createdAudio[0]
        expect(window.__kamehouse_bg_audio).toBe(incoming)
        expect(incoming.src).toContain("/opening-instrumentals/dbz.m4a")
        expect(audio.pause).not.toHaveBeenCalled()
        act(() => vi.advanceTimersByTime(900))
        expect(audio.volume).toBeGreaterThan(0)
        expect(incoming.volume).toBeGreaterThan(0)
        expect(audio.volume ** 2 + incoming.volume ** 2).toBeCloseTo((0.25 ** 2) ** 2, 7)
        act(() => vi.advanceTimersByTime(950))
        expect(audio.pause).toHaveBeenCalledOnce()
        expect(incoming.volume).toBeCloseTo(0.25 ** 2)
        expect(window.__kamehouse_bg_audio_outgoing).toBeUndefined()
    })

    it("interrumpe ambas pistas si empieza un video durante el cruce", async () => {
        render(<BackgroundMusicPlayer headless />)
        vi.spyOn(audio, "paused", "get").mockReturnValue(false)
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        await act(async () => { vi.advanceTimersByTime(650) })
        const incoming = createdAudio[0]
        act(() => vi.advanceTimersByTime(900))
        act(() => useUIStore.setState({ isVideoActive: true }))
        const stoppedVolume = incoming.volume
        act(() => vi.advanceTimersByTime(2000))
        expect(audio.pause).toHaveBeenCalled()
        expect(incoming.pause).toHaveBeenCalled()
        expect(incoming.volume).toBe(stoppedVolume)
    })

    it("conserva la canción anterior mientras la siguiente carga", async () => {
        render(<BackgroundMusicPlayer headless />)
        vi.spyOn(audio, "paused", "get").mockReturnValue(false)
        vi.mocked(Audio).mockImplementationOnce(function () {
            const incoming = createAudio()
            vi.mocked(incoming.play).mockReturnValue(new Promise(() => {}))
            createdAudio.push(incoming)
            return incoming
        })
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        await act(async () => { vi.advanceTimersByTime(3000) })
        expect(audio.pause).not.toHaveBeenCalled()
        expect(audio.volume).toBe(0.25 ** 2)
        expect(createdAudio[0].volume).toBe(0)
    })

    it("conserva la pista anterior si la nueva no puede reproducirse", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        render(<BackgroundMusicPlayer headless />)
        vi.spyOn(audio, "paused", "get").mockReturnValue(false)
        vi.mocked(Audio).mockImplementationOnce(function () {
            const incoming = createAudio()
            vi.mocked(incoming.play).mockRejectedValue(new Error("Audio unavailable"))
            createdAudio.push(incoming)
            return incoming
        })
        act(() => useUIStore.setState({ activeSeriesContext: "dragon_ball_z" }))
        await act(async () => { vi.advanceTimersByTime(650) })
        expect(window.__kamehouse_bg_audio).toBe(audio)
        expect(audio.pause).not.toHaveBeenCalled()
        expect(window.__kamehouse_bg_audio_outgoing).toBeUndefined()
        expect(createdAudio[0].pause).toHaveBeenCalled()
    })

    it.each([{ isVideoActive: true }, { eraOpeningPlaying: true }, { bgMusicEnabled: false }])("pausa por %j y retoma sin volver a cargar", state => {
        render(<BackgroundMusicPlayer headless />)
        vi.mocked(audio.load).mockClear()
        vi.mocked(audio.play).mockClear()
        act(() => useUIStore.setState(state))
        expect(audio.pause).toHaveBeenCalled()
        expect(audio.play).not.toHaveBeenCalled()
        act(() => useUIStore.setState({ isVideoActive: false, eraOpeningPlaying: false, bgMusicEnabled: true }))
        expect(audio.play).toHaveBeenCalledOnce()
        expect(audio.load).not.toHaveBeenCalled()
    })
})
