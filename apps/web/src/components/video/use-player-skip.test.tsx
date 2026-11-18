import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import { usePlayerSkip } from "./usePlayerSkip"
import { useSkipTimesStore, usePlayerStore } from "@/lib/store"
import type { AniSkipWindows, Chapter } from "./skip-windows"
import { QueryClient } from "@tanstack/react-query"
import { aniskipQueryKeys, getAniSkipTimes } from "@/api/hooks/aniskip.hooks"

const mocks = vi.hoisted(() => ({ aniskip: undefined as unknown, queryClient: undefined as QueryClient | undefined }))
vi.mock("@/api/hooks/aniskip.hooks", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/api/hooks/aniskip.hooks")>(),
    useAniSkipTimes: () => ({ data: mocks.aniskip }),
    getAniSkipTimes: vi.fn(),
}))
vi.mock("@/api/hooks/settings.hooks", () => ({ useGetSettings: () => ({ data: undefined }) }))
vi.mock("@/api/hooks/mediastream.hooks", () => ({
    usePreloadMediastreamMediaContainer: () => ({ mutate: vi.fn() }),
}))
vi.mock("@tanstack/react-query", async (importOriginal) => ({
    ...await importOriginal<typeof import("@tanstack/react-query")>(),
    useQueryClient: () => mocks.queryClient,
}))

