import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    buildApiQuery: vi.fn(),
    toastError: vi.fn(),
    invalidate: vi.fn(),
}))

vi.mock("@/api/client/requests", () => ({ buildApiQuery: mocks.buildApiQuery }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))
vi.mock("@/app/client-providers", () => ({
    queryClient: { setQueryData: vi.fn(), invalidateQueries: mocks.invalidate },
}))

import { persistThemePatch } from "./persist-settings"

describe("guardado de ajustes sin errores silenciosos (QA-02)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("si el servidor rechaza el cambio, avisa y vuelve a pedir los ajustes", async () => {
        mocks.buildApiQuery.mockRejectedValueOnce(new Error("500"))
        persistThemePatch({ uiSoundsEnabled: false })
        await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1))
    })

    it("un cambio aceptado no avisa ni recarga nada", async () => {
        mocks.buildApiQuery.mockResolvedValueOnce(undefined)
        persistThemePatch({ uiSoundsEnabled: true })
        await vi.waitFor(() => expect(mocks.buildApiQuery).toHaveBeenCalledTimes(1))
        expect(mocks.toastError).not.toHaveBeenCalled()
        expect(mocks.invalidate).not.toHaveBeenCalled()
    })
})
