import { describe, it, expect } from "vitest"
import {
    BlackBarConsensusTracker,
    FULL_FRAME_BOUNDS,
    computeVideoAspectLayout,
    detectBlackBarsFromPixels,
} from "./video-aspect"

function makeFrame(
    width: number,
    height: number,
    pixelFn: (x: number, y: number) => [number, number, number],
): Uint8ClampedArray {
    const buf = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = pixelFn(x, y)
            const idx = (y * width + x) * 4
            buf[idx] = r
            buf[idx + 1] = g
            buf[idx + 2] = b
            buf[idx + 3] = 255
        }
    }
    return buf
}

describe("computeVideoAspectLayout", () => {
    it("contain preserves original full container with object-fit contain even if contentBounds are narrower", () => {
        const layout = computeVideoAspectLayout({
            containerWidth: 1920,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "contain",
            contentBounds: { left: 0.125, top: 0, right: 0.875, bottom: 1 },
        })
        expect(layout).toEqual({
            stageWidth: 1920,
            stageHeight: 1080,
            videoWidth: 1920,
            videoHeight: 1080,
            videoLeft: 0,
            videoTop: 0,
            objectFit: "contain",
        })
    })

    it("fill stretches baked 4:3-in-16:9 DBZ content past the stage so black bars are clipped off", () => {
        const layout = computeVideoAspectLayout({
            containerWidth: 1920,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "fill",
            contentBounds: { left: 0.125, top: 0, right: 0.875, bottom: 1 },
        })
        expect(layout.stageWidth).toBe(1920)
        expect(layout.stageHeight).toBe(1080)
        expect(layout.videoWidth).toBeCloseTo(2560, 2)
        expect(layout.videoHeight).toBeCloseTo(1080, 2)
        expect(layout.videoLeft).toBeCloseTo(-320, 2)
        expect(layout.videoTop).toBeCloseTo(0, 2)
        expect(layout.objectFit).toBe("fill")
    })

    it("cover scales baked 4:3-in-16:9 content uniformly without distortion and clips pillarboxes", () => {
        const layout = computeVideoAspectLayout({
            containerWidth: 1920,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "cover",
            contentBounds: { left: 0.125, top: 0, right: 0.875, bottom: 1 },
        })
        expect(layout.stageWidth).toBe(1920)
        expect(layout.stageHeight).toBe(1080)
        expect(layout.videoWidth).toBeCloseTo(2560, 2)
        expect(layout.videoHeight).toBeCloseTo(1440, 2)
        expect(layout.videoLeft).toBeCloseTo(-320, 2)
        expect(layout.videoTop).toBeCloseTo(-180, 2)
        expect(layout.objectFit).toBe("fill")
    })

    it("16/9 enforces an exact 16:9 stage on wider viewports and stretches 4:3 content without cropping", () => {
        // Maximized desktop browser window (1904x985) and ultrawide monitor (2560x1080)
        const desktopWindow = computeVideoAspectLayout({
            containerWidth: 1904,
            containerHeight: 985,
            intrinsicWidth: 1440,
            intrinsicHeight: 1080,
            aspectRatio: "16/9",
        })
        expect(desktopWindow.stageWidth / desktopWindow.stageHeight).toBeCloseTo(16 / 9, 4)
        expect(desktopWindow.stageHeight).toBe(985)
        expect(desktopWindow.videoWidth).toBeCloseTo(desktopWindow.stageWidth, 2)
        expect(desktopWindow.videoHeight).toBeCloseTo(985, 2)
        expect(desktopWindow.objectFit).toBe("fill")

        const ultrawideBaked = computeVideoAspectLayout({
            containerWidth: 2560,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "16/9",
            contentBounds: { left: 0.125, top: 0, right: 0.875, bottom: 1 },
        })
        expect(ultrawideBaked.stageWidth).toBeCloseTo(1920, 2)
        expect(ultrawideBaked.stageHeight).toBe(1080)
        expect(ultrawideBaked.videoWidth).toBeCloseTo(2560, 2)
        expect(ultrawideBaked.videoLeft).toBeCloseTo(-320, 2)
        expect(ultrawideBaked.objectFit).toBe("fill")
    })

    it("21/9 enforces an exact 21:9 stage on both 16:9 and 3440x1440 monitors without cropping", () => {
        const on16x9 = computeVideoAspectLayout({
            containerWidth: 1920,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "21/9",
        })
        expect(on16x9.stageWidth).toBe(1920)
        expect(on16x9.stageHeight).toBeCloseTo(1920 * (9 / 21), 2)
        expect(on16x9.videoWidth).toBe(1920)
        expect(on16x9.videoHeight).toBeCloseTo(on16x9.stageHeight, 2)
        expect(on16x9.objectFit).toBe("fill")

        const on3440 = computeVideoAspectLayout({
            containerWidth: 3440,
            containerHeight: 1440,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "21/9",
            contentBounds: { left: 0, top: 0.122, right: 1, bottom: 0.878 },
        })
        expect(on3440.stageWidth / on3440.stageHeight).toBeCloseTo(21 / 9, 4)
        expect(on3440.stageHeight).toBe(1440)
        expect(on3440.videoWidth).toBeCloseTo(on3440.stageWidth, 2)
        expect(on3440.videoHeight).toBeGreaterThan(1440)
        expect(on3440.objectFit).toBe("fill")
    })

    it("cover removes baked 21:9 letterboxes on 21:9 ultrawide without distortion", () => {
        const layout = computeVideoAspectLayout({
            containerWidth: 2560,
            containerHeight: 1080,
            intrinsicWidth: 1920,
            intrinsicHeight: 1080,
            aspectRatio: "cover",
            contentBounds: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
        })
        expect(layout.videoWidth).toBeCloseTo(2560, 2)
        expect(layout.videoHeight).toBeCloseTo(1440, 2)
        expect(layout.videoLeft).toBeCloseTo(0, 2)
        expect(layout.videoTop).toBeCloseTo(-180, 2)
    })
})

