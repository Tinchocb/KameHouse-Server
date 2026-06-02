import type { MovieChronology } from "@/api/types/movie.types"

interface ChronologyWidgetProps {
  chronology: MovieChronology | null
}

export function ChronologyWidget({ chronology }: ChronologyWidgetProps) {
  if (!chronology || !chronology.startEpisodeContext) return null

  return (
    <div className="bg-zinc-950/30 backdrop-blur border border-white/5 rounded-2xl p-6 mt-8">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6">
        Ubicación Cronológica
      </h4>
      
      <div className="relative flex items-center justify-between w-full max-w-2xl mx-auto px-4">
        {/* Background Line */}
        <div className="absolute left-0 right-0 h-1 bg-white/10 top-1/2 -translate-y-1/2 rounded-full z-0" />
        
        {/* Active Orange Line segment */}
        <div className="absolute left-1/4 right-1/4 h-1 bg-gradient-to-r from-amber-500/20 via-amber-500 to-amber-500/20 top-1/2 -translate-y-1/2 rounded-full z-0 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />

        {/* Start Episode Node */}
        <div className="relative z-10 flex flex-col items-center gap-2 -ml-4">
          <div className="w-4 h-4 rounded-full bg-zinc-800 border-2 border-white/20" />
          <span className="text-xs font-bold text-gray-400">Ep {chronology.startEpisodeContext}</span>
        </div>

        {/* Current Movie Node */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-500 border-4 border-[#050506] shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
          <span className="text-[10px] uppercase font-black tracking-widest text-amber-500">
            Esta Película
          </span>
        </div>

        {/* End Episode Node */}
        <div className="relative z-10 flex flex-col items-center gap-2 -mr-4">
          <div className="w-4 h-4 rounded-full bg-zinc-800 border-2 border-white/20" />
          <span className="text-xs font-bold text-gray-400">Ep {chronology.endEpisodeContext}</span>
        </div>
      </div>

      {/* Chronology Notes */}
      {chronology.chronologyNotes && (
        <p className="text-center text-sm text-gray-400 mt-6 max-w-lg mx-auto">
          {chronology.chronologyNotes}
        </p>
      )}
    </div>
  )
}
