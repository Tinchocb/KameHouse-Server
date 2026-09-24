import { getLargeResImage } from "./images"
import type { HeroEraVisualConfig } from "@/lib/config/eras"

export interface TMDBImageItem {
    aspect_ratio: number
    file_path: string
    height: number
    iso_639_1: string | null
    vote_average: number
    vote_count: number
    width: number
}

export interface TMDBImagesResponse {
    id: number
    backdrops: TMDBImageItem[]
    posters: TMDBImageItem[]
    logos: TMDBImageItem[]
}

export interface HeroImageConfig {
    url: string
    positionMobile: string
    positionDesktop: string
    zoom?: number
    source: "preset" | "tmdb-clean" | "tmdb-default" | "anilist-banner" | "poster-fallback"
}

/**
 * Resuelve la mejor imagen panorámica de fondo para el Hero utilizando
 * un pipeline de decisión en cascada (Fallback inteligente):
 *
 * 1. Preset curado KameHouse (con encuadre verificado y zona segura garantizada)
 * 2. Mejor backdrop limpio de TMDb (sin texto incrustado: iso_639_1 === null)
 * 3. BannerImage nativo horizontal de AniList
 * 4. Backdrop por defecto de TMDb (backdrop_path)
 * 5. Poster vertical como último recurso
 */
export function resolveHeroImage(params: {
    curatedPreset?: HeroEraVisualConfig | null
    tmdbImages?: TMDBImageItem[] | null
    tmdbBackdropPath?: string | null
    anilistBannerUrl?: string | null
    posterUrl?: string | null
}): HeroImageConfig {
    const { curatedPreset, tmdbImages, tmdbBackdropPath, anilistBannerUrl, posterUrl } = params

    // 1. TMDB Clean Backdrop (filtra backdrops 16:9 sin títulos ni logos incrustados)
    if (tmdbImages && tmdbImages.length > 0) {
        const cleanBackdrops = tmdbImages.filter(img =>
            (!img.iso_639_1 || img.iso_639_1 === "" || img.iso_639_1 === "xx") &&
            img.width >= 1280 &&
            img.aspect_ratio >= 1.5 &&
            img.aspect_ratio <= 2.2
        )

        const bestBackdrop = cleanBackdrops.length > 0
            ? cleanBackdrops.sort((a, b) => (b.vote_count * b.vote_average) - (a.vote_count * a.vote_average))[0]
            : tmdbImages[0]

        if (bestBackdrop?.file_path) {
            return {
                url: `https://image.tmdb.org/t/p/w1280${bestBackdrop.file_path}`,
                positionMobile: curatedPreset?.positionMobile || "!object-[center_40%]",
                positionDesktop: curatedPreset?.positionDesktop || "sm:!object-[70%_42%]",
                zoom: 1,
                source: "tmdb-clean",
            }
        }
    }

    // 2. TMDB Backdrop por defecto (widescreen canónico 16:9)
    if (tmdbBackdropPath && tmdbBackdropPath.trim() !== "") {
        const fullUrl = tmdbBackdropPath.startsWith("http")
            ? getLargeResImage(tmdbBackdropPath)
            : `https://image.tmdb.org/t/p/w1280${tmdbBackdropPath.startsWith("/") ? "" : "/"}${tmdbBackdropPath}`

        return {
            url: fullUrl,
            positionMobile: curatedPreset?.positionMobile || "!object-[center_40%]",
            positionDesktop: curatedPreset?.positionDesktop || "sm:!object-[70%_42%]",
            zoom: 1,
            source: "tmdb-default",
        }
    }

    // 3. AniList Banner (arte horizontal original de anime)
    if (anilistBannerUrl && anilistBannerUrl.trim() !== "") {
        return {
            url: anilistBannerUrl,
            positionMobile: curatedPreset?.positionMobile || "!object-[center_40%]",
            positionDesktop: curatedPreset?.positionDesktop || "sm:!object-[70%_42%]",
            zoom: 1,
            source: "anilist-banner",
        }
    }

    // 4. Preset curado KameHouse (fallback local offline)
    if (curatedPreset?.backdropUrl) {
        return {
            url: curatedPreset.backdropUrl,
            positionMobile: curatedPreset.positionMobile || "!object-[center_40%]",
            positionDesktop: curatedPreset.positionDesktop || "sm:!object-[70%_42%]",
            zoom: 1,
            source: "preset",
        }
    }

    // 5. Fallback a Poster
    return {
        url: posterUrl || "",
        positionMobile: "!object-center",
        positionDesktop: "sm:!object-center",
        zoom: 1,
        source: "poster-fallback",
    }
}
