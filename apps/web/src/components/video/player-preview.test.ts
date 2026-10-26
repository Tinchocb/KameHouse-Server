import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerPreviewManager } from "./player-preview"

vi.mock("hls.js", () => ({ default: { isSupported: () => false } }))

const managers: PlayerPreviewManager[] = []
const convertToBlob = vi.fn<() => Promise<Blob>>()
const createObjectURL = vi.fn<(blob: Blob | MediaSource) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()

function setup() {
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((...args: Parameters<typeof document.createElement>) => {
        const element = createElement(...args)
        if (element instanceof HTMLVideoElement) {
            let currentTime = 0
            Object.defineProperties(element, {
                readyState: { configurable: true, value: 2 },
                videoWidth: { configurable: true, value: 1280 },
                videoHeight: { configurable: true, value: 720 },
                duration: { configurable: true, value: 1800 },
                currentTime: {
                    configurable: true,
                    get: () => currentTime,
                    set: (value: number) => {
                        currentTime = value
                        void Promise.resolve().then(() => element.dispatchEvent(new Event("seeked")))
                    },
                },
            })
            element.load = vi.fn()
            element.pause = vi.fn()
        }
        return element
    })
    const video = document.createElement("video")
    const manager = new PlayerPreviewManager(video, "/episode.mkv", "direct")
    managers.push(manager)
    return { manager, video }
}

describe("ciclo de vida de previews", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        convertToBlob.mockReset().mockResolvedValue(new Blob(["frame"], { type: "image/webp" }))
        createObjectURL.mockReset().mockImplementation(() => `blob:preview-${createObjectURL.mock.calls.length}`)
        revokeObjectURL.mockReset()
        vi.stubGlobal("OffscreenCanvas", class {
            width = 0
            height = 0
            getContext() { return { drawImage: vi.fn() } }
            convertToBlob = convertToBlob
        })
        vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL)
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL)
    })
    afterEach(() => {
        for (const manager of managers) manager.cleanup()
        managers.length = 0
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("no publica una URL si la captura de otro segmento termina después de cleanup", async () => {
        const pending = Promise.withResolvers<Blob>()
        convertToBlob.mockReturnValueOnce(pending.promise)
        const { manager } = setup()
        const preview = manager.retrievePreviewForSegment(3, false)
        await vi.waitFor(() => expect(convertToBlob).toHaveBeenCalledTimes(1))
        manager.cleanup()
        pending.resolve(new Blob(["late frame"]))
        await expect(preview).resolves.toBeUndefined()
        expect(createObjectURL).not.toHaveBeenCalled()
    })

    it("no publica una URL si la captura del video actual termina después de cleanup", async () => {
        const pending = Promise.withResolvers<Blob>()
        convertToBlob.mockReturnValueOnce(pending.promise)
        const { manager, video } = setup()
        video.dispatchEvent(new Event("timeupdate"))
        await vi.advanceTimersByTimeAsync(300)
        expect(convertToBlob).toHaveBeenCalledTimes(1)
        manager.cleanup()
        pending.resolve(new Blob(["late frame"]))
        await pending.promise
        await Promise.resolve()
        expect(createObjectURL).not.toHaveBeenCalled()
    })

    it("resuelve los trabajos encolados sin ejecutarlos al cerrar", async () => {
        const pending = Promise.withResolvers<Blob>()
        convertToBlob.mockReturnValueOnce(pending.promise)
        const { manager } = setup()
        const active = manager.retrievePreviewForSegment(1, false)
        await vi.waitFor(() => expect(convertToBlob).toHaveBeenCalledTimes(1))
        const queued = manager.retrievePreviewForSegment(2, false)
        manager.cleanup()
        await expect(queued).resolves.toBeUndefined()
        pending.resolve(new Blob())
        await expect(active).resolves.toBeUndefined()
        expect(convertToBlob).toHaveBeenCalledTimes(1)
    })

    it("reutiliza una captura y revoca las URLs existentes al limpiar", async () => {
        const { manager } = setup()
        const first = await manager.retrievePreviewForSegment(1, false)
        expect(first).toBe("blob:preview-1")
        await expect(manager.retrievePreviewForSegment(1, false)).resolves.toBe(first)
        expect(convertToBlob).toHaveBeenCalledTimes(1)
        manager.cleanup()
        manager.cleanup()
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(first)
        await expect(manager.retrievePreviewForSegment(2)).resolves.toBeUndefined()
        manager._bindToVideoPlayer()
        expect(convertToBlob).toHaveBeenCalledTimes(1)
    })

    it("revoca la captura más antigua cuando el caché supera su capacidad", async () => {
        const { manager } = setup()
        for (let index = 0; index < 151; index++) {
            await manager.retrievePreviewForSegment(index, false)
        }
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:preview-1")
        manager.cleanup()
        expect(revokeObjectURL).toHaveBeenCalledTimes(151)
    })
})
