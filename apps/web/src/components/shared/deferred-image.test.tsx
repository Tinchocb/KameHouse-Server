import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DeferredImage, getTmdbHeroSrcSet } from "./deferred-image"
import { localImage, unproxyImage } from "@/lib/helpers/images"

const raw = "https://image.tmdb.org/t/p/w500/poster.jpg"

describe("DeferredImage: imágenes de TMDB por el proxy local", () => {
    it("pide la imagen y todo el srcSet por el proxy, nunca directo a TMDB", () => {
        const { container } = render(<DeferredImage src={raw} alt="Póster" priority />)
        const img = container.querySelector("img[alt='Póster']") as HTMLImageElement
        expect(img).not.toBeNull()
        expect(img.getAttribute("src")).toBe(localImage(raw))

        const entries = (img.getAttribute("srcset") ?? "").split(",").map((e) => e.trim())
        expect(entries).toHaveLength(5)
        for (const entry of entries) {
            const url = entry.split(" ")[0]
            expect(url).toMatch(/\/api\/v1\/image-proxy\?url=/)
            expect(url).not.toMatch(/^https:\/\/image\.tmdb\.org/)
        }
        // Cada ancho conserva su tamaño de TMDB dentro de la URL del proxy.
        expect(entries.map((e) => unproxyImage(e.split(" ")[0]).match(/\/t\/p\/(w\d+)\//)?.[1])).toEqual(["w185", "w342", "w500", "w780", "w1280"])
    })

    it("una URL que ya viene del proxy no se vuelve a envolver ni se reabre a otros anchos", () => {
        const proxied = localImage("https://image.tmdb.org/t/p/w342/poster.jpg")
        const { container } = render(<DeferredImage src={proxied} alt="Ya local" priority />)
        const img = container.querySelector("img[alt='Ya local']") as HTMLImageElement
        expect(img.getAttribute("src")).toBe(proxied)
        // La dimensionó quien llama (w342): un srcSet hasta w1280 bajaba imágenes 5 veces más pesadas.
        expect(img.getAttribute("srcset")).toBeNull()
    })

    it("deja igual las imágenes locales y de otros hosts", () => {
        const { container } = render(<DeferredImage src="/sagas/original/a.webp" alt="Saga" priority />)
        const img = container.querySelector("img[alt='Saga']") as HTMLImageElement
        expect(img.getAttribute("src")).toBe("/sagas/original/a.webp")
        expect(img.getAttribute("srcset")).toBeNull()
    })

    it("sin prioridad explícita no fuerza 'low': Chrome sube las visibles", () => {
        const { container } = render(<DeferredImage src={raw} alt="Visible" priority />)
        const high = container.querySelector("img[alt='Visible']") as HTMLImageElement
        expect(high.getAttribute("fetchpriority")).toBe("high")
        expect(high.getAttribute("decoding")).toBe("sync")
        expect(high.getAttribute("crossorigin")).toBe("anonymous")

        const { container: c2 } = render(<DeferredImage src={raw} alt="Normal" priority={false} fetchPriority="auto" />)
        // Sin intersección todavía no hay <img>; el contenedor existe y no rompe.
        expect(c2.querySelector("img[alt='Normal']")).toBeNull()
    })

    it("unifica crossOrigin=anonymous para el proxy local sin forzarlo en hosts externos sin CORS", () => {
        const proxied = localImage("https://image.tmdb.org/t/p/w342/poster.jpg")
        const { container: cProxy } = render(<DeferredImage src={proxied} alt="Proxy" priority />)
        expect(cProxy.querySelector("img")?.getAttribute("crossorigin")).toBe("anonymous")

        const { container: cExt } = render(<DeferredImage src="https://example.com/poster.jpg" alt="Externo" priority />)
        expect(cExt.querySelector("img")?.getAttribute("crossorigin")).toBeNull()
    })

    it("getTmdbHeroSrcSet también va por el proxy y llega a original", () => {
        const set = getTmdbHeroSrcSet("https://image.tmdb.org/t/p/w1280/back.jpg") ?? ""
        const urls = set.split(",").map((e) => unproxyImage(e.trim().split(" ")[0]))
        expect(urls).toEqual([
            "https://image.tmdb.org/t/p/w780/back.jpg",
            "https://image.tmdb.org/t/p/w1280/back.jpg",
            "https://image.tmdb.org/t/p/original/back.jpg",
        ])
        expect(set).not.toMatch(/(^|, )https:\/\/image\.tmdb\.org/)
    })
})
