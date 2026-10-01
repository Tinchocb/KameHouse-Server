import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("client-capabilities", () => {
    const originalNavigator = window.navigator
    const originalChrome = (window as unknown as { chrome?: unknown }).chrome

    beforeEach(() => {
        vi.resetModules()
    })

    afterEach(() => {
        Object.defineProperty(window, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true,
        })
        if (originalChrome !== undefined) {
            (window as unknown as { chrome?: unknown }).chrome = originalChrome
        } else {
            delete (window as unknown as { chrome?: unknown }).chrome
        }
    })

    it("detects matroska support in Chromium environments with h264 capability", async () => {
        (window as unknown as { chrome?: unknown }).chrome = {}
        Object.defineProperty(window, "navigator", {
            value: { ...originalNavigator, userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" },
            writable: true,
            configurable: true,
        })

        // Mock HTMLMediaElement.prototype.canPlayType:
        // Returns "" for matroska (standard Chromium behavior), but "probably" for h264
        vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) => {
            if (type.includes("matroska")) return ""
            if (type.includes("avc1")) return "probably"
            return ""
        })

        const { getClientCapabilities } = await import("./client-capabilities")
        const caps = getClientCapabilities()

        expect(caps.matroska).toBe(true)
    })

    it("reports matroska as false in non-Chromium environments when canPlayType returns empty", async () => {
        delete (window as unknown as { chrome?: unknown }).chrome
        Object.defineProperty(window, "navigator", {
            value: { ...originalNavigator, userAgent: "Mozilla/5.0 Firefox/120.0" },
            writable: true,
            configurable: true,
        })

        vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("")

        const { getClientCapabilities } = await import("./client-capabilities")
        const caps = getClientCapabilities()

        expect(caps.matroska).toBe(false)
    })
})