const card = vi.hoisted(() => ({
    value: undefined as { titleStart: number; songEnd: number } | undefined,
    spy: vi.fn(),
    prefetch: vi.fn(),
}))
vi.mock("./useDriveTitleCard", () => ({
    // Como el hook real: sin ruta de Drive no hay placa.
    useDriveTitleCard: (opts: { path?: string }) => {
        card.spy(opts)
        return opts.path ? card.value : undefined
    },
    prefetchDriveTitleCard: (path: string | undefined) => card.prefetch(path),
}))

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
        mocks.queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        vi.mocked(getAniSkipTimes).mockReset()
        card.value = undefined
        card.spy.mockClear()
        card.prefetch.mockReset()
        useSkipTimesStore.setState({ seriesSkipTimes: {} })
        usePlayerStore.setState({ marathonMode: false })
    })
    afterEach(() => {
        mocks.queryClient?.clear()
        vi.useRealTimers()
    })

    it("el prefetch alimenta la caché que lee el siguiente episodio", async () => {
        const client = mocks.queryClient
        if (!client) throw new Error("QueryClient no inicializado")
        const prefetch = vi.spyOn(client, "prefetchQuery")
        const times = { ...OP, hasSkipTimes: true }
        vi.mocked(getAniSkipTimes).mockResolvedValue(times)
        const { result } = setup({ mediaId: 42, nextStreamUrl: "http://x/ep2.m3u8" })

        act(() => result.current.processTimeUpdates(1390, 1400))
        expect(prefetch).toHaveBeenCalledOnce()
        await prefetch.mock.results[0].value

        const queryKey = aniskipQueryKeys.times(5, 42, 2)
        expect(client.getQueryData(queryKey)).toEqual(times)
        const data = await client.fetchQuery({
            queryKey,
            queryFn: () => getAniSkipTimes({ malId: 5, mediaId: 42, episodeNumber: 2, episodeDuration: 1400 }),
            staleTime: 60_000,
        })
        expect(data).toEqual(times)
        expect(getAniSkipTimes).toHaveBeenCalledOnce()
    })

    it("resuelve las ventanas y las expone", () => {
        const { result } = setup({}, { ...OP, ed: { startTime: 1300, endTime: 1390 } })
        expect(result.current.skipTimesOp).toEqual({ startTime: 10, endTime: 100, source: "aniskip" })
        expect(result.current.skipTimesEd).toEqual({ startTime: 1300, endTime: 1390, source: "aniskip" })
    })

    it.each(["Adelanto", "Próximo capítulo", "Next episode preview"])("permite saltar %s sin descartar la escena posterior", (name) => {
        const { result, video, onNextEpisode } = setup({ chapters: [{ name, startTime: 1300, endTime: 1340 }] })
        video.currentTime = 1310
        act(() => result.current.processTimeUpdates(1310, 1400))
        expect(result.current.skipMode).toBe("preview")
        expect(result.current.skipRemainingSeconds).toBe(30)
        act(() => result.current.handleSkipIntro())
        expect(video.currentTime).toBe(1340)
        expect(onNextEpisode).not.toHaveBeenCalled()
        expect(result.current.skipMode).toBeNull()
    })

    it("el adelanto automático permite deshacer sin volver a saltarlo", async () => {
        const { result, video } = setup({ autoSkipOutroPref: true, chapters: [{ name: "Adelanto", startTime: 1300, endTime: 1340 }] })
        video.currentTime = 1310
        act(() => result.current.processTimeUpdates(1310, 1400))
        expect(video.currentTime).toBe(1340)
        act(() => result.current.undoSkip())
        expect(video.currentTime).toBe(1310)
        await tick(1000)
        act(() => result.current.processTimeUpdates(1310, 1400))
        expect(video.currentTime).toBe(1310)
        expect(result.current.skipMode).toBe("preview")
    })

    it("no ofrece saltar una escena postcréditos como adelanto", () => {
        const { result, video } = setup({ chapters: [{ name: "Escena posterior", startTime: 1320, endTime: 1380 }] }, { ed: { startTime: 1200, endTime: 1320 } })
        video.currentTime = 1340
        act(() => result.current.processTimeUpdates(1340, 1400))
        expect(result.current.skipMode).toBeNull()
    })

    it.each(["Resumen", "Recap", "Prólogo"])("salta %s y el opening contiguo en una sola acción", (name) => {
        const chapters = [{ name, startTime: 0, endTime: 45 }]
        const { result, video } = setup({ chapters }, { op: { startTime: 45, endTime: 135 } })
        video.currentTime = 10
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(result.current.skipMode).toBe("recap")
        expect(result.current.skipRemainingSeconds).toBe(35)
        act(() => result.current.handleSkipIntro())
        expect(video.currentTime).toBe(135)
        expect(result.current.skipMode).toBeNull()
    })

    it("saltar intro incluye el resumen que empieza al terminar el opening", () => {
        const { result, video } = setup({}, { op: { startTime: 0, endTime: 90 }, recap: { startTime: 90, endTime: 150 } })
        video.currentTime = 20
        act(() => result.current.processTimeUpdates(20, 1400))
        act(() => result.current.handleSkipIntro())
        expect(video.currentTime).toBe(150)
    })

    it("no salta escenas entre la intro y un resumen separado", () => {
        const { result, video } = setup({}, { op: { startTime: 0, endTime: 90 }, recap: { startTime: 120, endTime: 150 } })
        video.currentTime = 20
        act(() => result.current.processTimeUpdates(20, 1400))
        act(() => result.current.handleSkipIntro())
        expect(video.currentTime).toBe(90)
    })

    describe("resumen deducido de la placa del título", () => {
        const PLACA = { titleStart: 171.46, songEnd: 98.81 }
        const ANISKIP_OP = { op: { startTime: 0, endTime: 110 } }
        const DRIVE = { drivePath: "gdrive://f/ep.mkv" }

        it("con la placa del título, saltar intro cae en el fin del resumen", () => {
            card.value = PLACA
            const { result, video } = setup(DRIVE, ANISKIP_OP)
            video.currentTime = 20
            act(() => result.current.processTimeUpdates(20, 1400))
            act(() => result.current.handleSkipIntro())
            expect(video.currentTime).toBe(171.46)
        })

        it.each([20, 130])("el atajo desde %i llega a la placa", (time) => {
            card.value = PLACA
            const { result, video } = setup(DRIVE, ANISKIP_OP)
            video.currentTime = time
            act(() => result.current.skipOpening())
            expect(video.currentTime).toBe(171.46)
        })

        it("durante el resumen ofrece Saltar resumen", () => {
            card.value = PLACA
            const { result, video } = setup(DRIVE, ANISKIP_OP)
            video.currentTime = 130
            act(() => result.current.processTimeUpdates(130, 1400))
            expect(result.current.skipMode).toBe("recap")
            act(() => result.current.handleSkipIntro())
            expect(video.currentTime).toBe(171.46)
        })

        it("con salto automático de intro salta el resumen y permite deshacer", () => {
            card.value = PLACA
            const { result, video } = setup({ ...DRIVE, autoSkipIntroPref: true }, ANISKIP_OP)
            video.currentTime = 130
            act(() => result.current.processTimeUpdates(130, 1400))
            expect(video.currentTime).toBe(171.46)
            expect(result.current.showAutoSkipToast).toBe("recap")
            act(() => result.current.undoSkip())
            expect(video.currentTime).toBe(130)
        })

        it.each([false, true])("placa tardía tras saltar intro, navegación manual=%s", async (manualSeek) => {
            const { result, video, rerender, props } = setup(DRIVE, ANISKIP_OP)
            video.currentTime = 20
            act(() => result.current.handleSkipIntro())
            expect(video.currentTime).toBe(110)
            if (manualSeek) act(() => result.current.checkManualSkipOverrides(115))
            video.currentTime = 115
            card.value = PLACA
            rerender(props)
            await tick(1000)
            act(() => result.current.processTimeUpdates(115, 1400))
            expect(video.currentTime).toBe(manualSeek ? 115 : 171.46)
        })

        it("una película no usa la placa", () => {
            card.value = PLACA
            const { result, video } = setup({ ...DRIVE, mediaFormat: "MOVIE" }, ANISKIP_OP)
            expect(card.spy).toHaveBeenCalled()
            expect(card.spy.mock.calls.every(([o]) => (o as { path?: string }).path === undefined)).toBe(true)
            video.currentTime = 130
            act(() => result.current.processTimeUpdates(130, 1400))
            expect(result.current.skipMode).not.toBe("recap")
        })

        it("sin placa todo sigue igual", () => {
            card.value = undefined
            const { result, video } = setup(DRIVE, ANISKIP_OP)
            video.currentTime = 130
            act(() => result.current.processTimeUpdates(130, 1400))
            expect(result.current.skipMode).not.toBe("recap")
        })
    })

    it("cerca del final precarga la placa del título del siguiente episodio de Drive", () => {
        vi.mocked(getAniSkipTimes).mockResolvedValue({ ...OP, hasSkipTimes: true })
        const { result } = setup({ nextStreamUrl: "gdrive://f/ep2.mkv" })
        act(() => result.current.processTimeUpdates(1390, 1400))
        expect(card.prefetch).toHaveBeenCalledOnce()
        expect(card.prefetch).toHaveBeenCalledWith("gdrive://f/ep2.mkv")
        act(() => result.current.processTimeUpdates(1392, 1400))
        expect(card.prefetch).toHaveBeenCalledOnce()
    })

    it("una película no precarga la placa", () => {
        vi.mocked(getAniSkipTimes).mockResolvedValue({ ...OP, hasSkipTimes: true })
        const { result } = setup({ nextStreamUrl: "gdrive://f/ep2.mkv", mediaFormat: "MOVIE" })
        act(() => result.current.processTimeUpdates(1390, 1400))
        expect(card.prefetch).not.toHaveBeenCalled()
    })

    it("antes del final no precarga la placa", () => {
        const { result } = setup({ nextStreamUrl: "gdrive://f/ep2.mkv" })
        act(() => result.current.processTimeUpdates(600, 1400))
        expect(card.prefetch).not.toHaveBeenCalled()
    })

    it("la acción del outro pasa una sola vez al siguiente episodio disponible", () => {
        const { result, video, onNextEpisode } = setup({}, { ed: { startTime: 1250, endTime: 1350 } })
        video.currentTime = 1270
        act(() => result.current.processTimeUpdates(1270, 1400))
        act(() => { result.current.handleSkipIntro(); result.current.handleSkipIntro() })
        expect(onNextEpisode).toHaveBeenCalledOnce()
        expect(video.currentTime).toBe(1270)
    })

    it.each([{ hasNextEpisode: false }, { onNextEpisode: undefined }, { mediaFormat: "MOVIE" }])("sin avance disponible solo salta los créditos: %j", (over) => {
        const { result, video, onNextEpisode } = setup(over, { ed: { startTime: 1250, endTime: 1350 } })
        video.currentTime = 1270
        act(() => result.current.processTimeUpdates(1270, 1400))
        act(() => result.current.handleSkipIntro())
        expect(onNextEpisode).not.toHaveBeenCalled()
        expect(video.currentTime).toBe(1350)
    })

    it.each(["chapters", "aniskip"])("en maratón salta el resumen de %s desde el segundo cero y permite deshacer", (source) => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video } = setup(
            { chapters: source === "chapters" ? [{ name: "Resumen", startTime: 0, endTime: 45 }] : [] },
            source === "aniskip" ? { recap: { startTime: 0, endTime: 45 } } : undefined,
        )
        act(() => result.current.processTimeUpdates(0, 1400))
        expect(video.currentTime).toBe(45)
        expect(result.current.showAutoSkipToast).toBe("recap")
        act(() => result.current.undoSkip())
        expect(video.currentTime).toBe(0)
        vi.setSystemTime(Date.now() + 2000)
        act(() => result.current.processTimeUpdates(1, 1400))
        expect(video.currentTime).toBe(0)
        expect(result.current.skipMode).toBe("recap")
    })

    it("oculta el botón al salir del resumen y no lo repite en otro episodio sin marcas", () => {
        const { result, rerender, props } = setup({}, { recap: { startTime: 0, endTime: 45 } })
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(result.current.skipMode).toBe("recap")
        act(() => result.current.processTimeUpdates(200, 1400))
        expect(result.current.skipMode).toBeNull()
        mocks.aniskip = undefined
        rerender({ ...props, episodeNumber: 2, playableUrl: "http://x/ep2.m3u8" })
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(result.current.skipMode).not.toBe("recap")
    })

    it("activar maratón durante un resumen lo salta aunque el auto-salto de intro esté apagado", () => {
        const { result, video } = setup({}, { recap: { startTime: 0, endTime: 45 } })
        video.currentTime = 10
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(result.current.skipMode).toBe("recap")
        act(() => result.current.handleSetMarathonMode(true))
        act(() => result.current.processTimeUpdates(10, 1400))
        expect(video.currentTime).toBe(45)
        expect(result.current.skipMode).toBeNull()
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

    it("al terminar el video avanza al siguiente a los 1 s", async () => {
        const a = setup()
        endVideo(a.video)
        await tick(999)
        expect(a.onNextEpisode).not.toHaveBeenCalled()
        await tick(1)
        expect(a.onNextEpisode).toHaveBeenCalledTimes(1)
        a.unmount()

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

    it("en maratón la intro se salta sola aunque el auto-salto esté apagado", () => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video } = setup({}, OP)
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(100)
        expect(result.current.showAutoSkipToast).toBe("intro")
        expect(result.current.skipMode).toBeNull()
    })

    it("en maratón una intro heurística no se salta sola: el botón queda visible", () => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video } = setup({}, { op: { startTime: 10, endTime: 100 }, opSource: "heuristic" })
        video.currentTime = 20
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(20)
        expect(result.current.skipMode).toBe("intro")
    })

    it("en maratón los créditos se saltan y avanzan al siguiente episodio", () => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video, onNextEpisode } = setup({}, { ed: { startTime: 1250, endTime: 1350 } })
        video.currentTime = 1270
        act(() => result.current.processTimeUpdates(1270, 1400))
        expect(onNextEpisode).toHaveBeenCalledOnce()
        expect(video.currentTime).toBe(1270)
    })

    it("en maratón sin siguiente episodio los créditos se saltan sin avanzar", () => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video, onNextEpisode } = setup({ hasNextEpisode: false }, { ed: { startTime: 1250, endTime: 1350 } })
        video.currentTime = 1270
        act(() => result.current.processTimeUpdates(1270, 1400))
        expect(onNextEpisode).not.toHaveBeenCalled()
        expect(video.currentTime).toBe(1350)
        expect(result.current.showAutoSkipToast).toBe("outro")
    })

    it("en maratón un capítulo de créditos avanza al siguiente episodio", () => {
        usePlayerStore.setState({ marathonMode: true })
        const { result, video, onNextEpisode } = setup({ chapters: [{ name: "Ending", startTime: 1300, endTime: 1390 }] })
        video.currentTime = 1310
        act(() => result.current.processTimeUpdates(1310, 1400))
        expect(onNextEpisode).toHaveBeenCalledOnce()
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

    it("tras el auto-salto por capítulo el botón de intro se apaga (misma ventana que el botón)", () => {
        const chapters: Chapter[] = [{ startTime: 0, endTime: 80, name: "OP" }]
        const { result, video } = setup(
            { autoSkipIntroPref: true, chapters },
            { op: { startTime: 0, endTime: 90 }, opSource: "heuristic" },
        )
        act(() => result.current.processTimeUpdates(20, 1400))
        expect(video.currentTime).toBe(80)
        expect(result.current.showAutoSkipToast).toBe("intro")

        vi.setSystemTime(Date.now() + 2000) // fuera del enfriamiento de seek
        act(() => result.current.processTimeUpdates(80.2, 1400))
        expect(result.current.skipMode).toBeNull()
    })
})
