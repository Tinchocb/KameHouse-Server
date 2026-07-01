import { Icons } from "@/components/ui/icons"

interface AnimeBentoSpecsProps {
  status: string | null | undefined
  studios: string[] | null | undefined
  demographics: string[] | null | undefined
  duration: string | null | undefined
}

export function AnimeBentoSpecs({ status, studios, demographics, duration }: AnimeBentoSpecsProps) {
  // Check if we have any valid data to show
  const hasData = status || (studios && studios.length > 0) || (demographics && demographics.length > 0) || duration

  if (!hasData) return null

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--blur-overlay-md)] border border-[var(--glass-border)] rounded-2xl p-5 hover:bg-[var(--glass-hover)] hover:border-[var(--glass-strong)] transition-all duration-300 cursor-pointer">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-secondary mb-4 px-1">
        Detalles Anime
      </h4>
      
      <div className="flex flex-col gap-4">
        {/* Status */}
        {status && (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 text-gray-400">
              <Icons.time.calendar className="w-4 h-4 text-white/50" />
              <span className="text-xs uppercase tracking-wider font-bold">Estado</span>
            </div>
            <span className="text-sm font-medium text-white tracking-wide">{status}</span>
          </div>
        )}

        {/* Studios */}
        {studios && studios.length > 0 && (
          <div className="flex items-start justify-between px-2">
            <div className="flex items-center gap-3 text-gray-400 mt-0.5">
              <Icons.status.building className="w-4 h-4 text-white/50" />
              <span className="text-xs uppercase tracking-wider font-bold">Estudio</span>
            </div>
            <span className="text-sm font-medium text-white tracking-wide text-right max-w-[150px] truncate-2-lines">
              {studios.join(", ")}
            </span>
          </div>
        )}

        {/* Demographics */}
        {demographics && demographics.length > 0 && (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 text-gray-400">
              <Icons.status.users2 className="w-4 h-4 text-white/50" />
              <span className="text-xs uppercase tracking-wider font-bold">Demografía</span>
            </div>
            <span className="text-sm font-medium text-white tracking-wide">{demographics.join(", ")}</span>
          </div>
        )}

        {/* Duration */}
        {duration && (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 text-gray-400">
              <Icons.time.clock className="w-4 h-4 text-white/50" />
              <span className="text-xs uppercase tracking-wider font-bold">Duración</span>
            </div>
            <span className="text-sm font-medium text-white tracking-wide">{duration}</span>
          </div>
        )}
      </div>
    </div>
  )
}
