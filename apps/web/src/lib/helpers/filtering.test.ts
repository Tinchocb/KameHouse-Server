import { describe, it, expect } from "vitest"
import { filterEntriesByTitle, filterListEntries, DEFAULT_COLLECTION_PARAMS } from "./filtering"
import { Platform_AnimeListEntry } from "@/api/generated/types"

describe("filtering helper", () => {
    describe("filterEntriesByTitle", () => {
        const mockEntries = [
            { media: { title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin", native: "進撃の巨人" } } },
            { media: { title: { english: "Death Note", romaji: "Death Note", native: "デスノート" } } },
            { media: { title: { english: "One Piece", romaji: "One Piece", native: "ワンピース" } } },
        ] as unknown as Platform_AnimeListEntry[]

        it("should filter by english title", () => {
            const result = filterEntriesByTitle(mockEntries, "attack")
            expect(result).toHaveLength(1)
            expect(result[0].media?.title?.english).toBe("Attack on Titan")
        })

        it("should filter by romaji title", () => {
            const result = filterEntriesByTitle(mockEntries, "shingeki")
            expect(result).toHaveLength(1)
            expect(result[0].media?.title?.romaji).toBe("Shingeki no Kyojin")
        })

        it("should handle mixed case and extra spaces", () => {
            const result = filterEntriesByTitle(mockEntries, "  DEATH   note  ")
            expect(result).toHaveLength(1)
            expect(result[0].media?.title?.english).toBe("Death Note")
        })

        it("should return all entries for empty input", () => {
            const result = filterEntriesByTitle(mockEntries, "")
            expect(result).toHaveLength(3)
        })
    })

    describe("filterListEntries", () => {
        const mockEntries = [
            { 
                media: { 
                    title: { english: "A", romaji: "A" }, 
                    format: "TV", 
                    status: "FINISHED",
                    startDate: { year: 2020, month: 1 },
                    isAdult: false
                },
                score: 90
            },
            { 
                media: { 
                    title: { english: "B", romaji: "B" }, 
                    format: "MOVIE", 
                    status: "RELEASING",
                    startDate: { year: 2021, month: 1 },
                    isAdult: false
                },
                score: 80
            },
            { 
                media: { 
                    title: { english: "C", romaji: "C" }, 
                    format: "TV", 
                    status: "FINISHED",
                    startDate: { year: 2020, month: 6 },
                    isAdult: true
                },
                score: 100
            },
        ] as unknown as Platform_AnimeListEntry[]

        it("should filter by format", () => {
            const params: CollectionParams<"anime"> = { ...DEFAULT_COLLECTION_PARAMS, format: "MOVIE" }
            const result = filterListEntries("anime", mockEntries, params, true)
            expect(result).toHaveLength(1)
            expect(result[0].media?.title?.english).toBe("B")
        })

        it("should filter by status", () => {
            const params: CollectionParams<"anime"> = { ...DEFAULT_COLLECTION_PARAMS, status: "RELEASING" }
            const result = filterListEntries("anime", mockEntries, params, true)
            expect(result).toHaveLength(1)
            expect(result[0].media?.title?.english).toBe("B")
        })

        it("should filter adult content if showAdultContent is false", () => {
            const params: CollectionParams<"anime"> = { ...DEFAULT_COLLECTION_PARAMS }
            const result = filterListEntries("anime", mockEntries, params, false)
            expect(result).toHaveLength(2)
            expect(result.some(n => n.media?.isAdult)).toBe(false)
        })

        it("should sort by score descending", () => {
            const params: CollectionParams<"anime"> = { ...DEFAULT_COLLECTION_PARAMS, sorting: "SCORE_DESC" }
            const result = filterListEntries("anime", mockEntries, params, true)
            expect(result[0].score).toBe(100)
            expect(result[1].score).toBe(90)
            expect(result[2].score).toBe(80)
        })

        it("should sort by title ascending", () => {
            const params: CollectionParams<"anime"> = { ...DEFAULT_COLLECTION_PARAMS, sorting: "TITLE" }
            const result = filterListEntries("anime", mockEntries, params, true)
            expect(result[0].media?.title?.english).toBe("A")
            expect(result[2].media?.title?.english).toBe("C")
        })
    })
})
