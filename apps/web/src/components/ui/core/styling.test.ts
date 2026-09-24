import { describe, expect, it } from "vitest"
import { cn } from "./styling"

describe("cn", () => {
    it("no borra los tamaños de micro-tipografía al combinarlos con un color de texto", () => {
        expect(cn("text-3xs text-on-surface")).toBe("text-3xs text-on-surface")
        expect(cn("text-2xs uppercase text-white/60 sm:text-2xs")).toBe("text-2xs uppercase text-white/60 sm:text-2xs")
        expect(cn("text-label-sm text-on-surface-variant")).toBe("text-label-sm text-on-surface-variant")
    })

    it("resuelve el conflicto entre dos tamaños quedándose con el último", () => {
        expect(cn("text-3xs", "text-sm")).toBe("text-sm")
        expect(cn("text-xs", "text-5xs")).toBe("text-5xs")
    })

    it("trata las sombras del sistema como sombra y no como color", () => {
        expect(cn("shadow-sm", "shadow-brand-primary")).toBe("shadow-brand-primary")
        expect(cn("shadow-sm", "shadow-elevation-2")).toBe("shadow-elevation-2")
        expect(cn("shadow-md", "shadow-glass-highlight-md")).toBe("shadow-glass-highlight-md")
    })

    it("no pisa la sombra base con un tinte en otra variante ni con colores que no son tokens de sombra", () => {
        expect(cn("shadow-glass-highlight-md hover:shadow-brand-secondary/15"))
            .toBe("shadow-glass-highlight-md hover:shadow-brand-secondary/15")
        expect(cn("shadow-lg shadow-brand-accent")).toBe("shadow-lg shadow-brand-accent")
    })
})
