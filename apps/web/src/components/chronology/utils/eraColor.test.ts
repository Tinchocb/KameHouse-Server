import { describe, expect, it } from "vitest"
import { eraTextChannels, eraTextColor, hexToRgbChannels } from "./eraColor"

describe("hexToRgbChannels", () => {
    it("convierte #rrggbb en canales separados por espacio", () => {
        expect(hexToRgbChannels("#ef4444")).toBe("239 68 68")
    })

    it("acepta el formato corto #rgb y el hex sin almohadilla", () => {
        expect(hexToRgbChannels("#fff")).toBe("255 255 255")
        expect(hexToRgbChannels("abc")).toBe("170 187 204")
    })

    it("un valor inválido cae al naranja de respaldo", () => {
        expect(hexToRgbChannels("#zzzzzz")).toBe("245 158 11")
    })
})

describe("eraTextColor y eraTextChannels", () => {
    it("DBGT y DB usan su versión aclarada para texto, sin importar mayúsculas", () => {
        expect(eraTextColor("#E23A55")).toBe("var(--era-dbgt-text)")
        expect(eraTextColor("var(--era-db-hex)")).toBe("var(--era-db-text)")
        expect(eraTextChannels("#f2762e")).toBe("var(--era-db-text-rgb)")
    })

    it("DBS y Daima también usan su versión aclarada para texto", () => {
        expect(eraTextColor("#3D8BFF")).toBe("var(--era-dbs-text)")
        expect(eraTextColor("var(--spotlight-daima-vivid)")).toBe("var(--era-daima-text)")
        expect(eraTextChannels("#A56EF0")).toBe("var(--era-daima-text-rgb)")
    })

    it("otras eras conservan su color y su canal RGB calculado", () => {
        expect(eraTextColor("#123456")).toBe("#123456")
        expect(eraTextChannels("#123456")).toBe("18 52 86")
    })
})
