import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getAniSkipTimes } from "./aniskip.hooks"

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/api/client/requests", () => ({ buildApiQuery: mocks.query }))

describe("AniSkip recap", () => {
    beforeEach(() => mocks.query.mockReset().mockResolvedValue(null))
    afterEach(() => vi.unstubAllGlobals())

    function respond(results: unknown[]) {
        const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ found: true, statusCode: 200, results }) })
        vi.stubGlobal("fetch", fetch)
        return fetch
    }

    const recap = { skipType: "recap", interval: { startTime: 0, endTime: 45 }, episodeLength: 1400 }
    const params = { malId: 5, episodeNumber: 1, episodeDuration: 1400 }

    it("solicita el recap y admite episodios que solo tienen resumen", async () => {
        const fetch = respond([recap])
        const times = await getAniSkipTimes(params)
        expect(fetch.mock.calls[0][0]).toContain("types[]=recap")
        expect(times.recap).toEqual(recap.interval)
        expect(times.hasSkipTimes).toBe(true)
    })

    it("consulta el resumen aunque haya OP local fiable y conserva ese OP", async () => {
        mocks.query.mockResolvedValue({ opStart: 45, opEnd: 135, edOffset: 0, source: "manual", confidence: 1 })
        respond([recap, { skipType: "op", interval: { startTime: 0, endTime: 85 }, episodeLength: 1400 }])
        const times = await getAniSkipTimes(params)
        expect(times.recap).toEqual(recap.interval)
        expect(times.op).toEqual({ startTime: 45, endTime: 135 })
        expect(times.opSource).toBe("manual")
    })

    it("conserva los tiempos locales si AniSkip falla", async () => {
        mocks.query.mockResolvedValue({ opStart: 45, opEnd: 135, edOffset: 0, source: "manual", confidence: 1 })
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
        const times = await getAniSkipTimes(params)
        expect(times.op).toEqual({ startTime: 45, endTime: 135 })
        expect(times.recap).toBeUndefined()
    })

    it("descarta resúmenes invertidos, negativos o fuera del archivo", async () => {
        respond([
            { ...recap, interval: { startTime: 45, endTime: 0 } },
            { ...recap, interval: { startTime: -1, endTime: 45 } },
            { ...recap, interval: { startTime: 0, endTime: 1500 } },
        ])
        expect((await getAniSkipTimes(params)).recap).toBeUndefined()
    })
})
