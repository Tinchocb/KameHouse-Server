import { describe, it, expect } from "vitest"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import {
    computeAudioTracksKey,
    computeSubtitleTracksKey,
    matchPendingAudioTrack,
    matchPreferredAudioTrack,
    isAudioTrackDubbed,
    matchPreferredSubtitleTrack,
    resolveAutoSubtitleTarget,
} from "./track-selection"

describe("track-selection", () => {
    describe("computeAudioTracksKey & computeSubtitleTracksKey", () => {
        it("creates stable content keys", () => {
            const audioTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Japanese" },
                { index: 1, language: "spa", title: "Español Latino" },
            ]
            expect(computeAudioTracksKey(audioTracks)).toBe("0:jpn|1:spa")

            const subTracks: SubtitleTrack[] = [
                { index: 0, language: "spa", title: "Español" },
                { index: 1, language: "eng", title: "English" },
            ]
            expect(computeSubtitleTracksKey(subTracks)).toBe("0:spa|1:eng")
        })

        it("handles empty arrays and missing language gracefully", () => {
            expect(computeAudioTracksKey([])).toBe("")
            expect(computeSubtitleTracksKey([])).toBe("")
            const audioTracks: AudioTrack[] = [{ index: 0, language: "", title: "Unknown" }]
            expect(computeAudioTracksKey(audioTracks)).toBe("0:")
        })
    })

    describe("matchPendingAudioTrack", () => {
        const sampleTracks: AudioTrack[] = [
            { index: 0, language: "jpn", title: "Japanese FLAC" },
            { index: 1, language: "spa", title: "Español Latino (Classic)" },
            { index: 2, language: "spa-es", title: "Español Castellano" },
        ]

        it("matches first by index", () => {
            const match = matchPendingAudioTrack(sampleTracks, { index: 1, title: "Something Else", language: "jpn" })
            expect(match?.index).toBe(1)
        })

        it("matches by title if index does not match", () => {
            const match = matchPendingAudioTrack(sampleTracks, { index: 99, title: "Español Castellano", language: "eng" })
            expect(match?.index).toBe(2)
        })

        it("matches by language if index and title do not match", () => {
            const match = matchPendingAudioTrack(sampleTracks, { index: 99, title: "Nonexistent", language: "jpn" })
            expect(match?.index).toBe(0)
        })

        it("returns undefined if pending is null or no track matches", () => {
            expect(matchPendingAudioTrack(sampleTracks, null)).toBeUndefined()
            expect(matchPendingAudioTrack(sampleTracks, undefined)).toBeUndefined()
            expect(matchPendingAudioTrack(sampleTracks, { index: 99, title: "Nonexistent", language: "eng" })).toBeUndefined()
        })
    })

    describe("matchPreferredAudioTrack", () => {
        const tracks: AudioTrack[] = [
            { index: 0, language: "jpn", title: "Japanese (Original)" },
            { index: 1, language: "spa-es", title: "Castellano (España)" },
            { index: 2, language: "spa-lat", title: "Español Latino (México)" },
            { index: 3, language: "eng", title: "English Dub" },
        ]

        it("matches latino profile", () => {
            const matched = matchPreferredAudioTrack({
                tracks,
                preferredAudioProfile: "latino",
            })
            expect(matched?.index).toBe(2)
        })

        it("matches latino profile with fallback general spanish without castellano", () => {
            const fallbackTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Japanese" },
                { index: 1, language: "es", title: "Audio Estéreo" },
            ]
            const matched = matchPreferredAudioTrack({
                tracks: fallbackTracks,
                preferredAudioProfile: "latino",
            })
            expect(matched?.index).toBe(1)
        })

        it("matches castellano profile", () => {
            const matched = matchPreferredAudioTrack({
                tracks,
                preferredAudioProfile: "castellano",
            })
            expect(matched?.index).toBe(1)
        })

        it("matches japanese profile", () => {
            const matched = matchPreferredAudioTrack({
                tracks,
                preferredAudioProfile: "japanese",
            })
            expect(matched?.index).toBe(0)
        })

        it("matches english profile", () => {
            const matched = matchPreferredAudioTrack({
                tracks,
                preferredAudioProfile: "english",
            })
            expect(matched?.index).toBe(3)
        })

        it("falls back to preferredAudioLang if profile did not match", () => {
            const germanTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Japanese" },
                { index: 1, language: "deu", title: "German" },
            ]
            const matched = matchPreferredAudioTrack({
                tracks: germanTracks,
                preferredAudioProfile: "latino", // Latino not available
                preferredAudioLang: "deu",
            })
            expect(matched?.index).toBe(1)
        })

        it("falls back to persisted index if preferred language was 'und'", () => {
            const undTracks: AudioTrack[] = [
                { index: 0, language: "und", title: "Track 1" },
                { index: 1, language: "und", title: "Track 2" },
            ]
            const matched = matchPreferredAudioTrack({
                tracks: undTracks,
                preferredAudioLang: "und",
                preferredAudioTrackIndex: 1,
            })
            expect(matched?.index).toBe(1)
        })

        it("applies default heuristic (latino -> spanish) when no preferences are set", () => {
            const mixedTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Original" },
                { index: 1, language: "spa", title: "Latino" },
            ]
            const matched = matchPreferredAudioTrack({ tracks: mixedTracks })
            expect(matched?.index).toBe(1)
        })

        it("matches japanese profile via title fallbacks (raw / japones)", () => {
            const rawTracks: AudioTrack[] = [
                { index: 0, language: "und", title: "Video RAW (Original)" },
                { index: 1, language: "eng", title: "English Dub" },
            ]
            expect(
                matchPreferredAudioTrack({ tracks: rawTracks, preferredAudioProfile: "japanese" })?.index,
            ).toBe(0)

            const japonesTracks: AudioTrack[] = [
                { index: 0, language: "und", title: "Audio Japonés Estéreo" },
                { index: 1, language: "eng", title: "English Dub" },
            ]
            expect(
                matchPreferredAudioTrack({ tracks: japonesTracks, preferredAudioProfile: "japanese" })?.index,
            ).toBe(0)
        })

        it("applies the final generic-spanish fallback when no latino markers exist", () => {
            const genericTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Original" },
                { index: 1, language: "es", title: "Audio Estéreo" },
            ]
            expect(matchPreferredAudioTrack({ tracks: genericTracks })?.index).toBe(1)
        })

        it("returns undefined when nothing matches any heuristic", () => {
            const exoticTracks: AudioTrack[] = [
                { index: 0, language: "jpn", title: "Original" },
                { index: 1, language: "fra", title: "Français" },
            ]
            expect(
                matchPreferredAudioTrack({ tracks: exoticTracks, preferredAudioProfile: "english" }),
            ).toBeUndefined()
        })

        it("returns undefined for empty track list", () => {
            expect(matchPreferredAudioTrack({ tracks: [] })).toBeUndefined()
        })
    })

    describe("isAudioTrackDubbed", () => {
        it("returns true for Spanish variants and English", () => {
            expect(isAudioTrackDubbed({ index: 0, language: "spa", title: "Spanish" })).toBe(true)
            expect(isAudioTrackDubbed({ index: 0, language: "es", title: "Spanish" })).toBe(true)
            expect(isAudioTrackDubbed({ index: 0, language: "spa-lat", title: "Latino" })).toBe(true)
            expect(isAudioTrackDubbed({ index: 0, language: "es-mx", title: "Latino" })).toBe(true)
            expect(isAudioTrackDubbed({ index: 0, language: "eng", title: "English" })).toBe(true)
        })

        it("returns false for Japanese, other languages, or null/undefined", () => {
            expect(isAudioTrackDubbed({ index: 0, language: "jpn", title: "Japanese" })).toBe(false)
            expect(isAudioTrackDubbed({ index: 0, language: "fra", title: "French" })).toBe(false)
            expect(isAudioTrackDubbed(null)).toBe(false)
            expect(isAudioTrackDubbed(undefined)).toBe(false)
        })
    })

    describe("matchPreferredSubtitleTrack", () => {
        const subtitleTracks: SubtitleTrack[] = [
            { index: 0, language: "eng", title: "English", default: false },
            { index: 1, language: "spa", title: "Español Latino", default: false },
            { index: 2, language: "spa", title: "Español Forzado", forced: true },
        ]

        it("matches exact preferred language code", () => {
            const matched = matchPreferredSubtitleTrack(subtitleTracks, "eng")
            expect(matched?.index).toBe(0)
        })

        it("matches Spanish dialect variants when preferred is 'spa' or 'es'", () => {
            const variants: SubtitleTrack[] = [
                { index: 0, language: "jpn", title: "Japanese" },
                { index: 1, language: "es-la", title: "Latino" },
            ]
            const matched = matchPreferredSubtitleTrack(variants, "spa")
            expect(matched?.index).toBe(1)
        })

        it("falls back to default track if preferred language does not match", () => {
            const fallbackTracks: SubtitleTrack[] = [
                { index: 0, language: "fra", title: "French", default: true },
                { index: 1, language: "deu", title: "German" },
            ]
            const matched = matchPreferredSubtitleTrack(fallbackTracks, "spa")
            expect(matched?.index).toBe(0)
        })

        it("falls back to forced track if no default exists", () => {
            const fallbackTracks: SubtitleTrack[] = [
                { index: 0, language: "fra", title: "French" },
                { index: 1, language: "ita", title: "Italian", forced: true },
            ]
            const matched = matchPreferredSubtitleTrack(fallbackTracks, "spa")
            expect(matched?.index).toBe(1)
        })

        it("returns undefined when track list is empty", () => {
            expect(matchPreferredSubtitleTrack([], "spa")).toBeUndefined()
        })
    })

    describe("resolveAutoSubtitleTarget", () => {
        const subtitleTracks: SubtitleTrack[] = [
            { index: 0, language: "spa", title: "Español Completo" },
            { index: 1, language: "spa", title: "Español Forzado", forced: true },
        ]

        it("returns null when subtitles are disabled", () => {
            const target = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio: { index: 0, language: "jpn", title: "Japanese" },
                subtitlesEnabled: false,
                autoDisableSubtitlesWhenDubbed: true,
                preferredSubtitleLang: "spa",
            })
            expect(target).toBeNull()
        })

        it("returns null when audio is dubbed and autoDisableSubtitlesWhenDubbed is true", () => {
            const target = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio: { index: 0, language: "spa", title: "Latino" },
                subtitlesEnabled: true,
                autoDisableSubtitlesWhenDubbed: true,
                preferredSubtitleLang: "spa",
            })
            expect(target).toBeNull()
        })

        it("returns subtitle track when audio is dubbed but autoDisableSubtitlesWhenDubbed is false", () => {
            const target = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio: { index: 0, language: "spa", title: "Latino" },
                subtitlesEnabled: true,
                autoDisableSubtitlesWhenDubbed: false,
                preferredSubtitleLang: "spa",
            })
            expect(target?.index).toBe(0)
        })

        it("returns subtitle track when audio is Japanese (original)", () => {
            const target = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio: { index: 0, language: "jpn", title: "Japanese" },
                subtitlesEnabled: true,
                autoDisableSubtitlesWhenDubbed: true,
                preferredSubtitleLang: "spa",
            })
            expect(target?.index).toBe(0)
        })

        it("resolves without current audio and returns null when nothing matches", () => {
            const target = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio: undefined,
                subtitlesEnabled: true,
                autoDisableSubtitlesWhenDubbed: true,
                preferredSubtitleLang: "spa",
            })
            expect(target?.index).toBe(0)

            const noMatch = resolveAutoSubtitleTarget({
                subtitleTracks: [{ index: 0, language: "fra", title: "French" }],
                currentAudio: undefined,
                subtitlesEnabled: true,
                autoDisableSubtitlesWhenDubbed: false,
                preferredSubtitleLang: "spa",
            })
            expect(noMatch).toBeNull()
        })
    })
})
