import { useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { ERAS, eraIdFromThemeEra } from "@/lib/config/eras"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useTransparencyState } from "@/lib/theme/apply-custom-theme"
import { resolveFollowedTheme, selectScreenEra, useScreenEraStore } from "@/lib/theme/screen-era"
import { resolveDomThemeContract } from "@/lib/theme/themes-registry"

const watermarkGlyphs = ["龍", ...ERAS.map((era) => era.kanji)]

/** Resuelve el kanji canónico de la era activa (龍 para Universo DB). */
export function resolveWatermarkKanji(themeEra: string | undefined): string {
    const id = eraIdFromThemeEra(themeEra)
    return ERAS.find((era) => era.id === id)?.kanji ?? "龍"
}

/**
 * Marca de agua central de dos planos (Opción 5 — Doble Plano Arquitectónico).
 * Se portalea a `document.body` con `z-index: -2` (sobre `ChronologyBackdrop` `-3`
 * y debajo de la interfaz) en modo Por era con transparencias activas.
 */
export function EraKanjiWatermark() {
    const ts = useThemeSettings()
    const { flat: flatOn } = useTransparencyState()
    const screenEra = useScreenEraStore(selectScreenEra)

    const themeEra = resolveFollowedTheme(ts.effectiveMode, ts.themeEra, screenEra)
    const contract = resolveDomThemeContract(ts.effectiveMode, themeEra, ts.hasEraTheme)

    const visible = contract.mode === "era" && !flatOn && contract.theme !== "era-black"
    const surface = useRef<HTMLDivElement>(null)
    const previousScroll = useRef(0)
    useLayoutEffect(() => {
        const scroll = document.getElementById("main-content")?.scrollTop ?? window.scrollY
        if (surface.current) {
            surface.current.dataset.direction = scroll < previousScroll.current ? "up" : "down"
        }
        previousScroll.current = scroll
    }, [contract.theme, visible])

    if (!visible || typeof document === "undefined") return null

    const kanji = resolveWatermarkKanji(contract.theme)

    return createPortal(
        <div
            aria-hidden="true"
            ref={surface}
            data-era-kanji-watermark={contract.theme}
            className="era-kanji-watermark pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden select-none"
            style={{ zIndex: -2 }}
        >
            <svg
                className="era-kanji-watermark__svg"
                viewBox="0 0 200 200"
                aria-hidden="true"
            >
                {watermarkGlyphs.map((glyph) => (
                    <g key={glyph} className="era-kanji-watermark__stage" data-active={glyph === kanji}>
                        <text
                            x="100"
                            y="108"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform="translate(3.8 3.8)"
                            className="era-kanji-watermark__echo font-kanji"
                        >
                            {glyph}
                        </text>
                        <text
                            x="100"
                            y="108"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="era-kanji-watermark__glyph font-kanji"
                        >
                            {glyph}
                        </text>
                    </g>
                ))}
            </svg>
        </div>,
        document.body,
    )
}
