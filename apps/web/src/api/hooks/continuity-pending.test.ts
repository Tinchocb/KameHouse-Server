import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/api/client/requests"
import {
    clearPendingContinuity,
    flushPendingContinuity,
    getPendingContinuity,
    isRecoverableSaveError,
    queuePendingContinuity,
} from "./continuity-pending"

const vars = (mediaId: number, currentTime: number) => ({
    options: { mediaId, episodeNumber: 1, currentTime, duration: 1400, kind: "mediastream" as const, predictive: false },
})

describe("continuity-pending", () => {
    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it("guarda solo el último progreso por mediaId", () => {
        queuePendingContinuity(vars(7, 100))
        queuePendingContinuity(vars(7, 200))
        queuePendingContinuity(vars(8, 50))
        const pending = getPendingContinuity()
        expect(pending).toHaveLength(2)
        expect(pending.find(v => v.options.mediaId === 7)?.options.currentTime).toBe(200)

        clearPendingContinuity(7)
        expect(getPendingContinuity()).toHaveLength(1)
    })

    it("descarta entradas de más de una semana", () => {
        queuePendingContinuity(vars(7, 100), Date.now() - 8 * 24 * 60 * 60 * 1000)
        expect(getPendingContinuity()).toEqual([])
    })

    it("clasifica errores recuperables", () => {
        expect(isRecoverableSaveError(new TypeError("Failed to fetch"))).toBe(true)
        expect(isRecoverableSaveError(new ApiError("down", 503))).toBe(true)
        expect(isRecoverableSaveError(new ApiError("bad", 400))).toBe(false)
    })

    it("flush reenvía la cola y se detiene al primer fallo", async () => {
        queuePendingContinuity(vars(7, 100))
        queuePendingContinuity(vars(8, 50))
        const send = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
        await flushPendingContinuity(send)
        expect(send).toHaveBeenCalledTimes(1)
        // El que falló lo re-encola el onError de la mutación; el otro sigue pendiente.
        expect(getPendingContinuity()).toHaveLength(1)

        send.mockResolvedValue(true)
        await flushPendingContinuity(send)
        expect(getPendingContinuity()).toEqual([])
    })

    it("no hace nada sin red", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
        queuePendingContinuity(vars(7, 100))
        const send = vi.fn()
        await flushPendingContinuity(send)
        expect(send).not.toHaveBeenCalled()
    })
})
