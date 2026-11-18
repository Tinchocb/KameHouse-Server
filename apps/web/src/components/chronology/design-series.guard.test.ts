import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guard de la zona Series (Cronología, Portadas, Episodios y personajes): lee el código fuente de
// los archivos corregidos y comprueba que las violaciones de DESIGN-GUIDE §2 y §9 no vuelvan.
// Rutas relativas a este archivo (apps/web/src/components/chronology).
const leer = (ruta: string) => readFileSync(join(__dirname, ruta), "utf8")

// Primera línea del archivo que contiene el texto. Cada className de estos archivos va en una sola línea.
const linea = (source: string, texto: string) => source.split("\n").find(l => l.includes(texto)) ?? ""

const INTERLUDE = leer("InterludeDivider.tsx")
const VOLUME_CARD = leer("TimelineVolumeCard.tsx")
const CONTRALATERAL = leer("ContralateralDetailsCard.tsx")
const EPISODE_LIST = leer("../../routes/series/$seriesId/-components/premium-episode-list.tsx")
const SAGA_SELECTOR = leer("../../routes/series/$seriesId/-components/saga-selector.tsx")
const ARC_CARD = leer("../../routes/series/$seriesId/-components/arc-cinematic-card.tsx")
const AUDIO_PICKER = leer("../../routes/series/$seriesId/-components/series-audio-profile-picker.tsx")
const CHARACTER_MODAL = leer("../shared/character-detail-modal.tsx")

const TOCADOS = {
    "InterludeDivider.tsx": INTERLUDE,
    "TimelineVolumeCard.tsx": VOLUME_CARD,
    "ContralateralDetailsCard.tsx": CONTRALATERAL,
    "premium-episode-list.tsx": EPISODE_LIST,
    "saga-selector.tsx": SAGA_SELECTOR,
    "arc-cinematic-card.tsx": ARC_CARD,
    "character-detail-modal.tsx": CHARACTER_MODAL,
}

describe("zona Series: sombras con tokens (§2, §9)", () => {
    it("ningún archivo tocado deja una sombra arbitraria con rgba literal (drop-shadow no cuenta)", () => {
        for (const [nombre, source] of Object.entries(TOCADOS)) {
            const lineas = source.split("\n").filter(l => /(?<![\w-])shadow-\[[^\]]*rgba\(/.test(l))
            expect(lineas, nombre).toEqual([])
        }
    })

    it("la fila de episodio resaltada y la de reposo usan tokens de elevación y brillo", () => {
        const resaltada = linea(EPISODE_LIST, "border-brand-accent/50 shadow-[shadow:")
        expect(resaltada).toContain("var(--elevation-3)")
        expect(resaltada).toContain("var(--glass-highlight-sm)")
        const reposo = linea(EPISODE_LIST, "hover:bg-[color-mix(in_srgb,var(--surface-content)_85%,transparent)]")
        expect(reposo).toContain("var(--elevation-2)")
    })

    it("la tarjeta en foco toma su sombra de --sectionbar-shadow y el halo de era va con color-mix", () => {
        // La clase de vidrio y la sombra van en líneas distintas del cn(): se buscan por separado.
        expect(VOLUME_CARD).toMatch(/isHighlighted[\s\S]*?\? 'sectionbar border-/)
        expect(VOLUME_CARD).toContain("surface-content surface-content-row")
        expect(VOLUME_CARD).not.toContain('intent="glass"')
        expect(VOLUME_CARD).not.toContain("backdrop-blur")
        const sombra = linea(VOLUME_CARD, "shadow-[shadow:var(--sectionbar-shadow)")
        expect(sombra).toContain("color-mix(in_srgb,rgb(var(--era))_25%,transparent)")
    })

    it("el botón Lore activo lleva el halo de era con color-mix, no rgba", () => {
        const lore = linea(VOLUME_CARD, "shadow-[0_0_12px_color-mix(")
        expect(lore).toContain("rgb(var(--era))_30%")
    })

    it("la sinopsis de saga y el indicador de arco no repiten sombras inline", () => {
        expect(linea(SAGA_SELECTOR, "sectionbar w-full max-h")).not.toContain("shadow-[")
        expect(linea(ARC_CARD, "border-white/[0.08]")).toContain("shadow-glass-highlight-sm")
        expect(linea(ARC_CARD, "absolute -inset-px -z-10")).toContain("var(--elevation-3)")
    })

    it("el diálogo de personaje usa la sombra de .glass-frosted y el halo del avatar sale de color-mix", () => {
        expect(linea(CHARACTER_MODAL, "glass-frosted relative w-full max-w-3xl")).not.toContain("shadow-[")
        expect(linea(CHARACTER_MODAL, "border-2 border-white/30")).toContain("color-mix(in_srgb,var(--on-surface)_15%,transparent)")
    })
})

describe("zona Series: sin blur repetido por fila o badge (§2, §9)", () => {
    it("la pastilla de interludio no usa .sectionbar y queda sin backdrop-filter", () => {
        const pastilla = linea(INTERLUDE, "group/interlude")
        expect(pastilla).not.toContain("sectionbar")
        expect(pastilla).not.toContain("backdrop")
        expect(pastilla).toContain("bg-surface-container-lowest")
    })

    it("la fila compacta de lapso no usa .sectionbar y queda sin backdrop-filter", () => {
        const compacta = linea(VOLUME_CARD, "items-stretch overflow-hidden rounded-xl")
        expect(compacta).not.toContain("sectionbar")
        expect(compacta).not.toContain("backdrop")
        // La fila usa el fondo de superficie de contenido desde 8ea2329; el guardián sigue vigilando que no tenga blur.
        expect(compacta).toContain("bg-[var(--surface-content)]")
    })

    it("el acordeón móvil usa una superficie sin blur para la contralateral dentro de la tarjeta en foco", () => {
        expect(VOLUME_CARD).toMatch(/<ContralateralDetailsCard[\s\S]*?\bembedded\b[\s\S]*?\/>/)
        const superficie = linea(CONTRALATERAL, "rounded-2xl border border-[var(--neutral-separator)]")
        expect(superficie).toContain("bg-[var(--neutral-elev-1)]")
        expect(superficie).not.toContain("backdrop")
    })

    it("el scrim del personaje no lleva blur encima del diálogo glass", () => {
        expect(linea(CHARACTER_MODAL, "bg-black/65")).not.toContain("backdrop-blur")
    })
})

describe("zona Series: controles canónicos (§5.3, §9)", () => {
    it("el selector de audio usa SegmentedControl; la lista conserva su búsqueda", () => {
        expect(AUDIO_PICKER).toContain("<SegmentedControl")
        expect(AUDIO_PICKER).toContain('semantics="radiogroup"')
        expect(AUDIO_PICKER).toContain('surface="inset"')
        expect(EPISODE_LIST).toContain('aria-label="Buscar episodio"')
        expect(EPISODE_LIST).not.toContain("activeEpisodeFilterCapsule")
        expect(EPISODE_LIST).not.toContain("glass-frosted-pill flex p-1")
    })

    it("los tabs de Conflicto / Clímax / Lore son un SegmentedControl en tablist", () => {
        expect(CONTRALATERAL).toContain("<SegmentedControl")
        expect(CONTRALATERAL).toContain('semantics="tablist"')
        expect(CONTRALATERAL).not.toContain('role="tablist"')
        expect(CONTRALATERAL).not.toContain("MagneticIndicator")
    })
})
