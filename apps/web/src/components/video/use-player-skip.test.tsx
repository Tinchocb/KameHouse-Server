import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import { usePlayerSkip } from "./usePlayerSkip"
import { useSkipTimesStore, usePlayerStore } from "@/lib/store"
import type { AniSkipWindows, Chapter } from "./skip-windows"

const mocks = vi.hoisted(() => ({ aniskip: undefined as unknown }))
vi.mock("@/api/hooks/aniskip.hooks", () => ({
    useAniSkipTimes: () => ({ data: mocks.aniskip }),
    getAniSkipTimes: vi.fn(),
}))
vi.mock("@/api/hooks/settings.hooks", () => ({ useGetSettings: () => ({ data: undefined }) }))
vi.mock("@/api/hooks/mediastream.hooks", () => ({
    usePreloadMediastreamMediaContainer: () => ({ mutate: vi.fn() }),
}))
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }))

function fakeVideo() {
    const v = new EventTarget() as EventTarget & Record<string, unknown>
    Object.assign(v, { currentTime: 0, duration: 1400, ended: false, paused: false })
    v.play = vi.fn(() => Promise.resolve())
    v.pause = vi.fn()
    return v
}

type Video = ReturnType<typeof fakeVideo>

function setup(over: Record<string, unknown> = {}, aniskip?: AniSkipWindows) {
    mocks.aniskip = aniskip
    const video = fakeVideo()
    const videoRef = { current: video } as unknown as React.RefObject<HTMLVideoElement | null>
    const onNextEpisode = vi.fn()
    const base = {
        videoRef,
        playableUrl: "http://x/ep1.m3u8",
        duration: 1400,
        isPlaying: true,
        malId: 5,
        episodeNumber: 1,
        chapters: [] as Chapter[],
        mediaFormat: "TV",
        autoSkipIntroPref: false,
        autoSkipOutroPref: false,
        skipStepSecondsPref: 85,
        hasNextEpisode: true,
        onNextEpisode,
        setAutoSkipIntro: vi.fn(),
        setAutoSkipOutro: vi.fn(),
        triggerControlsVisibility: vi.fn(),
        tvMode: false,
        setTvMode: vi.fn(),
    }
    const props = { ...base, ...over }
    const hook = renderHook((p: typeof props) => usePlayerSkip(p), { initialProps: props })
    return { ...hook, video: video as Video, onNextEpisode, props }
}

const OP = { op: { startTime: 10, endTime: 100 } }
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const endVideo = (v: Video) => act(() => { v.ended = true; v.dispatchEvent(new Event("ended")) })

