import { describe, expect, it } from "vitest"
import { resolveLanUrl } from "./lan-url"

describe("resolveLanUrl", () => {
    it("devuelve vacío si no hay URL", () => {
        expect(resolveLanUrl("")).toBe("")
    })

    it("deja intactas URLs remotas", () => {
        expect(resolveLanUrl("https://example.com/v/ep1.mp4")).toBe("https://example.com/v/ep1.mp4")
    })

    it("reescribe localhost a la IP LAN preferida", () => {
        const out = resolveLanUrl("http://localhost:9999/v/ep1.mp4", ["192.168.1.10"], 43212)
        expect(out).toBe("http://192.168.1.10:43212/v/ep1.mp4")
    })

    it("prefiere IPs privadas sobre públicas", () => {
        const out = resolveLanUrl("http://127.0.0.1:9999/v/ep1.mp4", ["8.8.8.8", "10.0.0.5"], 43212)
        expect(out).toContain("10.0.0.5")
    })

    it("resuelve rutas relativas contra la IP y puerto dados", () => {
        const out = resolveLanUrl("/v/ep1.mp4", ["192.168.1.10"], 43212)
        expect(out).toBe("http://192.168.1.10:43212/v/ep1.mp4")
    })
})
