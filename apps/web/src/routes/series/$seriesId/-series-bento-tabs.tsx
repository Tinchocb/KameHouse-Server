import React from "react"
import { Models_LibraryMedia, Anime_LocalFile } from "@/api/generated/types"
import { MonitorPlay, Database } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { DeferredImage } from "@/components/shared/deferred-image"

// Helper to format file size beautifully
const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
}

// ─── RELATIONS TAB ─────────────────────────────────────────────────────────────

export const RelationsTab = React.memo(function RelationsTab({ media }: { media?: Models_LibraryMedia }) {
    const navigate = useNavigate()

    if (!media || !media.relations || media.relations.length === 0) {
        return (
            <div className="py-24 text-center">
                <p className="text-zinc-600 font-bebas text-4xl tracking-widest">SIN RELACIONES</p>
                <p className="text-zinc-700 text-xs font-black uppercase tracking-[0.3em] mt-2">NO HAY SECUELAS O PRECUELAS DETECTADAS</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {media.relations.map((relation, idx) => (
                <div 
                    key={idx} 
                    onClick={() => {
                        if (relation.media?.id) {
                            navigate({
                                to: "/series/$seriesId",
                                params: { seriesId: String(relation.media.id) }
                            })
                        }
                    }}
                    className="flex gap-4 p-4 bg-zinc-950/20 backdrop-blur-md border border-white/5 hover:border-brand-orange/30 hover:bg-zinc-900/40 rounded-xl hover:shadow-[0_0_25px_rgba(255,110,58,0.12)] transition-all duration-500 group cursor-pointer"
                >
                    <div className="w-16 h-24 shrink-0 bg-zinc-950 overflow-hidden relative rounded-lg border border-white/10 group-hover:border-brand-orange/30 transition-colors duration-500">
                        {(relation.media?.coverImage?.large || relation.media?.coverImage?.medium) && (
                            <DeferredImage
                                src={relation.media.coverImage?.large || relation.media.coverImage?.medium || ""}
                                alt={relation.media.title?.romaji || "Relacion"}
                                showSkeleton={false}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                        )}
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                        <span className="text-[8px] font-black text-brand-orange tracking-[0.18em] uppercase mb-1">{relation.relationType}</span>
                        <h4 className="text-sm font-bold leading-tight line-clamp-2 text-white group-hover:text-brand-orange transition-colors duration-300">{relation.media?.title?.spanish || relation.media?.title?.romaji || relation.media?.title?.english}</h4>
                        <span className="text-[9px] font-black text-white/30 mt-2 tracking-[0.2em] uppercase">{relation.media?.format}</span>
                    </div>
                </div>
            ))}
        </div>
    )
})

// ─── CHARACTERS TAB ────────────────────────────────────────────────────────────

export const CharactersTab = React.memo(function CharactersTab({ characters }: { characters: NonNullable<Models_LibraryMedia["characters"]>["edges"] }) {
    if (!characters || characters.length === 0) {
        return (
            <div className="py-24 text-center">
                <p className="text-zinc-600 font-bebas text-4xl tracking-widest">SIN PERSONAJES</p>
                <p className="text-zinc-700 text-xs font-black uppercase tracking-[0.3em] mt-2">NO HAY PERSONAJES DETECTADOS</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {characters.slice(0, 24).map((char, idx) => (
                <div key={idx} className="flex flex-col items-center text-center gap-3 group cursor-pointer">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-950/40 border-2 border-white/5 group-hover:border-brand-orange/60 group-hover:shadow-[0_0_20px_rgba(255,110,58,0.25)] transition-all duration-500 shadow-xl">
                        {char.node?.image?.large && (
                            <DeferredImage
                                src={char.node.image.large}
                                alt={char.node.name?.full || "Character"}
                                showSkeleton={false}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white group-hover:text-brand-orange uppercase tracking-wider transition-colors duration-300">{char.node?.name?.full}</span>
                        <span className="text-[9px] font-black text-white/35 tracking-[0.15em] uppercase mt-1 group-hover:text-brand-orange/60 transition-colors duration-300">{char.role}</span>
                    </div>
                </div>
            ))}
        </div>
    )
})

// ─── TECHNICAL METADATA TAB ────────────────────────────────────────────────────

export const TechnicalMetadataTab = React.memo(function TechnicalMetadataTab({ localFiles }: { localFiles: Anime_LocalFile[] }) {
    if (!localFiles || localFiles.length === 0) {
        return (
            <div className="py-24 text-center">
                <p className="text-zinc-600 font-bebas text-4xl tracking-widest">SIN DATOS TÉCNICOS</p>
            </div>
        )
    }

    const file = localFiles[0] // Preview the first file
    const tech = file.technicalInfo

    if (!tech) {
         return (
            <div className="py-24 text-center">
                <p className="text-zinc-600 font-bebas text-4xl tracking-widest">ESCANEO PENDIENTE</p>
                <p className="text-zinc-700 text-xs font-black uppercase tracking-[0.3em] mt-2">LOS DATOS TÉCNICOS NO HAN SIDO EXTRAÍDOS AÚN</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Specs - Capsule Corp Terminal Style */}
            <div className="bg-zinc-950/60 backdrop-blur-md border border-brand-orange/10 rounded-2xl p-6 flex flex-col gap-4 hover:border-brand-orange/30 hover:shadow-[0_0_30px_rgba(255,110,58,0.1)] transition-all duration-500">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <MonitorPlay className="w-5 h-5 text-brand-orange animate-pulse" />
                    <h3 className="text-lg font-bebas tracking-[0.15em] text-white uppercase">VIDEO SPECS</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 font-mono">
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Resolución</span>
                        <span className="text-xs font-bold text-white tracking-widest uppercase">{tech.videoStream?.width} <span className="text-zinc-600 font-normal">x</span> {tech.videoStream?.height}</span>
                    </div>
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Códec</span>
                        <span className="text-xs font-bold text-brand-orange tracking-widest uppercase">{tech.videoStream?.codec || "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Color Space</span>
                        <span className="text-xs font-bold text-white tracking-widest uppercase">{tech.videoStream?.colorSpace || "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Frame Rate</span>
                        <span className="text-xs font-bold text-white tracking-widest uppercase">{tech.videoStream?.frameRate || "N/A"} FPS</span>
                    </div>
                </div>
            </div>

            {/* Audio Specs - Capsule Corp Terminal Style */}
            <div className="bg-zinc-950/60 backdrop-blur-md border border-brand-orange/10 rounded-2xl p-6 flex flex-col gap-4 hover:border-brand-orange/30 hover:shadow-[0_0_30px_rgba(255,110,58,0.1)] transition-all duration-500">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <Database className="w-5 h-5 text-brand-orange animate-pulse" />
                    <h3 className="text-lg font-bebas tracking-[0.15em] text-white uppercase">AUDIO & FORMAT</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 font-mono">
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Contenedor</span>
                        <span className="text-xs font-bold text-brand-orange tracking-widest uppercase">{tech.format || "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-1 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Tamaño</span>
                        <span className="text-xs font-bold text-white tracking-widest uppercase">{formatFileSize(tech.size || 0)}</span>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 border border-white/[0.02] bg-black/20 p-3 rounded-xl hover:border-white/5 transition-colors">
                        <span className="text-[8px] font-black text-zinc-500 tracking-[0.15em] uppercase">Pistas de Audio</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {tech.audioStreams && tech.audioStreams.length > 0 ? (
                                tech.audioStreams.map((aud, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-black/40 border border-white/5 hover:border-brand-orange/30 rounded-lg text-[9px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300">
                                        {aud.language ? aud.language.toUpperCase() : "UND"} <span className="text-zinc-600 font-normal">|</span> {aud.codec ? aud.codec.toUpperCase() : "N/A"}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs font-bold text-zinc-600 uppercase">Sin pistas de audio</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})
