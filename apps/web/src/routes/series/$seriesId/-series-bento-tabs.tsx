import React from "react"
import { Models_LibraryMedia, Anime_LocalFile } from "@/api/generated/types"
import { MonitorPlay, Database } from "lucide-react"

// ─── RELATIONS TAB ─────────────────────────────────────────────────────────────

export const RelationsTab = React.memo(function RelationsTab({ media }: { media?: Models_LibraryMedia }) {
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
                <div key={idx} className="flex gap-4 p-4 bg-zinc-900 border border-white/10 hover:border-white/30 transition-all duration-300 group cursor-pointer">
                    <div className="w-16 h-24 shrink-0 bg-zinc-800 overflow-hidden relative">
                        {relation.node?.posterImage && (
                            <img src={relation.node.posterImage} alt={relation.node.titleRomaji || "Relacion"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        )}
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                        <span className="text-[10px] font-black text-white/50 tracking-widest uppercase mb-1">{relation.relationType}</span>
                        <h4 className="text-sm font-bold leading-tight line-clamp-2 text-white">{relation.node?.titleRomaji || relation.node?.titleEnglish}</h4>
                        <span className="text-xs font-black text-brand-orange mt-2 tracking-widest uppercase">{relation.node?.format}</span>
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
                <div key={idx} className="flex flex-col items-center text-center gap-3 group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border-2 border-white/5 group-hover:border-white/50 transition-all duration-300 shadow-xl">
                        {char.node?.image && (
                            <img src={char.node.image} alt={char.node.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{char.node?.name}</span>
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mt-1">{char.role}</span>
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
            {/* Video Specs */}
            <div className="bg-zinc-900 border border-white/10 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <MonitorPlay className="w-6 h-6 text-white/50" />
                    <h3 className="text-xl font-bebas tracking-widest uppercase">Video</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Resolución</span>
                        <span className="text-sm font-bold uppercase">{tech.videoStream?.width}x{tech.videoStream?.height}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Códec</span>
                        <span className="text-sm font-bold uppercase">{tech.videoStream?.codec}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Color Space</span>
                        <span className="text-sm font-bold uppercase">{tech.videoStream?.colorSpace || "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Frame Rate</span>
                        <span className="text-sm font-bold uppercase">{tech.videoStream?.frameRate || "N/A"}</span>
                    </div>
                </div>
            </div>

            {/* Audio Specs */}
            <div className="bg-zinc-900 border border-white/10 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <Database className="w-6 h-6 text-white/50" />
                    <h3 className="text-xl font-bebas tracking-widest uppercase">Audio & Formato</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Contenedor</span>
                        <span className="text-sm font-bold uppercase">{tech.format}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Tamaño</span>
                        <span className="text-sm font-bold uppercase">{(tech.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">Pistas de Audio</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {tech.audioStreams?.map((aud, i) => (
                                <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider">
                                    {aud.language || "UND"} - {aud.codec}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})
