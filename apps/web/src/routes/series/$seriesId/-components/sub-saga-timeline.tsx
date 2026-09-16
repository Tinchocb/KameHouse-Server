import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronRight } from "@/components/ui/icons";
import { SettingsCard } from "@/routes/settings/components"

interface SubSagaTimelineItem {
  id: string
  title: string
  episodeRange?: string
  index?: number
}

interface SubSagaTimelineProps {
  items: SubSagaTimelineItem[]
  activeId?: string
  onSelect: (id: string) => void
  className?: string
}

/**
 * Lista vertical de sub-sagas / arcos argumentales.
 * Provee títulos legibles, rango de episodios y estado activo visible.
 */
export function SubSagaTimeline({ items, activeId, onSelect, className }: SubSagaTimelineProps) {
  if (items.length === 0) return null

  return (
    <SettingsCard className={cn("divide-y divide-white/[0.06]", className)} divide={false}>
      <div className="p-4 space-y-2">
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
                "group relative w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left cursor-pointer select-none transition-[background-color,border-color,transform] duration-200 hover:translate-x-[2px] active:scale-[0.98]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                isActive
                  ? "bg-white/[0.08] border border-white/30 border-t-white/50 border-l-[3px] border-l-brand-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_14px_rgba(0,0,0,0.5)] text-white"
                  : "bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={cn(
                  "text-xs font-mono font-bold shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                  isActive
                    ? "bg-brand-accent/20 text-brand-accent"
                    : "bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300"
                )}>
                  {orderFormatted}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold truncate leading-tight transition-colors",
                    isActive ? "text-white" : "text-zinc-200 group-hover:text-white"
                  )}>
                    {item.title}
                  </p>
                  {item.episodeRange && (
                    <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-400 mt-0.5 block">
                      {item.episodeRange}
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                {isActive ? (
                  <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]" />
                ) : (
                  <IconNavigationChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </SettingsCard>
  )
}