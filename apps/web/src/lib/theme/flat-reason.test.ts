import { describe, expect, it } from "vitest"
import { resolveFlatReason } from "./apply-custom-theme"

const base = { blurDisabled: false, themeMode: "classic", contrastMore: false, autoThrottleActive: false, lowPower: false }

describe("resolveFlatReason", () => {
    it("deja el vidrio cuando nada pide el plano", () => {
        expect(resolveFlatReason(base)).toBeNull()
        expect(resolveFlatReason({ ...base, themeMode: "era" })).toBeNull()
    })

    it("Minimalista siempre es plano", () => {
        expect(resolveFlatReason({ ...base, themeMode: "classic-minimalist" })).toBe("theme")
    })

    it("el interruptor del usuario manda sobre el tema, y el tema sobre los motivos del sistema", () => {
        expect(resolveFlatReason({ ...base, themeMode: "classic-minimalist", blurDisabled: true })).toBe("manual")
        expect(resolveFlatReason({ ...base, themeMode: "classic-minimalist", contrastMore: true, lowPower: true })).toBe("theme")
        expect(resolveFlatReason({ ...base, contrastMore: true, autoThrottleActive: true })).toBe("contrast")
        expect(resolveFlatReason({ ...base, autoThrottleActive: true, lowPower: true })).toBe("auto")
        expect(resolveFlatReason({ ...base, lowPower: true })).toBe("eco")
    })
})
