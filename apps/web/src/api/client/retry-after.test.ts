import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, buildApiQuery, parseRetryAfterMs } from "./requests"

vi.mock("./server-url", () => ({ getServerBaseUrl: () => "http://localhost:43211" }))

const errorResponse = (status: number, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ error: "fallo" }), { status, headers: { "content-type": "application/json", ...headers } })

describe("reintentos de transporte solo con Retry-After (T3.2)", () => {
    afterEach(() => { vi.unstubAllGlobals() })

    it("un 503 sin Retry-After no se reintenta y llega como error permanente", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => errorResponse(503))
        vi.stubGlobal("fetch", fetchMock)
        const err = await buildApiQuery({ endpoint: "/api/v1/tmdb/episode/1/1", method: "GET" }).catch((e: unknown) => e)
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(503)
        expect((err as ApiError).retryAfterMs).toBeUndefined()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("un 503 con Retry-After se reintenta y entrega el valor a la capa de consulta", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => errorResponse(503, { "Retry-After": "0" }))
        vi.stubGlobal("fetch", fetchMock)
        const err = await buildApiQuery({ endpoint: "/api/v1/library/anime-entry/1/sagas", method: "GET" }).catch((e: unknown) => e)
        expect((err as ApiError).retryAfterMs).toBe(0)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("un POST no se reintenta aunque traiga Retry-After", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => errorResponse(503, { "Retry-After": "0" }))
        vi.stubGlobal("fetch", fetchMock)
        await buildApiQuery({ endpoint: "/api/v1/settings", method: "PATCH", data: {} }).catch(() => undefined)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

describe("parseRetryAfterMs", () => {
    it("lee segundos y fechas HTTP, y descarta lo que no entiende", () => {
        expect(parseRetryAfterMs(null)).toBeUndefined()
        expect(parseRetryAfterMs("2")).toBe(2000)
        expect(parseRetryAfterMs("999")).toBe(10000)
        expect(parseRetryAfterMs("no es una fecha")).toBeUndefined()
        const ms = parseRetryAfterMs(new Date(Date.now() + 3000).toUTCString())
        expect(ms).toBeGreaterThan(0)
        expect(ms).toBeLessThanOrEqual(3000)
    })
})
