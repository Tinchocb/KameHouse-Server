import { describe, it, expect } from "vitest"
import { resolveHeroImage, type TMDBImageItem } from "./hero-image-resolver"

describe("hero-image-resolver", () => {
    describe("resolveHeroImage cascade", () => {
        const cleanBackdrop: TMDBImageItem = {
            aspect_ratio: 1.778,
            file_path: "/clean_backdrop.jpg",
            height: 1080,
            iso_639_1: null,
            vote_average: 8.5,
            vote_count: 100,
            width: 1920,
        }

        const backdropWithText: TMDBImageItem = {
            aspect_ratio: 1.778,
            file_path: "/text_backdrop.jpg",
            height: 1080,
            iso_639_1: "en",
            vote_average: 9.0,
            vote_count: 500,
            width: 1920,
        }

        it("prioritizes clean TMDB backdrops without text", () => {
            const result = resolveHeroImage({
                tmdbImages: [backdropWithText, cleanBackdrop],
                tmdbBackdropPath: "/default_backdrop.jpg",
                anilistBannerUrl: "https://anilist.co/banner.jpg",
                posterUrl: "https://anilist.co/poster.jpg",
            })

            expect(result.source).toBe("tmdb-clean")
            expect(result.url).toBe("https://image.tmdb.org/t/p/w1280/clean_backdrop.jpg")
        })

        it("falls back to default TMDB backdrop if no clean images exist", () => {
            const result = resolveHeroImage({
                tmdbBackdropPath: "/default_backdrop.jpg",
                anilistBannerUrl: "https://anilist.co/banner.jpg",
                posterUrl: "https://anilist.co/poster.jpg",
            })

            expect(result.source).toBe("tmdb-default")
            expect(result.url).toBe("https://image.tmdb.org/t/p/w1280/default_backdrop.jpg")
        })

        it("falls back to AniList banner when TMDB backdrops are absent", () => {
            const result = resolveHeroImage({
                anilistBannerUrl: "https://anilist.co/banner.jpg",
                posterUrl: "https://anilist.co/poster.jpg",
            })

            expect(result.source).toBe("anilist-banner")
            expect(result.url).toBe("https://anilist.co/banner.jpg")
        })

        it("falls back to curated preset when online banners are absent", () => {
            const result = resolveHeroImage({
                curatedPreset: {
                    backdropUrl: "/local/dbz-hero.webp",
                    positionMobile: "!object-top",
                    positionDesktop: "sm:!object-right",
                },
                posterUrl: "https://anilist.co/poster.jpg",
            })

            expect(result.source).toBe("preset")
            expect(result.url).toBe("/local/dbz-hero.webp")
            expect(result.positionMobile).toBe("!object-top")
            expect(result.positionDesktop).toBe("sm:!object-right")
        })

        it("falls back to poster-fallback when nothing else is available", () => {
            const result = resolveHeroImage({
                posterUrl: "https://anilist.co/poster.jpg",
            })

            expect(result.source).toBe("poster-fallback")
            expect(result.url).toBe("https://anilist.co/poster.jpg")
        })

        it("handles completely empty params gracefully", () => {
            const result = resolveHeroImage({})
            expect(result.source).toBe("poster-fallback")
            expect(result.url).toBe("")
        })
    })
})
