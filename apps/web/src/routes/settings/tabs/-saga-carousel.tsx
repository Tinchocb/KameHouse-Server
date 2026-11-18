import React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons"
import { ERAS, eraIdFromThemeEra } from "@/lib/config/eras"
import type { EraPreset } from "@/lib/theme/themes-registry"

/** Desplazamiento horizontal (px) a partir del cual un gesto cambia de saga. */
export const SWIPE_MIN_PX = 40

/** Qué hace un gesto horizontal: -1 saga anterior, 1 siguiente, 0 si fue demasiado corto. */
export function swipeStep(dx: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX) return 0
  return dx < 0 ? 1 : -1
}

/** Índice al que lleva una tecla de navegación, o null si la tecla no navega. Da la vuelta en los extremos. */
export function keyTargetIndex(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight") return (index + 1) % count
  if (key === "ArrowLeft") return (index - 1 + count) % count
  if (key === "Home") return 0
  if (key === "End") return count - 1
  return null
}

/** Kanji de la saga: el de su era en ERAS, o 龍 para Universo DB, que no tiene era propia. */
export function sagaKanji(themeEra: string): string {
  if (themeEra === "era-black") return "黒"
  const id = eraIdFromThemeEra(themeEra)
  return ERAS.find((e) => e.id === id)?.kanji ?? "龍"
}

const NAV_BUTTON = [
  "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/15",
  "text-white bg-white/5 transition-[color,background-color,transform,border-color] duration-fast ease-smooth-out cursor-pointer outline-none",
  "[@media(hover:hover)_and_(pointer:fine)]:hover:text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/15 [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/30 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 motion-safe:active:scale-90",
  "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
].join(" ")

interface SagaCarouselProps {
  presets: readonly EraPreset[]
  activeId: string
  /** Aplica la saga (la misma acción que tocar una saga en la grilla anterior). */
  onSelect: (preset: EraPreset) => void
}

/**
 * Selector de sagas en carrusel: una saga grande por vez, con su fondo, su dupla, su kanji y su
 * descripción. Flechas en pantalla, ← → Inicio Fin en el teclado (también el control de la TV),
 * deslizar en táctil y los puntos para ir directo. Navegar aplica la saga al instante; «Guardar»
 * la persiste, como antes.
 */
export function SagaCarousel({ presets, activeId, onSelect }: SagaCarouselProps) {
  const count = presets.length
  const index = Math.max(0, presets.findIndex((p) => p.id === activeId))
  const preset = presets[index]
  const swipeStart = React.useRef<{ x: number; pointerId: number } | null>(null)

  const [direction, setDirection] = React.useState<"left" | "right" | null>(null)

  const go = (target: number, forward = target > index) => {
    const wrapped = (target + count) % count
    if (wrapped === index) return
    setDirection(forward ? "right" : "left")
    onSelect(presets[wrapped])
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = keyTargetIndex(e.key, index, count)
    if (target === null) return
    e.preventDefault()
    go(target, e.key === "ArrowRight" || (e.key !== "ArrowLeft" && target > index))
  }

  // Solo táctil y lápiz: el arrastre con el ratón es para seleccionar texto, no para cambiar de saga.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return
    swipeStart.current = { x: e.clientX, pointerId: e.pointerId }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || start.pointerId !== e.pointerId) return
    const step = swipeStep(e.clientX - start.x)
    if (step !== 0) go(index + step)
  }

  return (
    <section
      role="group"
      aria-roledescription="carrusel"
      aria-label="Sagas"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { swipeStart.current = null }}
      className="space-y-3"
    >
      <div className="flex items-stretch gap-2 sm:gap-3">
        <button type="button" onClick={() => go(index - 1)} aria-label="Saga anterior" className={NAV_BUTTON}>
          <IconNavigationChevronLeft className="w-4 h-4 text-white" />
        </button>

        {/* data-theme: la tarjeta toma la paleta real de su saga (fondo, acento, secundario, kanji)
            por las variables de themes/era.css, sin cambiar la app. */}
        <div
          key={preset.id}
          data-theme={preset.themeEra}
          className="relative flex-1 min-w-0 min-h-[11.5rem] overflow-hidden rounded-2xl border border-white/15 border-t-white/30 p-4 sm:p-6 animate-in fade-in duration-base motion-reduce:animate-none shadow-xl group transition-[transform,border-color,box-shadow] duration-fast ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.008] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/30 transform-gpu"
          style={{
            touchAction: "pan-y",
            borderColor: "color-mix(in srgb, var(--brand-accent-hex) 40%, transparent)",
            background:
              "radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--brand-accent-hex) 30%, transparent), transparent 62%)," +
              "radial-gradient(100% 80% at 0% 100%, color-mix(in srgb, var(--brand-secondary-hex) 24%, transparent), transparent 62%)," +
              "var(--bg-secondary)",
          }}
        >
          {/* Specular Top Sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -top-6 select-none font-kanji font-black text-[9rem] sm:text-[11rem] leading-none transition-[opacity,transform] duration-500 group-hover:opacity-30 motion-safe:group-hover:scale-105"
            style={{ color: "var(--brand-accent-hex)", opacity: 0.2 }}
          >
            {sagaKanji(preset.themeEra)}
          </span>

          <div className={cn(
            "relative flex flex-col gap-2.5 sm:gap-3 max-w-[70%]",
            direction && "motion-safe:animate-in duration-base ease-smooth-out",
            direction === "right" && "motion-safe:slide-in-from-right-3",
            direction === "left" && "motion-safe:slide-in-from-left-3"
          )}>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 self-start shadow-sm">
              {preset.subtitle}
            </span>
            <h3 className="font-display text-lg sm:text-xl font-black leading-tight" style={{ color: "var(--md-sys-color-on-surface)" }}>
              {preset.name}
            </h3>
            <p className="text-xs sm:text-sm leading-snug" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
              {preset.desc}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
                <span aria-hidden="true" className="size-3.5 rounded-full border border-white/20" style={{ background: "var(--brand-accent-hex)" }} />
                Acento
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
                <span aria-hidden="true" className="size-3.5 rounded-full border border-white/20" style={{ background: "var(--brand-secondary-hex)" }} />
                Secundario
              </span>
              <span
                aria-hidden="true"
                className="ml-auto rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: "var(--brand-accent-hex)", color: "var(--md-sys-color-on-primary)" }}
              >
                Botón
              </span>
            </div>
          </div>
        </div>

        <button type="button" onClick={() => go(index + 1)} aria-label="Saga siguiente" className={NAV_BUTTON}>
          <IconNavigationChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p aria-live="polite" className="text-xs font-mono tabular-nums text-on-surface-variant">
          <span key={preset.id} className="inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-fast">{preset.name} · {index + 1} de {count}</span>
        </p>
        <div className="flex items-center gap-0.5">
          {presets.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a ${p.name}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full outline-none cursor-pointer",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full transition-[width,background-color,box-shadow,transform] duration-fast ease-smooth-out",
                  i === index ? "h-1.5 w-4 bg-brand-accent shadow-[0_0_8px_var(--brand-accent-hex)]" : "size-1.5 bg-[var(--neutral-separator)] motion-safe:hover:scale-125"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
