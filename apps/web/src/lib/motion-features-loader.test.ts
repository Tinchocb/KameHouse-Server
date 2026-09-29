import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FeatureBundle } from "framer-motion"
import {
    __resetMotionFeaturesForTests,
    isMotionFeaturesReady,
    loadMotionFeatures,
    useMotionFeaturesReady,
} from "./motion-features-loader"

const bundle = { renderer: () => null } as unknown as FeatureBundle

describe("motion-features-loader", () => {
    afterEach(() => __resetMotionFeaturesForTests())

    it("pide el chunk una sola vez y avisa cuando está listo", async () => {
        const importer = vi.fn(async () => ({ default: bundle }))
        __resetMotionFeaturesForTests(importer)
        const { result } = renderHook(() => useMotionFeaturesReady())
        expect(result.current).toBe(false)

        await act(async () => {
            await Promise.all([loadMotionFeatures(), loadMotionFeatures()])
        })
        expect(importer).toHaveBeenCalledTimes(1)
        expect(isMotionFeaturesReady()).toBe(true)
        expect(result.current).toBe(true)
    })

    it("reintenta una vez si la descarga falla", async () => {
        const importer = vi.fn()
            .mockRejectedValueOnce(new Error("red"))
            .mockResolvedValueOnce({ default: bundle })
        __resetMotionFeaturesForTests(importer)
        await expect(loadMotionFeatures()).resolves.toBe(bundle)
        expect(importer).toHaveBeenCalledTimes(2)
    })

    it("si falla dos veces no marca listo (el splash usa su tope de seguridad)", async () => {
        __resetMotionFeaturesForTests(vi.fn().mockRejectedValue(new Error("red")))
        await expect(loadMotionFeatures()).rejects.toThrow("red")
        expect(isMotionFeaturesReady()).toBe(false)
    })
})
