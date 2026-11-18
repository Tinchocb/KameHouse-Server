import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

const buildApiQuery = vi.fn()
vi.mock("@/api/client/requests", async () => {
    const actual = await vi.importActual<typeof import("@/api/client/requests")>("@/api/client/requests")
    return { ...actual, buildApiQuery: (...args: unknown[]) => buildApiQuery(...args) }
})

import { ApiError } from "@/api/client/requests"
import { prefetchDriveTitleCard, useDriveTitleCard } from "./useDriveTitleCard"

const PATH = "gdrive://abc123/Serie/ep01.mkv"
const CARD = { titleStart: 171.46, songEnd: 98.81 }

async function flush() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe("useDriveTitleCard", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        buildApiQuery.mockReset()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("con una ruta que no es de Drive no consulta al servidor y devuelve undefined", async () => {
        const a = renderHook(() => useDriveTitleCard({ path: "D:\\Anime\\ep.mkv", from: 0, enabled: true }))
        const b = renderHook(() => useDriveTitleCard({ path: undefined, from: 0, enabled: true }))
        await flush()
        expect(buildApiQuery).not.toHaveBeenCalled()
        expect(a.result.current).toBeUndefined()
        expect(b.result.current).toBeUndefined()
    })

    it("con enabled=false no consulta", async () => {
        const { result } = renderHook(() => useDriveTitleCard({ path: PATH, from: 0, enabled: false }))
        await flush()
        expect(buildApiQuery).not.toHaveBeenCalled()
        expect(result.current).toBeUndefined()
    })

    it("pide la placa con el segundo redondeado hacia abajo y la devuelve al resolver", async () => {
        buildApiQuery.mockResolvedValue(CARD)
        const { result } = renderHook(() => useDriveTitleCard({ path: PATH, from: 110.7, enabled: true }))
        expect(result.current).toBeUndefined()
        await flush()
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        const arg = buildApiQuery.mock.calls[0][0]
        expect(arg.endpoint).toBe("/api/v1/drive/subtitles/title-card")
        expect(arg.method).toBe("POST")
        expect(arg.data).toEqual({ path: PATH, from: 110 })
        expect(result.current).toEqual(CARD)
    })

    it("una falla pasajera se reintenta a los 4 s y entrega el resultado del segundo intento", async () => {
        buildApiQuery.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(CARD)
        const { result } = renderHook(() => useDriveTitleCard({ path: PATH, from: 0, enabled: true }))
        await flush()
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        expect(result.current).toBeUndefined()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3999)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(2)
        expect(result.current).toEqual(CARD)
    })

    it("un 501 (archivo que no sirve) no se reintenta", async () => {
        buildApiQuery.mockRejectedValue(new ApiError("title card not available for this file", 501))
        const { result } = renderHook(() => useDriveTitleCard({ path: PATH, from: 0, enabled: true }))
        await flush()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20000)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        expect(result.current).toBeUndefined()
    })

    it("al cambiar de episodio deja de devolver la placa anterior de inmediato", async () => {
        buildApiQuery.mockResolvedValueOnce(CARD)
        const { result, rerender } = renderHook(
            ({ path }: { path: string }) => useDriveTitleCard({ path, from: 0, enabled: true }),
            { initialProps: { path: PATH } },
        )
        await flush()
        expect(result.current).toEqual(CARD)

        const next = { titleStart: 140, songEnd: 90 }
        buildApiQuery.mockResolvedValueOnce(next)
        rerender({ path: "gdrive://abc123/Serie/ep02.mkv" })
        expect(result.current).toBeUndefined()
        await flush()
        expect(result.current).toEqual(next)
    })

    it("al desmontar aborta la petición en curso", async () => {
        buildApiQuery.mockReturnValue(new Promise(() => {}))
        const { unmount } = renderHook(() => useDriveTitleCard({ path: PATH, from: 0, enabled: true }))
        await flush()
        const signal = buildApiQuery.mock.calls[0][0].signal as AbortSignal
        expect(signal.aborted).toBe(false)
        unmount()
        expect(signal.aborted).toBe(true)
    })

    describe("prefetchDriveTitleCard", () => {
        it("con ruta de Drive pide la placa desde el segundo 0 una sola vez", () => {
            buildApiQuery.mockResolvedValue(CARD)
            prefetchDriveTitleCard(PATH)
            expect(buildApiQuery).toHaveBeenCalledTimes(1)
            const arg = buildApiQuery.mock.calls[0][0]
            expect(arg.endpoint).toBe("/api/v1/drive/subtitles/title-card")
            expect(arg.method).toBe("POST")
            expect(arg.data).toEqual({ path: PATH, from: 0 })
        })

        it("con una ruta que no es de Drive o sin ruta no pide nada", () => {
            prefetchDriveTitleCard("D:\\Anime\\ep.mkv")
            prefetchDriveTitleCard(undefined)
            expect(buildApiQuery).not.toHaveBeenCalled()
        })

        it("si la petición rechaza no lanza ni deja un rechazo sin manejar", async () => {
            buildApiQuery.mockRejectedValue(new Error("offline"))
            expect(() => prefetchDriveTitleCard(PATH)).not.toThrow()
            expect(buildApiQuery).toHaveBeenCalledTimes(1)
            await Promise.resolve()
            await Promise.resolve()
            expect(buildApiQuery).toHaveBeenCalledTimes(1)
        })
    })
})
