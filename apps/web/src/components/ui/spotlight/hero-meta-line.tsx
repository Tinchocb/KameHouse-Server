import * as React from "react"
import { m, type Variants } from "framer-motion"

/** Metadatos del hero en micro-badges refinados translúcidos (Inicio y Películas). */
export function HeroMetaLine({ items, variants }: { items: React.ReactNode[]; variants?: Variants }) {
    return (
        <m.div
            variants={variants}
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-white/90 tabular-nums"
        >
            {items.map((item, i) => (
                <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/10 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                >
                    {item}
                </span>
            ))}
        </m.div>
    )
}
