import { describe, expect, it } from "vitest"
import { audioProfileOptions, isAudioProfileChoice, seriesAudioProfileValue } from "./series-audio-profile"

describe("audioProfileOptions", () => {
    it("pone Global primero con siglas, y el perfil de Ajustes entre paréntesis", () => {
        const options = audioProfileOptions("latino")
        expect(options[0]).toEqual({
            value: "",
            label: "GLO (LAT)",
            ariaLabel: "Global (Latino)",
        })
    })

    it("ofrece cada perfil una vez con sus siglas correspondientes", () => {
        const options = audioProfileOptions("japanese")
        expect(options.map(o => o.value)).toEqual(["", "latino", "castellano", "japanese", "english", "auto"])
        expect(options.map(o => o.label)).toEqual(["GLO (JAP)", "LAT", "CAS", "JAP", "ENG", "AUTO"])
        expect(options.map(o => o.ariaLabel)).toEqual(["Global (Japonés)", "Latino", "Castellano", "Japonés", "Inglés", "Automático"])
    })
})

describe("seriesAudioProfileValue", () => {
    const profiles = [
        { mediaId: 236, audioProfile: "japanese" },
        { mediaId: 12, audioProfile: "latino" },
    ]

    it("devuelve el perfil guardado de la serie", () => {
        expect(seriesAudioProfileValue(profiles, 236)).toBe("japanese")
    })

    it("devuelve vacío cuando la serie no tiene perfil propio", () => {
        expect(seriesAudioProfileValue(profiles, 999)).toBe("")
        expect(seriesAudioProfileValue(undefined, 236)).toBe("")
    })

    it("ignora un valor que no es un perfil conocido", () => {
        expect(seriesAudioProfileValue([{ mediaId: 1, audioProfile: "spanish" }], 1)).toBe("")
    })
})

describe("isAudioProfileChoice", () => {
    it("acepta solo los perfiles conocidos", () => {
        expect(isAudioProfileChoice("auto")).toBe(true)
        expect(isAudioProfileChoice("")).toBe(false)
        expect(isAudioProfileChoice(undefined)).toBe(false)
    })
})
