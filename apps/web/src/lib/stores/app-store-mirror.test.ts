import { describe, expect, it } from "vitest"
import { useAppStore } from "./index"

// DT-05: el espejo de ajustes no persiste nada propio; cada campo lo guarda su sub-store.
describe("espejo de ajustes kamehouse-app-settings (DT-05)", () => {
    it("no persiste ningún campo propio", () => {
        const options = useAppStore.persist.getOptions()
        expect(options.partialize?.(useAppStore.getState())).toEqual({})
    })

    it("descarta el espejo de versiones anteriores al migrar", () => {
        const options = useAppStore.persist.getOptions()
        expect(options.migrate?.({ state: { bgMusicVolume: 99 } }, 1)).toEqual({})
    })
})
