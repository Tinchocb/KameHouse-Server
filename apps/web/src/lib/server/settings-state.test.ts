import { afterEach, describe, expect, it } from "vitest"
import { getEffectiveSettings, syncStoresWithSettings } from "./settings-state"
import { settingsSchema } from "./settings"
import { changedSettings } from "./settings-patch"
import { usePlayerStore, useUIStore } from "@/lib/store"
import { usePerformanceStore } from "@/lib/hardware/performance-store"

afterEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
    usePerformanceStore.setState(usePerformanceStore.getInitialState(), true)
})

describe("settings hydration and persistence", () => {
    it("restores server false, zero and empty values over stale local audio", () => {
        useUIStore.setState({ bgMusicEnabled: true, uiSoundsEnabled: true, bgMusicVolume: 0.8,
            uiSoundsVolume: 0.8, seriesSoundtrackMode: true, bgMusicDir: "old",
            bgMusicTracks: [{ name: "old", file: "old.mp3" }] })
        const stored = settingsSchema.parse({ theme: { bgMusicEnabled: false, uiSoundsEnabled: false,
            bgMusicVolume: 0, uiSoundsVolume: 0, seriesSoundtrackMode: false,
            bgMusicDir: "", bgMusicTracks: [] } })
        const effective = getEffectiveSettings(stored)
        expect(effective.theme).toEqual(stored.theme)
        syncStoresWithSettings(effective)
        expect(useUIStore.getState()).toMatchObject({ bgMusicEnabled: false, uiSoundsEnabled: false,
            bgMusicVolume: 0, uiSoundsVolume: 0, seriesSoundtrackMode: false,
            bgMusicDir: "", bgMusicTracks: [] })
    })

    it("discards live previews using saved audio, player and performance values", () => {
        const saved = settingsSchema.parse({ library: { autoSkipIntro: false, marathonMode: false },
            mediastream: { performanceProfile: "eco", autoGovernorEnabled: false },
            theme: { bgMusicEnabled: false, uiSoundsVolume: 0 } })
        useUIStore.setState({ bgMusicEnabled: true, uiSoundsVolume: 1 })
        usePlayerStore.setState({ autoSkipIntro: true, marathonMode: true })
        usePerformanceStore.setState({ performanceProfile: "ultra", autoGovernorEnabled: true })
        syncStoresWithSettings(getEffectiveSettings(saved))
        expect(useUIStore.getState()).toMatchObject({ bgMusicEnabled: false, uiSoundsVolume: 0 })
        expect(usePlayerStore.getState()).toMatchObject({ autoSkipIntro: false, marathonMode: false })
        expect(usePerformanceStore.getState()).toMatchObject({ performanceProfile: "eco", autoGovernorEnabled: false })
    })

    it("sends each schema option independently, including false, zero and empty lists", () => {
        const defaults = settingsSchema.parse({})
        let tested = 0
        for (const [section, fields] of Object.entries(defaults)) {
            for (const [key, value] of Object.entries(fields as object)) {
                const next = structuredClone(defaults)
                const changed = typeof value === "boolean" ? !value : typeof value === "number" ? value + 1
                    : Array.isArray(value) ? ["test"] : "changed"
                ;(next[section] as Record<string, unknown>)[key] = changed
                expect(changedSettings(next, defaults)).toEqual({ [section]: { [key]: changed } })
                expect(changedSettings(defaults, next)).toEqual({ [section]: { [key]: value } })
                tested++
            }
        }
        expect(tested).toBeGreaterThan(70)
    })

    it("does not resend unchanged keys, credentials or server-owned timestamps", () => {
        const baseline = settingsSchema.parse({ id: 1, updatedAt: "old", library: { lastScanAt: "scan" },
            googleDrive: { clientSecret: "********", refreshToken: "********" } })
        const edited = structuredClone(baseline)
        edited.updatedAt = "new"
        edited.library.lastScanAt = "new scan"
        edited.theme.themeEnableLiquidGlass = false
        expect(changedSettings(edited, baseline)).toEqual({ theme: { themeEnableLiquidGlass: false } })
        expect(changedSettings(baseline, baseline)).toEqual({})
    })
})
