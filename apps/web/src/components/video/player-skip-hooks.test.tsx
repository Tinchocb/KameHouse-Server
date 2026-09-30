import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import { useMirroredState } from "./use-mirrored-state"
import { usePlayerVideoEnded } from "./usePlayerVideoEnded"
import { usePlayerSkipWindows } from "./usePlayerSkipWindows"
import { useSkipTimesStore } from "@/lib/store"
import type { AniSkipWindows } from "./skip-windows"

const aniskip = vi.hoisted(() => ({ data: undefined as AniSkipWindows | undefined }))
vi.mock("@/api/hooks/aniskip.hooks", () => ({
    useAniSkipTimes: () => ({ data: aniskip.data }),
}))

describe("useMirroredState", () => {
    it("el ref y el estado cambian en el mismo paso", () => {
        const { result } = renderHook(() => useMirroredState<number>(1))
        expect(result.current[0]).toBe(1)
        expect(result.current[2].current).toBe(1)

        act(() => result.current[1](7))
        expect(result.current[0]).toBe(7)
        expect(result.current[2].current).toBe(7)
    })

    it("el ref ya tiene el valor nuevo antes del siguiente render", () => {
        const { result } = renderHook(() => useMirroredState<string | null>(null))
        let seenInsideSetter: string | null | undefined
        act(() => {
            result.current[1]("a")
            seenInsideSetter = result.current[2].current
        })
        expect(seenInsideSetter).toBe("a")
    })

    it("el setter y el ref son estables entre renders", () => {
        const { result, rerender } = renderHook(() => useMirroredState<number>(0))
        const [, setter, ref] = result.current
        act(() => setter(1))
        rerender()
        expect(result.current[1]).toBe(setter)
        expect(result.current[2]).toBe(ref)
    })
})

describe("usePlayerVideoEnded", () => {
    function fakeVideo(ended = false) {
        const video = new EventTarget() as EventTarget & { ended: boolean }
        video.ended = ended
        return video
    }
    const refOf = (v: unknown) => ({ current: v } as React.RefObject<HTMLVideoElement | null>)

    it("arranca con el estado real del video", () => {
        const { result } = renderHook(() => usePlayerVideoEnded(refOf(fakeVideo(true))))
        expect(result.current[0]).toBe(true)
    })

    it("sigue ended, play y seeked", () => {
        const video = fakeVideo(false)
        const ref = refOf(video)
        const { result } = renderHook(() => usePlayerVideoEnded(ref))
        expect(result.current[0]).toBe(false)

        act(() => { video.dispatchEvent(new Event("ended")) })
        expect(result.current[0]).toBe(true)

        act(() => { video.dispatchEvent(new Event("play")) })
        expect(result.current[0]).toBe(false)

        act(() => { video.dispatchEvent(new Event("ended")) })
        video.ended = true
        act(() => { video.dispatchEvent(new Event("seeked")) })
        expect(result.current[0]).toBe(true)

        video.ended = false
        act(() => { video.dispatchEvent(new Event("seeked")) })
        expect(result.current[0]).toBe(false)
    })

    it("expone el setter para el reinicio por cambio de episodio", () => {
        const ref = refOf(fakeVideo(true))
        const { result } = renderHook(() => usePlayerVideoEnded(ref))
        expect(result.current[0]).toBe(true)
        act(() => result.current[1](false))
        expect(result.current[0]).toBe(false)
    })

    it("deja de escuchar al desmontar", () => {
        const video = fakeVideo(false)
        const spy = vi.spyOn(video, "removeEventListener")
        const { unmount } = renderHook(() => usePlayerVideoEnded(refOf(video)))
        unmount()
        expect(spy.mock.calls.map(c => c[0]).sort()).toEqual(["ended", "play", "seeked"])
    })

    it("sin video no hace nada", () => {
        const { result } = renderHook(() => usePlayerVideoEnded(refOf(null)))
        expect(result.current[0]).toBe(false)
    })
})

describe("usePlayerSkipWindows", () => {
    beforeEach(() => {
        aniskip.data = undefined
        useSkipTimesStore.setState({ seriesSkipTimes: {} })
    })

    it("resuelve intro y outro desde AniSkip", () => {
        aniskip.data = { op: { startTime: 10, endTime: 100 }, ed: { startTime: 1300, endTime: 1390 } }
        const { result } = renderHook(() => usePlayerSkipWindows({ malId: 5, episodeNumber: 3, duration: 1400, chapters: [] }))
        expect(result.current.skipTimesOp).toEqual({ startTime: 10, endTime: 100, source: "aniskip" })
        expect(result.current.skipTimesEd).toEqual({ startTime: 1300, endTime: 1390, source: "aniskip" })
    })

    it("aprende lo resuelto y lo guarda para la serie", () => {
        aniskip.data = { op: { startTime: 10, endTime: 100 }, ed: { startTime: 1300, endTime: 1390 } }
        renderHook(() => usePlayerSkipWindows({ malId: 5, episodeNumber: 3, duration: 1400, chapters: [] }))
        expect(useSkipTimesStore.getState().seriesSkipTimes["5"]).toEqual({ opStart: 10, opEnd: 100, edOffset: 1300, edEnd: 1390 })
    })

    it("un episodio sin datos usa lo aprendido de la serie", () => {
        useSkipTimesStore.setState({ seriesSkipTimes: { "5": { opStart: 12, opEnd: 98, edOffset: 1310, edEnd: 1395 } } })
        const { result } = renderHook(() => usePlayerSkipWindows({ malId: 5, episodeNumber: 4, duration: 1400, chapters: [] }))
        expect(result.current.skipTimesOp).toEqual({ startTime: 12, endTime: 98, source: "propagated" })
        expect(result.current.skipTimesEd).toEqual({ startTime: 1310, endTime: 1395, source: "propagated" })
    })

    it("no guarda nada sin duración ni sin identificador de serie", () => {
        aniskip.data = { op: { startTime: 10, endTime: 100 }, ed: { startTime: 1300, endTime: 1390 } }
        renderHook(() => usePlayerSkipWindows({ malId: 5, episodeNumber: 3, duration: 0, chapters: [] }))
        renderHook(() => usePlayerSkipWindows({ episodeNumber: 3, duration: 1400, chapters: [] }))
        expect(useSkipTimesStore.getState().seriesSkipTimes).toEqual({})
    })

    it("usa mediaId como clave cuando no hay malId", () => {
        aniskip.data = { op: { startTime: 10, endTime: 100 }, ed: { startTime: 1300, endTime: 1390 } }
        renderHook(() => usePlayerSkipWindows({ mediaId: 77, episodeNumber: 1, duration: 1400, chapters: [] }))
        expect(useSkipTimesStore.getState().seriesSkipTimes["77"]).toBeDefined()
    })

    it("no reescribe la caché si no cambió nada", () => {
        aniskip.data = { op: { startTime: 10, endTime: 100 }, ed: { startTime: 1300, endTime: 1390 } }
        let writes = 0
        const unsubscribe = useSkipTimesStore.subscribe(state => state.seriesSkipTimes, () => { writes++ })
        const { rerender } = renderHook(() => usePlayerSkipWindows({ malId: 5, episodeNumber: 3, duration: 1400, chapters: [] }))
        rerender()
        rerender()
        unsubscribe()
        expect(writes).toBe(1)
        expect(useSkipTimesStore.getState().seriesSkipTimes["5"]).toEqual({ opStart: 10, opEnd: 100, edOffset: 1300, edEnd: 1390 })
    })
})
