import { describe, expect, it } from "vitest"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { shelfImageUrls } from "./series-images"

const entry = (media: Record<string, unknown>) => ({ media } as unknown as Anime_LibraryCollectionEntry)

describe("shelfImageUrls", () => {
    it("incluye póster y banner de las series, en media y baja resolución, sin repetir", () => {
        const urls = shelfImageUrls([
            entry({ format: "TV", titleSpanish: "Dragon Ball", posterImage: "https://image.tmdb.org/t/p/original/p.jpg", bannerImage: "https://image.tmdb.org/t/p/original/b.jpg" }),
            entry({ format: "MOVIE", titleSpanish: "Película", posterImage: "https://image.tmdb.org/t/p/original/m.jpg" }),
            null,
        ])
        expect(urls.some((u) => u.includes("p.jpg"))).toBe(true)
        expect(urls.some((u) => u.includes("b.jpg"))).toBe(true)
        expect(urls.some((u) => u.includes("m.jpg"))).toBe(false) // las películas no van en la estantería
        expect(new Set(urls).size).toBe(urls.length)
        expect(urls.length).toBeGreaterThanOrEqual(2)
    })

    it("pide por la caché local del servidor las mismas URLs que precalienta el backend", () => {
        const urls = shelfImageUrls([
            entry({ format: "TV", titleSpanish: "Serie X", posterImage: "https://image.tmdb.org/t/p/original/p.jpg", bannerImage: "https://image.tmdb.org/t/p/w1280/b.jpg" }),
        ])
        // Mismo orden y URLs que TestShelfImageURLsCoincideConElFront (handlers/shelf_images_test.go).
        const tmdb = urls.map((u) => new URL(u, "http://local").searchParams.get("url") ?? "")
        expect(urls.every((u) => u.includes("/api/v1/image-proxy?url="))).toBe(true)
        expect(tmdb).toEqual([
            "https://image.tmdb.org/t/p/w342/p.jpg",
            "https://image.tmdb.org/t/p/w185/p.jpg",
            "https://image.tmdb.org/t/p/w342/b.jpg",
            "https://image.tmdb.org/t/p/w185/b.jpg",
        ])
    })
})

describe("moviePosterUrls", () => {
    it("solo pósters de películas, sin repetir", async () => {
        const { moviePosterUrls } = await import("./series-images")
        const urls = moviePosterUrls([
            entry({ format: "MOVIE", posterImage: "https://image.tmdb.org/t/p/original/m.jpg" }),
            entry({ format: "MOVIE", posterImage: "https://image.tmdb.org/t/p/original/m.jpg" }),
            entry({ format: "TV", posterImage: "https://image.tmdb.org/t/p/original/s.jpg" }),
            entry({ format: "MOVIE" }),
        ])
        expect(urls).toHaveLength(1)
        expect(urls[0]).toContain("m.jpg")
    })
})
