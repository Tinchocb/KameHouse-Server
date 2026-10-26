import { describe, expect, it } from "vitest"
import type { MediaSourceInfo } from "@/api/generated/types"
import { describeMissingSources } from "./missing-sources"

/** Fuentes activas y preferencia automática: cada caso cambia solo lo que prueba. */
const info = (p: Partial<MediaSourceInfo>): MediaSourceInfo => ({
    mediaId: 1,
    preference: "auto",
    effective: "auto",
    localFiles: 0,
    cloudFiles: 0,
    localEnabled: true,
    cloudEnabled: true,
    ...p,
})

describe("describeMissingSources", () => {
    it("sin información de fuentes: no hay archivos locales, con el alcance por defecto", () => {
        const r = describeMissingSources(undefined)
        expect(r.kind).toBe("local")
        expect(r.title).toBe("No hay episodios detectados")
        expect(r.message).toContain("esta serie")
    })

    it("el alcance se puede cambiar (p. ej. una película)", () => {
        expect(describeMissingSources(undefined, "esta película").message).toContain("esta película")
    })

    it("archivos locales con 'Usar el disco local' apagado: local-off, con el texto aprobado", () => {
        const r = describeMissingSources(info({ localFiles: 3, localEnabled: false }))
        expect(r.kind).toBe("local-off")
        expect(r.message).toBe('Tus archivos locales están, pero "Usar el disco local" está apagado en Ajustes.')
    })

    it("archivos en la nube con la fuente apagada: cloud-off", () => {
        const r = describeMissingSources(info({ cloudFiles: 2, cloudEnabled: false }))
        expect(r.kind).toBe("cloud-off")
        expect(r.title).toBe("La fuente en la nube está apagada")
    })

    it("nube activada y sin archivos sincronizados: cloud-unsynced", () => {
        const r = describeMissingSources(info({}))
        expect(r.kind).toBe("cloud-unsynced")
        expect(r.message).toContain("Sincroniza Drive")
    })

    it("serie fijada a Local, sin locales y con archivos en la nube: pref-local-empty, con el texto aprobado", () => {
        const r = describeMissingSources(info({ preference: "local", cloudFiles: 4 }))
        expect(r.kind).toBe("pref-local-empty")
        expect(r.message).toBe("Esta serie está fijada a Local y no tiene archivos locales. Cámbiala a Automático o Nube.")
        expect(r.title).toBe("Origen fijado a Local")
    })

    it("la preferencia Local no cuenta si el disco local está apagado: el origen efectivo es Automático", () => {
        const r = describeMissingSources(info({ preference: "local", localEnabled: false, cloudFiles: 4 }))
        expect(r.kind).toBe("scope")
    })

    it("automático con archivos en la nube que no son de este recorte: scope, con el texto aprobado", () => {
        const r = describeMissingSources(info({ cloudFiles: 4 }))
        expect(r.kind).toBe("scope")
        expect(r.message).toBe("Ninguno de tus archivos corresponde a esta serie.")
    })

    it("con archivos locales y ninguno de la saga elegida: scope, nombrando la saga", () => {
        const r = describeMissingSources(info({ localFiles: 3, cloudEnabled: false }), "esta saga")
        expect(r.kind).toBe("scope")
        expect(r.message).toBe("Ninguno de tus archivos corresponde a esta saga.")
    })

    it("nube activada con archivos y ningún local, en automático: scope (ya no 'no hay archivos locales')", () => {
        const r = describeMissingSources(info({ cloudFiles: 4 }))
        expect(r.kind).toBe("scope")
    })

    it("serie fijada a Local con Drive apagado: pref-local-empty primero, sin pedir activar Drive", () => {
        const r = describeMissingSources(info({ preference: "local", cloudEnabled: false, cloudFiles: 3 }))
        expect(r.kind).toBe("pref-local-empty")
    })

    it("serie fijada a Nube con el disco apagado: primero el disco, porque sin él la preferencia no lo oculta", () => {
        const r = describeMissingSources(info({ preference: "cloud", localEnabled: false, localFiles: 2 }))
        expect(r.kind).toBe("local-off")
    })

    it("disco apagado y preferencia Local sin archivos de nube: Nube sin sincronizar, no 'no hay archivos locales'", () => {
        const r = describeMissingSources(info({ preference: "local", localEnabled: false, cloudEnabled: true, cloudFiles: 0 }))
        expect(r.kind).toBe("cloud-unsynced")
    })

    it("disco apagado y sin archivos en ninguna fuente: no recomienda escanear", () => {
        const r = describeMissingSources(info({ localEnabled: false, cloudEnabled: false }))
        expect(r.kind).toBe("local-off")
        expect(r.message).toBe('No hay archivos locales de esta serie porque "Usar el disco local" está apagado en Ajustes.')
        expect(r.message).not.toContain("escanear")
    })

    it("en películas el texto dice 'esta película' y no menciona sagas", () => {
        const r = describeMissingSources(info({ localFiles: 2 }), "esta película")
        expect(r.message).toBe("Ninguno de tus archivos corresponde a esta película.")
        expect(r.message).not.toContain("saga")
    })

    it("serie fijada a Nube, sin archivos en la nube y con locales: pref-cloud-empty, con el texto y el título finales", () => {
        const r = describeMissingSources(info({ preference: "cloud", localFiles: 2 }))
        expect(r.kind).toBe("pref-cloud-empty")
        expect(r.message).toBe("Esta serie está fijada a Nube y no tiene archivos en la nube. Cámbiala a Automático o Local.")
        expect(r.title).toBe("Origen fijado a Nube")
    })

    it("las preferencias de serie no se muestran en películas: el selector solo está en Series", () => {
        const r = describeMissingSources(info({ preference: "local", cloudFiles: 4 }), "esta película")
        expect(r.kind).toBe("scope")
    })

    it("serie fijada a Local sin ningún archivo: no sugiere sincronizar la nube", () => {
        const r = describeMissingSources(info({ preference: "local" }))
        expect(r.kind).toBe("local")
    })
})
