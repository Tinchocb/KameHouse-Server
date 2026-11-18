import { afterEach, describe, expect, it } from "vitest"
import { usePlayerStore } from "./player-store"
import { useAppStore } from "./index"

afterEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState(), true)
    useAppStore.setState(useAppStore.getInitialState(), true)
    localStorage.removeItem("kamehouse-player-settings")
    localStorage.removeItem("kamehouse-app-settings")
})

describe("preferencias tras retirar el modo TV", () => {
    it("recupera maratón y las preferencias de reproducción sin rehidratar TV", async () => {
        localStorage.setItem("kamehouse-player-settings", JSON.stringify({
            version: 0,
            state: {
                tvMode: true,
                tvModePrevPrefs: { autoSkipIntro: false, autoSkipOutro: false, marathonMode: false },
                marathonMode: true,
                autoSkipIntro: true,
                autoSkipOutro: false,
                playerVolume: 0.4,
            },
        }))
        await usePlayerStore.persist.rehydrate()
        expect(usePlayerStore.getState()).toMatchObject({
            marathonMode: true, autoSkipIntro: true, autoSkipOutro: false, playerVolume: 0.4,
        })
        expect(usePlayerStore.getState()).not.toHaveProperty("tvMode")
        expect(usePlayerStore.getState()).not.toHaveProperty("tvModePrevPrefs")

        usePlayerStore.getState().setMarathonMode(false)
        expect(usePlayerStore.getState()).toMatchObject({ autoSkipIntro: true, autoSkipOutro: false })
        const saved = JSON.parse(localStorage.getItem("kamehouse-player-settings") ?? "{}").state
        expect(saved.marathonMode).toBe(false)
        expect(saved).not.toHaveProperty("tvMode")
        expect(saved).not.toHaveProperty("tvModePrevPrefs")
    })

    it("el espejo de la app también descarta TV de perfiles antiguos", async () => {
        localStorage.setItem("kamehouse-app-settings", JSON.stringify({
            version: useAppStore.persist.getOptions().version,
            state: { tvMode: true, tvModePrevPrefs: {}, marathonMode: true },
        }))
        await useAppStore.persist.rehydrate()
        expect(useAppStore.getState().marathonMode).toBe(true)
        expect(useAppStore.getState()).not.toHaveProperty("tvMode")
        expect(useAppStore.getState()).not.toHaveProperty("tvModePrevPrefs")
    })
})
