import type { MovieAdvancedMetadata } from "@/api/types/movie.types"
import { HardDrive, MonitorPlay, FileVideo, Activity } from "lucide-react"

interface MovieBentoSpecsProps {
  technical: MovieAdvancedMetadata | null
}

export function MovieBentoSpecs({ technical }: MovieBentoSpecsProps) {
  if (!technical) return null

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--blur-card)] border border-[var(--glass-border)] rounded-2xl p-5 hover:bg-[var(--glass-hover)] hover:border-[var(--glass-strong)] transition-all duration-300 cursor-pointer mt-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-secondary)] mb-4 px-1">
        Ficha Técnica
      </h4>
      
      <div className="flex flex-col gap-4">
        {/* File Size */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-gray-400">
            <HardDrive className="w-4 h-4 text-white/50" />
            <span className="text-xs uppercase tracking-wider font-bold">Tamaño</span>
          </div>
          <span className="text-sm font-mono text-white tracking-wide">{technical.fileSize}</span>
        </div>

        {/* Resolution */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-gray-400">
            <MonitorPlay className="w-4 h-4 text-white/50" />
            <span className="text-xs uppercase tracking-wider font-bold">Resolución</span>
          </div>
          <span className="text-sm font-mono text-amber-500 tracking-wide">{technical.resolutionTag}</span>
        </div>

        {/* Codec */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-gray-400">
            <FileVideo className="w-4 h-4 text-white/50" />
            <span className="text-xs uppercase tracking-wider font-bold">Códec</span>
          </div>
          <span className="text-sm font-mono text-white tracking-wide">{technical.videoCodec}</span>
        </div>

        {/* Bitrate */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-gray-400">
            <Activity className="w-4 h-4 text-white/50" />
            <span className="text-xs uppercase tracking-wider font-bold">Bitrate</span>
          </div>
          <span className="text-sm font-mono text-white tracking-wide">{technical.bitrate}</span>
        </div>
      </div>
    </div>
  )
}