describe("usePlayerSkip", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
        useSkipTimesStore.setState({ seriesSkipTimes: {} })
        usePlayerStore.setState({ marathonMode: false })
    })
    afterEach(() => vi.useRealTimers())

    it("resuelve las ventanas y las expone", () => {
        const { result } = setup({}, { ...OP, ed: { startTime: 1300, endTime: 1390 } })
        expect(result.current.skipTimesOp).toEqual({ startTime: 10, endTime: 100, source: "aniskip" })
        expect(result.current.skipTimesEd).toEqual({ startTime: 1300, endTime: 1390, source: "aniskip" })
    })

    it("dentro de la intro sin auto-skip muestra el botón y el tiempo restante", () => {
        const { result, video } = setup({}, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(result.current.skipMode).toBe("intro")
        expect(result.current.skipRemainingSeconds).toBeGreaterThan(0)
        expect(video.currentTime).toBe(0)
    })

    it("al salir de la ventana se apaga el botón", () => {
        const { result } = setup({}, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(result.current.skipMode).toBe("intro")
        act(() => result.current.processTimeUpdates(200, 1400))
        expect(result.current.skipMode).toBeNull()
    })

    it("con auto-skip salta la intro, avisa y solo lo hace una vez", () => {
        const { result, video } = setup({ autoSkipIntroPref: true }, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(100)
        expect(result.current.showAutoSkipToast).toBe("intro")
        expect(result.current.skipMode).toBeNull()

        video.currentTime = 0
        vi.setSystemTime(Date.now() + 2000) // fuera del enfriamiento de seek
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(0)
    })

    it("el aviso de auto-skip desaparece solo a los 3 s", async () => {
        const { result } = setup({ autoSkipIntroPref: true }, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(result.current.showAutoSkipToast).toBe("intro")
        await tick(3000)
        expect(result.current.showAutoSkipToast).toBeNull()
    })

    it("el enfriamiento tras un salto ignora las actualizaciones siguientes", () => {
        const { result, video } = setup({ autoSkipIntroPref: true }, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(100)
        video.currentTime = 0
        act(() => result.current.processTimeUpdates(20, 1400)) // dentro de los 800 ms
        expect(video.currentTime).toBe(0)
    })

    it("detecta el capítulo activo", () => {
        const chapters: Chapter[] = [
            { startTime: 0, endTime: 30, name: "Prólogo" },
            { startTime: 30, endTime: 1300, name: "Episodio" },
        ]
        const { result } = setup({ chapters })
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(result.current.activeChapter).toBe("Prólogo")
        act(() => result.current.processTimeUpdates(500, 1400))
        expect(result.current.activeChapter).toBe("Episodio")
    })

    it("cambiar de episodio reinicia el estado", () => {
        const { result, rerender, props } = setup({}, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(result.current.skipMode).toBe("intro")
        rerender({ ...props, episodeNumber: 2, playableUrl: "http://x/ep2.m3u8" })
        expect(result.current.skipMode).toBeNull()
        expect(result.current.showNextEpisode).toBe(false)
        expect(result.current.countdownSeconds).toBe(5)
    })

    it("cerca del final ofrece el siguiente episodio y cuenta hacia atrás hasta avanzar", async () => {
        const { result, video, onNextEpisode } = setup({}, { ...OP, ed: { startTime: 1300, endTime: 1390 } })
        video.currentTime = 1396
        act(() => result.current.processTimeUpdates(1396, 1400))
        expect(result.current.showNextEpisode).toBe(true)
        expect(result.current.showCountdown).toBe(true)
        expect(result.current.countdownSeconds).toBe(5)
        expect(result.current.remainingProgress).toBe(100)

        await tick(1000)
        expect(result.current.countdownSeconds).toBe(4)
        expect(result.current.remainingProgress).toBe(80)
        expect(onNextEpisode).not.toHaveBeenCalled()

        // Cada tick se programa tras renderizar: se avanza de a un segundo.
        for (let s = 3; s >= 0; s--) {
            await tick(1000)
            expect(result.current.countdownSeconds).toBe(s)
        }
        expect(onNextEpisode).toHaveBeenCalledTimes(1)
    })

    it("al terminar el video avanza al siguiente a los 1 s, y en modo TV a los 5 s", async () => {
        const a = setup()
        endVideo(a.video)
        await tick(999)
        expect(a.onNextEpisode).not.toHaveBeenCalled()
        await tick(1)
        expect(a.onNextEpisode).toHaveBeenCalledTimes(1)
        a.unmount()

        const b = setup({ tvMode: true })
        endVideo(b.video)
        await tick(4999)
        expect(b.onNextEpisode).not.toHaveBeenCalled()
        await tick(1)
        expect(b.onNextEpisode).toHaveBeenCalledTimes(1)
    })

    it("no avanza al terminar si no hay siguiente episodio o es una película", async () => {
        const a = setup({ hasNextEpisode: false })
        endVideo(a.video)
        await tick(6000)
        expect(a.onNextEpisode).not.toHaveBeenCalled()
        a.unmount()

        const b = setup({ mediaFormat: "MOVIE" })
        endVideo(b.video)
        await tick(6000)
        expect(b.onNextEpisode).not.toHaveBeenCalled()
    })

    it("en maratón avanza en cuanto termina el video", async () => {
        usePlayerStore.setState({ marathonMode: true })
        const { video, onNextEpisode } = setup()
        endVideo(video)
        await tick(0)
        expect(onNextEpisode).toHaveBeenCalledTimes(1)
    })

    it("nunca dispara dos avances para el mismo episodio", async () => {
        const { result, video, onNextEpisode } = setup()
        endVideo(video)
        await tick(1000)
        act(() => result.current.processTimeUpdates(1399, 1400))
        await tick(6000)
        expect(onNextEpisode).toHaveBeenCalledTimes(1)
    })

    it("skipOpening lleva al final de la intro y, fuera de ella, avanza el paso configurado", () => {
        const { result, video } = setup({}, OP)
        video.currentTime = 40
        act(() => result.current.skipOpening())
        expect(video.currentTime).toBe(100)

        video.currentTime = 300
        act(() => result.current.skipOpening())
        expect(video.currentTime).toBe(385) // 300 + skipStepSecondsPref (85)
    })

    it("undoSkip vuelve a donde estaba antes de un auto-skip", () => {
        const { result, video } = setup({ autoSkipIntroPref: true }, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(100)
        act(() => result.current.undoSkip())
        expect(video.currentTime).toBe(20)
        expect(result.current.showAutoSkipToast).toBeNull()
    })

    it("undoSkip no hace nada si no hubo un salto previo", () => {
        const { result, video } = setup({}, OP)
        video.currentTime = 55
        act(() => result.current.undoSkip())
        expect(video.currentTime).toBe(55)
    })
})
