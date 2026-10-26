import { describe, expect, it } from "vitest"
import { withClientId } from "./stream-client-id"

describe("withClientId", () => {
    it("agrega clientId a una URL sin query", () => {
        expect(withClientId("/api/v1/mediastream/transcode/master.m3u8", "abc")).toBe(
            "/api/v1/mediastream/transcode/master.m3u8?clientId=abc"
        )
    })

    it("usa & cuando la URL ya tiene query", () => {
        expect(withClientId("/api/v1/mediastream/direct?x=1", "abc")).toBe("/api/v1/mediastream/direct?x=1&clientId=abc")
    })

    it("escapa el id y no toca una URL vacía ni sin id", () => {
        expect(withClientId("/m.m3u8", "a b")).toBe("/m.m3u8?clientId=a%20b")
        expect(withClientId("", "abc")).toBe("")
        expect(withClientId("/m.m3u8", "")).toBe("/m.m3u8")
    })
})
