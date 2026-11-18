import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authorizeResourceUrl, getAuthorizationHeaders, getServerSession, getWebSocketProtocols, requestServerSession, setServerSession } from "./auth"
import { buildApiQuery } from "./requests"

vi.mock("./server-url", () => ({ getServerBaseUrl: () => "http://localhost:43211" }))

const session = () => ({ required: true, sessionToken: "api-session-secret", streamToken: "read-only-secret", expiresAt: Math.floor(Date.now() / 1000) + 300 })

describe("server authentication transport", () => {
    beforeEach(() => { sessionStorage.clear(); setServerSession(null) })
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); setServerSession(null) })

    it("uses the API credential in headers and WS protocol, and only the read token in resource URLs", async () => {
        setServerSession(session())
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } })))
        vi.stubGlobal("fetch", fetchMock)
        expect(await buildApiQuery({ endpoint: "/api/v1/library/collection", method: "GET" })).toEqual({ ok: true })
        expect(fetchMock.mock.calls[0][0]).not.toContain("secret")
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer api-session-secret")
        expect(getWebSocketProtocols()).toEqual(["kamehouse.token.api-session-secret"])
        for (const path of ["video-storyboard", "video-thumbnail", "image-proxy", "music/stream", "mediastream/subtitles", "mediastream/att/font.ttf"]) {
            const url = new URL(authorizeResourceUrl(`/api/v1/${path}?x=1`))
            expect(url.searchParams.get("token")).toBe("read-only-secret")
            expect(url.toString()).not.toContain("api-session-secret")
        }
        expect(authorizeResourceUrl("https://cdn.example/api/v1/image-proxy")).toBe("https://cdn.example/api/v1/image-proxy")
        expect(authorizeResourceUrl("//cdn.example/api/v1/video-thumbnail")).toBe("//cdn.example/api/v1/video-thumbnail")
        expect(authorizeResourceUrl("/api/v1/settings")).toBe("/api/v1/settings")
        setServerSession(null)
        expect(getAuthorizationHeaders()).toEqual({})
        expect(getWebSocketProtocols()).toEqual([])
        expect(sessionStorage.length).toBe(0)
    })

    it("exchanges a password without persisting it and exposes rate-limit retry delay", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: session() })))
            .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "9" } }))
        vi.stubGlobal("fetch", fetchMock)
        const result = await requestServerSession("typed-password")
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer typed-password")
        setServerSession(result)
        expect(JSON.stringify(sessionStorage)).not.toContain("typed-password")
        await expect(requestServerSession("incorrect")).rejects.toMatchObject({ status: 429, retryAfter: 9 })
    })

    it("drops expired credentials and clears a rejected session", async () => {
        vi.useFakeTimers()
        setServerSession(session())
        vi.advanceTimersByTime(301_000)
        expect(getServerSession()).toBeNull()
        expect(authorizeResourceUrl("/api/v1/music/stream")).toBe("/api/v1/music/stream")
        expect(getAuthorizationHeaders()).toEqual({})
        vi.useRealTimers()
        setServerSession(session())
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })))
        await expect(buildApiQuery({ endpoint: "/api/v1/settings", method: "GET" })).rejects.toMatchObject({ status: 401 })
        expect(getServerSession()).toBeNull()
    })
})
