import type { SagaDTO } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"

interface SagaSelectorProps {
  sagas: SagaDTO[]
  activeSagaId: string
  onSelectSaga: (sagaId: string) => void
  activeSubSagaId?: string
  onSelectSubSaga?: (subSagaId: string) => void
}

export function SagaSelector({ 
  sagas, 
  activeSagaId, 
  onSelectSaga,
  activeSubSagaId,
  onSelectSubSaga
}: SagaSelectorProps) {
  return (
    <div className="w-full h-full flex flex-col p-6 liquid-glass-frosted rounded-2xl overflow-hidden">
      <h3 className="font-bebas text-2xl tracking-[0.15em] text-white/90 mb-6 px-1 uppercase flex items-center justify-between flex-shrink-0">
        <span>Sagas</span>
        <span className="text-[10px] font-mono font-bold tracking-normal text-zinc-500 lowercase px-2.5 py-0.5 bg-white/5 rounded-full">
          {sagas.length} arcos
        </span>
      </h3>
      
      <div className="flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar flex-1 min-h-0">
        {sagas.map((saga, index) => {
          const isActive = saga.id === activeSagaId
          
          return (
            <button
              key={saga.id}
              onClick={() => onSelectSaga(saga.id)}
              className={cn(
                "relative flex flex-col text-left p-4 rounded-xl transition-all duration-500 ease-out border select-none group/saga overflow-hidden",
                isActive 
                  ? "bg-gradient-to-r from-brand-orange/20 via-brand-orange/[0.04] to-transparent border-brand-orange/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(255,110,58,0.08)]" 
                  : "liquid-glass-frosted-subtle hover:bg-white/[0.04] hover:border-white/12",
                saga.isFiller && !isActive && "opacity-50 hover:opacity-90"
              )}
            >
              {/* Floating index background number */}
              <span className={cn(
                "absolute right-2 top-0 text-5xl font-black font-bebas opacity-5 select-none transition-colors duration-500 pointer-events-none",
                isActive ? "text-brand-orange opacity-15" : "text-white"
              )}>
                {String(index + 1).padStart(2, '0')}
              </span>

              {/* Active Indicator Left Bar */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-brand-orange shadow-[0_0_12px_rgba(255,110,58,0.8)]" />
              )}
              
              <div className="flex justify-between items-start mb-1.5 w-full z-10">
                <span className={cn(
                  "font-bold text-sm md:text-base leading-snug line-clamp-2 transition-colors duration-300 pr-8",
                  isActive 
                    ? "text-white" 
                    : "text-zinc-400 group-hover/saga:text-zinc-200"
                )}>
                  {saga.name}
                </span>
                {saga.isFiller && (
                  <span className="text-[7px] font-black tracking-widest uppercase bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 z-20">
                    Relleno
                  </span>
                )}
              </div>
              
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest transition-colors duration-300 z-10",
                isActive 
                  ? "text-brand-orange" 
                  : "text-zinc-500 group-hover/saga:text-brand-orange/80"
              )}>
                Eps {saga.episodeRange}
              </span>
              
              {/* SubSagas Timeline list */}
              {isActive && saga.subSagas && saga.subSagas.length > 0 && (
                <div className="mt-4 w-full flex flex-col gap-3.5 pl-6 relative z-10 border-t border-white/5 pt-4 animate-fade-in">
                  {/* Vertical connecting line */}
                  <div className="absolute left-2.5 top-5 bottom-3 w-[1.5px] bg-gradient-to-b from-brand-orange/40 via-brand-orange/15 to-transparent pointer-events-none" />
                  
                  {saga.subSagas.map(sub => {
                    const isSubActive = sub.id === activeSubSagaId
                    return (
                      <div
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onSelectSubSaga) {
                            onSelectSubSaga(isSubActive ? "" : sub.id)
                          }
                          const el = document.getElementById(`episode-${sub.startEp}`)
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                        }}
                        className="relative text-left flex items-start gap-3 py-0.5 group/subsaga cursor-pointer"
                      >
                        {/* Timeline circle node */}
                        <div className={cn(
                          "relative mt-1 flex items-center justify-center shrink-0 w-2 h-2 rounded-full border transition-all duration-300",
                          isSubActive 
                            ? "border-brand-orange bg-brand-orange shadow-[0_0_8px_rgba(255,110,58,0.7)]" 
                            : "border-white/30 bg-zinc-950 group-hover/subsaga:border-brand-orange group-hover/subsaga:scale-110"
                        )}>
                          <div className={cn(
                            "w-1 h-1 rounded-full transition-colors duration-300",
                            isSubActive 
                              ? "bg-white" 
                              : "bg-transparent group-hover/subsaga:bg-brand-orange"
                          )} />
                        </div>
                        
                        {/* Texts */}
                        <div className="space-y-0.5">
                          <span className={cn(
                            "block text-xs font-bold transition-colors duration-300 leading-normal",
                            isSubActive ? "text-white" : "text-zinc-400 group-hover/subsaga:text-white"
                          )}>
                            {sub.name}
                          </span>
                          <span className={cn(
                            "block text-[8px] font-black tracking-widest transition-colors duration-300",
                            isSubActive ? "text-brand-orange" : "text-zinc-600 group-hover/subsaga:text-brand-orange/80"
                          )}>
                            Eps {sub.episodeRange}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
