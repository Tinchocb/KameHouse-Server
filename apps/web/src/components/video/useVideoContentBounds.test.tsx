import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useVideoContentBounds } from "./useVideoContentBounds"
import { FULL_FRAME_BOUNDS } from "./video-aspect"

function makeVideoElement() {
    const video = document.createElement("video")
    Object.defineProperty(video, "readyState", { value: 4, configurable: true })
    Object.defineProperty(video, "videoWidth", { value: 1920, configurable: true })
    Object.defineProperty(video, "videoHeight", { value: 1080, configurable: true })
    return video
}

describe("useVideoContentBounds", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("detects baked 4:3 pillarboxes on a bright frame and resets on CORS SecurityError", () => {
        const W = 192
        const H = 108
        const pixels = new Uint8ClampedArray(W * H * 4)
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4
                const isBar = x < 24 || x >= W - 24
                pixels[i] = isBar ? 16 : 200
                pixels[i + 1] = isBar ? 16 : 140
                pixels[i + 2] = isBar ? 16 : 60
                pixels[i + 3] = 255
            }
        }

        const getImageData = vi.fn().mockReturnValue({ data: pixels, width: W, height: H })
        const drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            drawImage,
            getImageData,
        } as unknown as CanvasRenderingContext2D)

        const video = makeVideoElement()
        const videoRef = { current: video }

        const { result, rerender } = renderHook(
            ({ playableUrl, aspectRatio }) => useVideoContentBounds({ videoRef, playableUrl, aspectRatio }),
            { initialProps: { playableUrl: "/api/v1/stream/ep1.mp4", aspectRatio: "fill" as const } },
        )

        act(() => {
            video.dispatchEvent(new Event("loadeddata"))
        })

        expect(result.current.left).toBeCloseTo(0.129, 2)
        expect(result.current.right).toBeCloseTo(0.871, 2)
        expect(result.current.top).toBe(0)
        expect(result.current.bottom).toBe(1)

        // Switching to a cross-origin tainted URL resets safely to FULL_FRAME_BOUNDS
        getImageData.mockImplementation(() => {
            throw new DOMException("Tainted canvas", "SecurityError")
        })
        rerender({ playableUrl: "https://external.example/ep2.mp4", aspectRatio: "fill" })

        act(() => {
            video.dispatchEvent(new Event("loadeddata"))
        })

        expect(result.current).toEqual(FULL_FRAME_BOUNDS)
    })
})
