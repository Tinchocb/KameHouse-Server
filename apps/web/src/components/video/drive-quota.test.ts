import { describe, expect, it, vi } from "vitest"
import { DRIVE_QUOTA_MSG, probeDriveQuotaError } from "./drive-quota"

const DRIVE_URL = "http://127.0.0.1:43212/api/v1/drive/play?fileId=abc"

describe("probeDriveQuotaError", () => {
    it("no consulta si la URL no es de Drive", async () => {
        const fetchImpl = vi.fn()
        expect(await probeDriveQuotaError("http://x/api/v1/mediastream/direct/play", fetchImpl)).toBeNull()
        expect(fetchImpl).not.toHaveBeenCalled()
    })

    it("devuelve el mensaje de cuota ante un 503", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }))
        expect(await probeDriveQuotaError(DRIVE_URL, fetchImpl)).toBe(DRIVE_QUOTA_MSG)
        expect(fetchImpl).toHaveBeenCalledWith(DRIVE_URL, expect.objectContaining({ headers: { Range: "bytes=0-0" } }))
    })

    it("ignora otros estados y errores de red", async () => {
        expect(await probeDriveQuotaError(DRIVE_URL, vi.fn().mockResolvedValue(new Response("x", { status: 206 })))).toBeNull()
        expect(await probeDriveQuotaError(DRIVE_URL, vi.fn().mockRejectedValue(new Error("offline")))).toBeNull()
    })
})
