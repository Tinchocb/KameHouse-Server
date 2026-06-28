import { Volume2, MessageSquareText } from "lucide-react"

interface MovieAudioSubsProps {
  audioTracks: string[]
  subtitles: string[]
}

export function MovieAudioSubs({ audioTracks, subtitles }: MovieAudioSubsProps) {
  if (!audioTracks.length && !subtitles.length) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
      {/* Audio Tracks */}
      {audioTracks.length > 0 && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--blur-card)] border border-[var(--glass-border)] rounded-2xl p-6 hover:bg-[var(--glass-hover)] hover:border-[var(--glass-strong)] transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-3 mb-4 text-zinc-400">
            <Volume2 className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Audios Incluidos</span>
          </div>
          <div className="flex flex-col gap-2">
            {audioTracks.map((track, idx) => (
              <span key={idx} className="text-sm font-medium text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
                {track}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Subtitles */}
      {subtitles.length > 0 && (
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--blur-card)] border border-[var(--glass-border)] rounded-2xl p-6 hover:bg-[var(--glass-hover)] hover:border-[var(--glass-strong)] transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-3 mb-4 text-zinc-400">
            <MessageSquareText className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subtítulos</span>
          </div>
          <div className="flex flex-col gap-2">
            {subtitles.map((sub, idx) => (
              <span key={idx} className="text-sm font-medium text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
