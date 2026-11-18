import { useEffect, useRef } from "react"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useTransparencyState } from "@/lib/theme/apply-custom-theme"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { mountLiquidRefraction } from "@/lib/theme/liquid-refraction"
import { useMediaQuery } from "@/hooks/use-media-query"

export function LiquidGlassDefs() {
  const defs = useRef<SVGDefsElement>(null)
  const { effectiveMode, themeEnableLiquidGlass } = useThemeSettings()
  const { flat } = useTransparencyState()
  const heavyEffects = usePerformanceStore(selectIsHeavyEffectsAllowed)
  const forcedColors = useMediaQuery("(forced-colors: active)")
  useEffect(() => {
    // URL backdrop filters render in Chromium/WebView2. Keep frosted on other engines.
    // Por era allocates adaptive lenses; Minimalista remains solid.
    const chromium = /Chrome|Chromium|Edg\//.test(navigator.userAgent)
    if (effectiveMode !== "era" || !themeEnableLiquidGlass || flat || !heavyEffects || forcedColors || !chromium || !defs.current) return
    const node = defs.current
    let cleanup: (() => void) | undefined
    const sync = () => {
      cleanup?.()
      cleanup = document.documentElement.dataset.tv === "true" ? undefined : mountLiquidRefraction(node)
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tv"] })
    sync()
    return () => { observer.disconnect(); cleanup?.() }
  }, [effectiveMode, themeEnableLiquidGlass, flat, heavyEffects, forcedColors])
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
      <defs ref={defs} />
    </svg>
  )
}
