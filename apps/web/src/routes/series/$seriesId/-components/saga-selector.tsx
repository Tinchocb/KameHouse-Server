import type { SagaDTO } from "@/api/types/series.types"

interface SagaSelectorProps {
  sagas: SagaDTO[]
  activeSagaId: string
  onSelectSaga: (sagaId: string) => void
}

export function SagaSelector({ sagas, activeSagaId, onSelectSaga }: SagaSelectorProps) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-2 p-4 border-r border-white/5">
      <h3 className="text-xl font-bold text-white mb-4 px-2">Sagas</h3>
      
      {sagas.map((saga) => {
        const isActive = saga.id === activeSagaId
        
        return (
          <button
            key={saga.id}
            onClick={() => onSelectSaga(saga.id)}
            className={`
              relative flex flex-col text-left p-4 rounded-lg transition-all duration-300
              ${isActive ? "bg-white/10" : "hover:bg-white/5"}
              ${saga.isFiller && !isActive ? "opacity-50 hover:opacity-80" : "opacity-100"}
            `}
          >
            {/* Active Indicator */}
            {isActive && (
              <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-amber-500 rounded-r-md shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            )}
            
            <div className="flex justify-between items-start mb-1">
              <span className={`font-bold text-lg line-clamp-1 ${isActive ? "text-white" : "text-gray-300"}`}>
                {saga.name}
              </span>
              {saga.isFiller && (
                <span className="text-[10px] font-mono uppercase bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded ml-2 mt-1 whitespace-nowrap">
                  Filler
                </span>
              )}
            </div>
            
            <span className="text-sm font-medium text-amber-500/80 mb-2">
              Eps {saga.episodeRange}
            </span>
            
            {/* SubSagas */}
            {isActive && saga.subSagas && saga.subSagas.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-l border-white/10 pl-3 ml-2">
                {saga.subSagas.map(sub => (
                  <button
                    key={sub.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      const el = document.getElementById(`episode-${sub.startEp}`)
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className="text-left text-xs font-medium text-gray-400 hover:text-amber-400 transition-colors py-1 group/subsaga"
                  >
                    <span className="block text-gray-300 group-hover/subsaga:text-amber-400 transition-colors">{sub.name}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-70">Eps {sub.episodeRange}</span>
                  </button>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
