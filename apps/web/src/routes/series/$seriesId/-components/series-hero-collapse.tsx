import * as React from "react"
import { useMinWidth, useNavCompact } from "@/components/ui/app-layout/use-nav-compact"
import { IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { IconMediaPlay } from "@/components/ui/icons"

/** Umbral mínimo de scroll (px) y fracción de la altura del hero a partir de la cual aparece la píldora. */
const MIN_SCROLL_TRIGGER = 220
const HERO_TRIGGER_RATIO = 0.6
const HYSTERESIS_PX = 24

interface SeriesHeroCollapseProps {
  /** Scroller del detalle: la aparición de la píldora sigue su scrollTop. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>
  /** Hero a pantalla completa (MediaHero) en flujo normal. */
  children: React.ReactNode
  /** Número de episodio mostrado en la insignia izquierda de la píldora. */
  episodeNumber?: number
  /** Título del episodio o, si no hay, el de la serie. */
  title: string
  /** Contexto corto bajo el título, p. ej. "Episodio 20 · 15 min restantes". */
  subtitle: string
  /** Avance del episodio en curso (0–100), si hay progreso. */
  resumePercent?: number
  /** Nombre accesible del botón de reproducir. */
  playLabel: string
  onPlay?: () => void
  onPlayHover?: () => void
}

/**
 * Envuelve el hero de la ficha de serie en flujo natural y, cuando el usuario scrollea
 * más allá del hero, muestra una píldora flotante compacta arriba a la izquierda
 * (junto al logo de KameHouse en escritorio, y bajo la barra superior en móvil)
 * con el episodio en curso, su progreso y acceso rápido a reproducir.
 */
export function SeriesHeroCollapse({
  scrollContainerRef,
  children,
  episodeNumber,
  title,
  subtitle,
  resumePercent,
  playLabel,
  onPlay,
  onPlayHover,
}: SeriesHeroCollapseProps) {
  const heroRef = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)

  // Sigue el estado compacto de la isla del logo para no solaparse cuando muestra "KAMEHOUSE".
  // En resoluciones de 1024px a 1440px la píldora se ancla al logo compacto (left-[5.75rem])
  // y restringe su ancho dinámicamente para dejar siempre >=20px de margen de seguridad
  // respecto a la isla central de navegación (FloatingPillNav).
  const { compact } = useNavCompact()
  const isWide = useMinWidth(1440)
  const showBrandText = isWide && !compact

  React.useEffect(() => {
    const scroller = scrollContainerRef?.current
    if (!scroller) return

    let raf = 0
    let cachedHeroHeight = heroRef.current?.offsetHeight ?? 520

    const update = () => {
      raf = 0
      const trigger = Math.max(MIN_SCROLL_TRIGGER, cachedHeroHeight * HERO_TRIGGER_RATIO)
      const s = scroller.scrollTop

      setVisible((prev) => {
        if (!prev && s >= trigger) return true
        if (prev && s < trigger - HYSTERESIS_PX) return false
        return prev
      })
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const heroEl = heroRef.current
    const ro = heroEl
      ? new ResizeObserver(() => {
          cachedHeroHeight = heroEl.offsetHeight || 520
          onScroll()
        })
      : null
    if (heroEl && ro) ro.observe(heroEl)

    scroller.addEventListener("scroll", onScroll, { passive: true })
    raf = requestAnimationFrame(update)
    return () => {
      ro?.disconnect()
      scroller.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollContainerRef])

  return (
    <>
      <div ref={heroRef}>{children}</div>

      <div
        role="region"
        aria-label={`Acceso rápido: ${title}`}
        aria-hidden={!visible}
        inert={!visible}
        className={cn(
          "fixed z-navbar pointer-events-none top-3.5",
          showBrandText
            ? "left-[12.25rem] max-w-[min(360px,calc(50vw-31rem))]"
            : "left-[5.75rem] max-w-[min(360px,calc(50vw-22.5rem))] xl:max-w-[min(360px,calc(50vw-24.5rem))]",
          "transform-gpu transition-[opacity,transform,left] duration-quick ease-out-strong",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-2 scale-95 opacity-0",
          "motion-reduce:translate-y-0 motion-reduce:scale-100",
        )}
      >
        <div
          className={cn(
            "series-collapse-pill glass-frosted-pill relative flex min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] items-center gap-2.5 overflow-hidden rounded-full py-1 pl-2 pr-1.5",
            visible ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          {episodeNumber != null && (
            <span
              aria-hidden="true"
              className="series-collapse-ep-badge flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-brand-accent/35 bg-brand-accent/20 px-1.5 font-mono text-xs font-bold tabular-nums text-brand-accent"
            >
              {episodeNumber}
            </span>
          )}

          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-xs font-semibold leading-tight text-on-surface">{title}</p>
            <p className="truncate text-xs leading-tight text-on-surface-variant tabular-nums">{subtitle}</p>
          </div>

          {onPlay && (
            <IconButton
              intent="primary"
              size="sm"
              aria-label={playLabel}
              title={playLabel}
              onClick={onPlay}
              onPointerEnter={onPlayHover}
              onFocus={onPlayHover}
              className="h-7 w-7 shrink-0"
              icon={<IconMediaPlay className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
            />
          )}

          {resumePercent != null && resumePercent > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/15"
            >
              <div
                className="series-collapse-progress-fill h-full bg-brand-accent"
                style={{ width: `${Math.min(100, resumePercent)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
