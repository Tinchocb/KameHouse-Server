import { m } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronRight } from "@/components/ui/icons"
import { useSpringPreset, useMotionTier } from "@/components/ui/kinetics"

interface SubSagaTimelineItem {
  id: string
  title: string
  episodeRange?: string
  index?: number
}

interface SubSagaTimelineProps {
  items: SubSagaTimelineItem[]
  activeId?: string
  timelineId?: string
  onSelect: (id: string) => void
  className?: string
}

/**
 * Lista vertical de sub-sagas / arcos argumentales.
 * Provee títulos legibles, rango de episodios, tracing beam y estado activo visible.
 */
export function SubSagaTimeline({ items, activeId, timelineId, onSelect, className }: SubSagaTimelineProps) {
  const motionTier = useMotionTier()
  const tabContentSpring = useSpringPreset("tabContent")
  const activeIndex = items.findIndex(item => item.id === activeId)
  const showTracingRail = motionTier === "full" && activeIndex >= 0
  const layoutScope = timelineId ?? (items[0]?.id ? items[0].id.split("-")[0] : "default")

  if (items.length === 0) return null

  return (
    <div className={cn("sectionbar p-4 space-y-2 relative overflow-hidden", className)}>
      {/* Tracing Rail connecting the items */}
      <div
        aria-hidden="true"
        className="absolute left-[40px] -translate-x-1/2 top-6 bottom-6 w-0.5 bg-white/[0.06] rounded-full pointer-events-none"
      >
        {showTracingRail && (
          <m.div
            className="w-full bg-gradient-to-b from-brand-accent/80 via-brand-accent to-brand-accent/30 rounded-full shadow-[0_0_10px_hsl(var(--brand-accent))]"
            initial={{ height: 0 }}
            animate={{
              height: `${Math.min(100, Math.max(10, ((activeIndex + 0.5) / items.length) * 100))}%`
            }}
            transition={tabContentSpring}
          />
        )}
      </div>

      {items.map((item, index) => {
        const isActive = item.id === activeId
        const orderNum = item.index ?? (index + 1)
        const orderFormatted = orderNum < 10 ? `0${orderNum}` : `${orderNum}`

        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(item.id)
            }}
            aria-label={item.title}
            aria-current={isActive ? "true" : undefined}
            title={item.title}
            className={cn(
              "group relative w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left cursor-pointer select-none transition-[background-color,border-color,transform] duration-200 hover:translate-x-[2px] active:scale-[0.98] z-10",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
              isActive
                ? "bg-white/[0.08] border border-white/30 border-t-white/50 border-l-[3px] border-l-brand-accent shadow-[shadow:var(--glass-highlight-md),0_0_14px_rgba(0,0,0,0.5)] text-white"
                : "bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 text-on-surface-variant hover:text-white"
            )}
          >
            {isActive && (
              motionTier === "off" ? (
                <div className="absolute inset-0 rounded-xl bg-brand-accent/[0.06] border border-brand-accent/30 pointer-events-none -z-10" />
              ) : (
                <m.div
                  layoutId={`activeSubSagaPill-${layoutScope}`}
                  transition={tabContentSpring}
                  className="absolute inset-0 rounded-xl bg-brand-accent/[0.06] border border-brand-accent/30 pointer-events-none -z-10"
                />
              )
            )}

            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className={cn(
                "text-xs font-mono font-bold shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors relative z-10",
                isActive
                  ? "bg-brand-accent/25 text-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent)/0.4)]"
                  : "bg-zinc-900 text-on-surface-variant/70 group-hover:text-on-surface-variant group-hover:bg-zinc-800"
              )}>
                {orderFormatted}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm font-semibold truncate leading-tight transition-colors",
                  isActive ? "text-white" : "text-on-surface-variant group-hover:text-white"
                )}>
                  {item.title}
                </p>
                {item.episodeRange && (
                  <span className="text-2xs font-medium text-on-surface-variant/60 group-hover:text-on-surface-variant mt-0.5 block">
                    {item.episodeRange}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              {isActive ? (
                <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]" />
              ) : (
                <IconNavigationChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 group-hover:text-on-surface-variant transition-colors" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}