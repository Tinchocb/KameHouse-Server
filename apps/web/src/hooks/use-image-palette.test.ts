import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { extractPaletteColors, useImagePalette, usePosterPalette } from "./use-image-palette"

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function controlledPaletteImages() {
    const requests: { resolve: () => void; reject: () => void }[] = []
    vi.stubGlobal("Image", class {
        decode() {
            return new Promise<void>((resolve, reject) => requests.push({ resolve, reject: () => reject(new Error("Image failed")) }))
        }
    })
    const data = new Uint8ClampedArray(32 * 18 * 4)
    for (let i = 0; i < data.length; i += 4) data.set([34, 197, 94, 255], i)
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage, getImageData: () => ({ data }),
    } as unknown as CanvasRenderingContext2D)
    return { requests, drawImage }
}

describe("shared palette extraction", () => {
    it("decodes and samples once for concurrent consumers, then reuses the result", async () => {
        const { requests, drawImage } = controlledPaletteImages()
        const consumers = Array.from({ length: 12 }, () => renderHook(() => useImagePalette("/shared-palette.webp")))
        expect(requests).toHaveLength(1)
        consumers[0].unmount()
        await act(async () => { requests[0].resolve() })
        expect(drawImage).toHaveBeenCalledTimes(1)
        const palette = consumers[1].result.current
        expect(palette?.accent).toBe("rgb(34, 197, 94)")
        expect(consumers.slice(1).every(consumer => consumer.result.current === palette)).toBe(true)
        const cached = renderHook(() => useImagePalette("/shared-palette.webp"))
        expect(cached.result.current).toBe(palette)
        expect(requests).toHaveLength(1)
    })
    it("allows a failed request to be retried", async () => {
        const { requests } = controlledPaletteImages()
        const first = renderHook(() => useImagePalette("/retry-palette.webp"))
        await act(async () => { requests[0].reject() })
        expect(first.result.current).toBeNull()
        first.unmount()
        const retry = renderHook(() => useImagePalette("/retry-palette.webp"))
        expect(requests).toHaveLength(2)
        await act(async () => { requests[1].resolve() })
        expect(retry.result.current?.accent).toBe("rgb(34, 197, 94)")
    })
    it("ignores a shared result after the consumer changes source", async () => {
        const { requests } = controlledPaletteImages()
        const { result, rerender } = renderHook(({ src }: { src: string | null }) => useImagePalette(src), { initialProps: { src: "/stale-palette.webp" as string | null } })
        rerender({ src: null })
        await act(async () => { requests[0].resolve() })
        expect(result.current).toBeNull()
    })
})

describe("extractPaletteColors", () => {
    it("extrae color vibrante dominante de píxeles cromáticos (ej. verde Broly)", () => {
        // Matriz 4x4 de píxeles: verde esmeralda brillante (r: 34, g: 197, b: 94, a: 255)
        const width = 4
        const height = 4
        const data = new Uint8ClampedArray(width * height * 4)
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 34
            data[i + 1] = 197
            data[i + 2] = 94
            data[i + 3] = 255
        }

        const result = extractPaletteColors(data, width, height)
        expect(result.accent).toBe("rgb(34, 197, 94)")
        expect(result.dark).toContain("rgb(")
        expect(result.surface).toContain("rgb(")
        expect(result.accentText).toContain("rgb(")
    })

    it("asegura contraste accesible en el texto para colores oscuros (ej. azul profundo)", () => {
        // Azul oscuro (r: 30, g: 40, b: 180)
        const width = 4
        const height = 4
        const data = new Uint8ClampedArray(width * height * 4)
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 30
            data[i + 1] = 40
            data[i + 2] = 180
            data[i + 3] = 255
        }

        const result = extractPaletteColors(data, width, height)
        expect(result.accent).toBe("rgb(30, 40, 180)")
        // El texto debe haber sido aclarado para ser legible en fondo oscuro
        const match = result.accentText.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        expect(match).not.toBeNull()
        if (match) {
            const [, r, g] = match.map(Number)
            expect(r).toBeGreaterThan(30)
            expect(g).toBeGreaterThan(40)
        }
    })

    it("ofrece fallback armonioso cuando la imagen es completamente transparente o vacía", () => {
        const width = 2
        const height = 2
        const data = new Uint8ClampedArray(width * height * 4) // Todo 0 / transparente
        const result = extractPaletteColors(data, width, height)

        expect(result.accent).toBe("rgb(245, 158, 11)") // Fallback cálido de DB
        expect(result.dark).toBe("rgb(30, 25, 19)")
    })
})

describe("usePosterPalette", () => {
    it("devuelve los estilos de la era cuando no hay paleta de imagen cargada", () => {
        const fallback = {
            accent: "#f59e0b",
            glowStrong: "#fbbf24",
            ambientGlow1: "#fde68a",
        }

        const { result } = renderHook(() => usePosterPalette(null, fallback))

        expect(result.current.accent).toBe("#f59e0b")
        expect(result.current.hoverBorder).toContain("#f59e0b")
        expect(result.current.hoverShadow).toContain("#f59e0b")
        expect(result.current.drawerBackground).toContain("#0c0e14")
        expect(result.current.pillBackground).toContain("#f59e0b")
    })
})
