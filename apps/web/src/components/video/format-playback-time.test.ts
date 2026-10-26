import { describe, expect, it } from "vitest"
import { formatPlaybackTime } from "./format-playback-time"

describe("formatPlaybackTime", () => {
    it("0 y NaN se muestran como 00:00", () => {
        expect(formatPlaybackTime(0)).toBe("00:00")
        expect(formatPlaybackTime(Number.NaN)).toBe("00:00")
    })

    it("infinito y negativos no son un tiempo válido: se muestran como 00:00", () => {
        expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe("00:00")
        expect(formatPlaybackTime(Number.NEGATIVE_INFINITY)).toBe("00:00")
        expect(formatPlaybackTime(-5)).toBe("00:00")
    })

    it("menos de una hora: mm:ss con cero a la izquierda y sin redondear hacia arriba", () => {
        expect(formatPlaybackTime(5)).toBe("00:05")
        expect(formatPlaybackTime(59.9)).toBe("00:59")
        expect(formatPlaybackTime(60)).toBe("01:00")
        expect(formatPlaybackTime(3599)).toBe("59:59")
    })

    it("una hora o más: h:mm:ss sin cero a la izquierda en las horas", () => {
        expect(formatPlaybackTime(3600)).toBe("1:00:00")
        expect(formatPlaybackTime(3661.7)).toBe("1:01:01")
        expect(formatPlaybackTime(36000)).toBe("10:00:00")
    })
})
