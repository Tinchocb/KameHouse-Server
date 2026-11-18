import { afterEach, describe, expect, it, vi } from "vitest"
import { PlayerPreviewManager } from "./player-preview"
vi.mock("@/api/client/server-url", () => ({ getServerBaseUrl: () => "http://localhost:43211" }))
const manifest = { version: "a".repeat(64), interval: 10, columns: 4, rows: 3, width: 200, height: 112 }
const managers: PlayerPreviewManager[] = []
function setup() {
    const manager = new PlayerPreviewManager("gdrive://file/episode.mkv")
    managers.push(manager)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sheet")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    return manager
}
afterEach(() => { managers.splice(0).forEach(m => m.cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe("storyboard previews", () => {
    it("prewarm only requests the index, without starting frame extraction", async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest)))
        vi.stubGlobal("fetch", fetcher)
        setup().prewarm()
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
        expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.has("sheet")).toBe(false)
    })
    it("clamps the end to the last existing tile and ignores non-finite times", () => {
        const manager = new PlayerPreviewManager("episode", () => 120)
        managers.push(manager)
        expect(manager.calculateSegmentIndex(120)).toBe(11)
        expect(manager.calculateSegmentIndex(NaN)).toBe(0)
        expect(manager.calculateSegmentIndex(-10)).toBe(0)
    })
    it("requests only the selected frame and reuses it from cache", async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
            .mockImplementation(() => Promise.resolve(new Response(new Blob(["jpeg"], { type: "image/jpeg" }))))
        vi.stubGlobal("fetch", fetcher)
        const manager = setup()
        const first = await manager.retrievePreviewForSegment(0)
        const last = await manager.retrievePreviewForSegment(0)
        expect(first).toMatchObject({ column: 0, row: 0 })
        expect(last).toMatchObject({ column: 0, row: 0, columns: 1, rows: 1, url: first.url })
        expect(fetcher).toHaveBeenCalledTimes(2)
        expect(String(fetcher.mock.calls[1][0])).toContain("sheet=0")
        expect(String(fetcher.mock.calls[1][0])).toContain("frame=0")
        await manager.retrievePreviewForSegment(12)
        expect(String(fetcher.mock.calls[2][0])).toContain("sheet=1")
    })
    it("deduplicates concurrent requests for the same sheet", async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
            .mockImplementation(() => Promise.resolve(new Response(new Blob(["jpeg"], { type: "image/jpeg" }))))
        vi.stubGlobal("fetch", fetcher)
        const manager = setup()
        await Promise.all([manager.retrievePreviewForSegment(1), manager.retrievePreviewForSegment(1)])
        expect(fetcher).toHaveBeenCalledTimes(2)
    })
    it("aborts obsolete sheets and closes all work on cleanup", async () => {
        const signals: AbortSignal[] = []
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
            .mockImplementation((_url, options) => {
                signals.push(options.signal)
                return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
            }))
        const manager = setup()
        const first = manager.retrievePreviewForSegment(1).catch(() => undefined)
        await vi.waitFor(() => expect(signals).toHaveLength(1))
        const second = manager.retrievePreviewForSegment(12).catch(() => undefined)
        await vi.waitFor(() => expect(signals).toHaveLength(2))
        expect(signals[0].aborted).toBe(true)
        manager.cleanup()
        expect(signals[1].aborted).toBe(true)
        await Promise.all([first, second])
    })
    it("reports a failure instead of returning an empty thumbnail", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })))
        await expect(setup().retrievePreviewForSegment(0)).rejects.toThrow("Vista previa no disponible")
    })
})
