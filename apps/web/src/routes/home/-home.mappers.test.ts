import { describe, expect, it, vi } from "vitest"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { dedupeAndMapToSpotlight, isMovieLike, mapLibraryEntryToMediaCard, resolveTargetId } from "./home.mappers"
import { getBackdrop, getTitle } from "./home.helpers"

/** Simula payloads incompletos de la API: los tipos generados no lo permiten. */
function entry(partial: Record<string, unknown>, media: Record<string, unknown> | null): Anime_LibraryCollectionEntry {
    return { mediaId: 0, availabilityType: "FULL_LOCAL", ...partial, media } as unknown as Anime_LibraryCollectionEntry
}

/** Mapea y falla el test si el mapper descarta la entry. */
function card(e: Anime_LibraryCollectionEntry, onNavigate = vi.fn()): SwimlaneItem {
    const item = mapLibraryEntryToMediaCard(e, onNavigate)
    if (!item) throw new Error("mapper devolvió null")
    return item
}

describe("home.helpers", () => {
    it("tolera media null y campos vacíos", () => {
        expect(getTitle(null)).toBe("Sin título")
        expect(getTitle({ titleSpanish: "  ", titleEnglish: " Dragon Ball " })).toBe("Dragon Ball")
        expect(getBackdrop(undefined)).toBe("")
        expect(getBackdrop({ bannerImage: null as unknown as string, posterImage: " p.jpg " })).toBe("p.jpg")
    })
})

describe("resolveTargetId", () => {
    it("salta 0/NaN y cae a tmdbId → id", () => {
        const media = { tmdbId: Number.NaN, id: 42 }
        expect(resolveTargetId(entry({ mediaId: 0 }, media), media)).toBe(42)
    })
    it("devuelve null si no hay id válido", () => {
        const media = { tmdbId: -1 }
        expect(resolveTargetId(entry({ mediaId: 0 }, media), media)).toBeNull()
    })
})

describe("isMovieLike", () => {
    it("normaliza mayúsculas y no usa el offset TMDB", () => {
        expect(isMovieLike({ format: " movie " })).toBe(true)
        expect(isMovieLike({ type: "Movie" })).toBe(true)
        expect(isMovieLike({ format: "TV", tmdbId: 1_062_715 })).toBe(false)
        expect(isMovieLike(null)).toBe(false)
    })
})

describe("mapLibraryEntryToMediaCard", () => {
    it("descarta entries sin media o sin id", () => {
        expect(mapLibraryEntryToMediaCard(null, vi.fn())).toBeNull()
        expect(mapLibraryEntryToMediaCard(entry({ mediaId: 1 }, null), vi.fn())).toBeNull()
        expect(mapLibraryEntryToMediaCard(entry({}, { title: "x" }), vi.fn())).toBeNull()
    })

    it("sanea subtítulo, score e imágenes con datos incompletos", () => {
        const item = card(
            entry({ mediaId: 7 }, { format: "movie", year: null, score: Number.NaN, posterImage: null, bannerImage: " b.jpg " }),
        )
        expect(item.subtitle).toBe("MOVIE")
        expect(item.badge).toBe("MOVIE")
        expect(item.rating).toBeUndefined()
        expect(item.image).toBe("b.jpg")
        expect(item.title).toBe("Sin título")
    })

    it("normaliza score 0–100 y strings numéricos", () => {
        expect(card(entry({ mediaId: 1 }, { score: 85 })).rating).toBe(8.5)
        expect(card(entry({ mediaId: 1 }, { score: "7.2" })).rating).toBe(7.2)
    })

    it("usa los episodios canónicos también con id con offset TMDB", () => {
        // Dragon Ball (tmdb 12609, 153 episodios) servido como 1_012_609.
        const item = card(entry({ mediaId: 1_012_609, libraryData: { mainFileCount: 150 } }, { format: "TV" }))
        expect(item.totalEpisodesCount).toBe(153)
        expect(item.missingCount).toBe(3)
        expect(item.isSeriesComplete).toBe(false)
    })

    it("onClick navega con el id resuelto", () => {
        const onNavigate = vi.fn()
        card(entry({ mediaId: 0 }, { tmdbId: 99 }), onNavigate).onClick()
        expect(onNavigate).toHaveBeenCalledWith(99)
    })
})

describe("dedupeAndMapToSpotlight", () => {
    it("deduplica por id resuelto y descarta nulos en una pasada", () => {
        const items = dedupeAndMapToSpotlight(
            [
                entry({ mediaId: 5 }, { titleEnglish: "A" }),
                null,
                entry({ mediaId: 5 }, { titleEnglish: "A duplicada" }),
                entry({ mediaId: 0 }, { id: 6, titleEnglish: "B" }),
                entry({ mediaId: 0 }, {}),
            ],
            vi.fn(),
        )
        expect(items.map(i => [i.id, i.title])).toEqual([
            ["media-5", "A"],
            ["media-6", "B"],
        ])
    })
})
