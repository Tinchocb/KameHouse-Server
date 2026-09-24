import { describe, it, expect } from "vitest"
import { getSafeCollectionEntries } from "./collection"
import type { Anime_LibraryCollection, Anime_LibraryCollectionEntry } from "@/api/generated/types"

describe("collection helper", () => {
    describe("getSafeCollectionEntries", () => {
        it("returns an empty array when collection is null or undefined", () => {
            expect(getSafeCollectionEntries(null)).toEqual([])
            expect(getSafeCollectionEntries(undefined)).toEqual([])
        })

        it("returns an empty array when collection.lists is undefined or empty", () => {
            expect(getSafeCollectionEntries({} as Anime_LibraryCollection)).toEqual([])
            expect(getSafeCollectionEntries({ lists: [] } as unknown as Anime_LibraryCollection)).toEqual([])
        })

        it("filters out null or undefined entries serialised from Go nil pointers", () => {
            const entry1: Anime_LibraryCollectionEntry = {
                mediaId: 101,
            } as Anime_LibraryCollectionEntry

            const entry2: Anime_LibraryCollectionEntry = {
                mediaId: 102,
            } as Anime_LibraryCollectionEntry

            const mockCollection = {
                lists: [
                    {
                        name: "Watching",
                        entries: [entry1, null as unknown as Anime_LibraryCollectionEntry, undefined as unknown as Anime_LibraryCollectionEntry],
                    },
                    {
                        name: "Completed",
                        entries: [null as unknown as Anime_LibraryCollectionEntry, entry2],
                    },
                ],
            } as unknown as Anime_LibraryCollection

            const result = getSafeCollectionEntries(mockCollection)
            expect(result).toHaveLength(2)
            expect(result[0].mediaId).toBe(101)
            expect(result[1].mediaId).toBe(102)
        })

        it("handles null lists in collection.lists gracefully", () => {
            const entry: Anime_LibraryCollectionEntry = {
                mediaId: 200,
            } as Anime_LibraryCollectionEntry

            const mockCollection = {
                lists: [
                    null,
                    {
                        name: "Planning",
                        entries: [entry],
                    },
                ],
            } as unknown as Anime_LibraryCollection

            const result = getSafeCollectionEntries(mockCollection)
            expect(result).toHaveLength(1)
            expect(result[0].mediaId).toBe(200)
        })
    })
})