describe("detectBlackBarsFromPixels", () => {
    const W = 192
    const H = 108

    it("returns full frame for a bright 16:9 image", () => {
        const data = makeFrame(W, H, () => [120, 140, 200])
        expect(detectBlackBarsFromPixels(data, W, H)).toEqual(FULL_FRAME_BOUNDS)
    })

    it("detects baked 4:3 pillarboxes including limited-range TV black (RGB 16,16,16)", () => {
        const data = makeFrame(W, H, (x) => {
            // 24 columns on left and 24 on right = 0.125 inset per side
            if (x < 24 || x >= W - 24) return [16, 16, 16]
            return [180, 110, 60]
        })
        const res = detectBlackBarsFromPixels(data, W, H)
        expect(res).not.toBeNull()
        if (res) {
            expect(res.left).toBeCloseTo(0.125 + 0.004, 3)
            expect(res.right).toBeCloseTo(0.875 - 0.004, 3)
            expect(res.top).toBe(0)
            expect(res.bottom).toBe(1)
        }
    })

    it("detects baked 21:9 letterboxes", () => {
        const data = makeFrame(W, H, (_x, y) => {
            if (y < 14 || y >= H - 14) return [2, 2, 2]
            return [90, 150, 220]
        })
        const res = detectBlackBarsFromPixels(data, W, H)
        expect(res).not.toBeNull()
        if (res) {
            expect(res.left).toBe(0)
            expect(res.right).toBe(1)
            expect(res.top).toBeCloseTo(14 / H + 0.004, 3)
            expect(res.bottom).toBeCloseTo(1 - 14 / H - 0.004, 3)
        }
    })

    it("returns null on dark fade frames", () => {
        const data = makeFrame(W, H, () => [8, 8, 8])
        expect(detectBlackBarsFromPixels(data, W, H)).toBeNull()
    })

    it("ignores asymmetric dark shadows so dark scene halves do not trigger false crop", () => {
        const data = makeFrame(W, H, (x) => (x < 45 ? [5, 5, 5] : [140, 140, 140]))
        expect(detectBlackBarsFromPixels(data, W, H)).toEqual(FULL_FRAME_BOUNDS)
    })
})

describe("BlackBarConsensusTracker", () => {
    it("takes outermost union across recent bright samples and ignores null frames", () => {
        const tracker = new BlackBarConsensusTracker(5)
        expect(tracker.push(null)).toEqual(FULL_FRAME_BOUNDS)

        const cropped = { left: 0.129, top: 0, right: 0.871, bottom: 1 }
        expect(tracker.push(cropped)).toEqual(cropped)
        expect(tracker.push(null)).toEqual(cropped)

        // When any bright sample expands to full frame, union immediately restores full frame
        expect(tracker.push(FULL_FRAME_BOUNDS)).toEqual(FULL_FRAME_BOUNDS)

        tracker.reset()
        expect(tracker.getBounds()).toEqual(FULL_FRAME_BOUNDS)
    })
})
