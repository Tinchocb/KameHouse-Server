import { memo } from 'react';
import { Play } from 'lucide-react';
import { DeferredImage } from '@/components/shared/deferred-image';
import { cn } from '@/components/ui/core/styling';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';

export interface SeriesItem {
    id: number
    title: string
    eps: number
    year: string | number
    progress: number
    img: string
    poster: string
    desc: string
    seriesId?: string
}

export const getVhsColor = (id: number) => {
    const colors = ['#d96c14', '#b51f1f', '#2980b9', '#1a5c2e', '#1a4a8a', '#8e44ad', '#0e6655'];
    return colors[id % colors.length];
};

// Función para mapear el ID de la serie con su respectivo arte de Goku
const getGokuImagePath = (seriesId?: string) => {
    switch (seriesId) {
        case 'dragon_ball': return '/icons/series-icons/goku-raw-db.png';
        case 'dragon_ball_z': return '/icons/series-icons/goku-raw-dbz.png';
        case 'dragon_ball_gt': return '/icons/series-icons/goku-raw-dbgt.png';
        case 'dragon_ball_super': return '/icons/series-icons/goku-raw-dbs.png';
        case 'dragon_ball_daima': return '/icons/series-icons/goku-raw-daima.png';
        default: return null;
    }
};

export const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    onNavigate,
    onSelect,
    onSound,
}: {
    item: SeriesItem
    isSelected: boolean
    onNavigate: (id: string) => void
    onSelect: (id: number) => void
    onSound?: () => void
}) {
    const spineCfg = getSpineConfig(item.seriesId || "", item.id);
    const gokuImg = getGokuImagePath(item.seriesId);

    return (
        <div
            onClick={() => {
                if (isSelected) {
                    onNavigate(item?.id?.toString() || "");
                } else {
                    onSelect(item.id);
                    onSound?.();
                }
            }}
            onDoubleClick={() => {
                onNavigate(item?.id?.toString() || "");
            }}
            style={{
                flex: isSelected ? '4 0 450px' : '1 1 135px',
                transition: 'flex 700ms cubic-bezier(0.2, 1, 0.2, 1), transform 500ms cubic-bezier(0.2, 1, 0.2, 1)',
                willChange: "flex-grow, transform",
                '--tape-color': getVhsColor(item.id)
            } as React.CSSProperties}
            className={cn(
                "h-full flex flex-col cursor-pointer overflow-hidden relative group/card border-r border-zinc-950/60 select-none",
                !isSelected && "hover:-translate-y-8 hover:z-30 hover:shadow-[0_45px_70px_-15px_rgba(0,0,0,0.95),0_0_30px_rgba(255,110,58,0.15)]"
            )}
        >
            {isSelected ? (
                // --- VISTA EXPANDIDA DE LA CARATULA ---
                <div className="flex-1 flex flex-col min-h-0 w-full relative bg-zinc-950">
                    <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0a0d16] group">
                        <DeferredImage
                            src={item.img || item.poster}
                            alt={item.title}
                            className="absolute inset-0 w-full h-full object-cover transition-all [transition-duration:800ms] cubic-bezier(0.2, 1, 0.2, 1) transform-gpu scale-[1.06] brightness-100 grayscale-0"
                        />

                        {/* Brillo de la caratula de VHS */}
                        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/[0.02] via-transparent to-transparent pointer-events-none z-[2]" />

                        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-85" />

                        {/* Detalles de la tarjeta expandida */}
                        <div className="absolute inset-0 p-6 md:p-12 z-20 flex flex-col justify-end h-full w-full bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-400 ease-out transform-gpu">
                            <div className="glass-panel-strong border border-white/10 p-5 md:p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] bg-slate-950/75 max-w-lg transition-all duration-400 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] transform-gpu opacity-100 translate-y-0 scale-100">
                                {/* Tag */}
                                <div className="flex items-center gap-3 mb-3 select-none transition-all duration-400 ease-out transform-gpu">
                                    <span className="px-2 py-0.5 bg-brand-orange/20 text-brand-orange border border-brand-orange/30 rounded text-[9px] font-black tracking-widest uppercase shadow-[0_0_15px_rgba(255,110,58,0.15)]">
                                        Serie
                                    </span>
                                </div>

                                {/* Titulo */}
                                <h3 className="text-xl md:text-2xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-md line-clamp-2 transition-all duration-400 ease-out transform-gpu">
                                    {item.title}
                                </h3>

                                {/* Descripción */}
                                <p className="text-white/60 text-xs leading-relaxed mb-4 font-medium line-clamp-3 transition-all duration-400 ease-out transform-gpu">
                                    {item.desc}
                                </p>

                                {/* Progreso */}
                                <div className="flex flex-col mb-4 w-full transition-all duration-400 ease-out transform-gpu">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40">
                                            Progreso de visualización
                                        </span>
                                        <span className="text-[10px] font-black text-brand-orange">{item.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <div
                                            className="h-full bg-gradient-to-r from-brand-orange to-[#ff9d5c] rounded-full shadow-[0_0_10px_rgba(255,110,58,0.5)] transition-all duration-1000 ease-out origin-left"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Botón de Reproducir */}
                                <div className="flex gap-4 transition-all duration-400 ease-out transform-gpu">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate(item?.id?.toString() || "");
                                        }}
                                        className="flex-1 bg-brand-orange hover:bg-[#ff8559] active:scale-[0.98] text-white rounded-xl text-xs font-black tracking-widest uppercase py-2.5 transition-all duration-300 hover:-translate-y-0.5 flex justify-center items-center gap-3 shadow-[0_8px_20px_rgba(255,110,58,0.35)] hover:shadow-[0_12px_28px_rgba(255,110,58,0.5)] relative overflow-hidden group/btn"
                                    >
                                        <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                                        <Play className="w-5 h-5 fill-current" />
                                        Reproducir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalle tipo Cassette en la parte inferior */}
                    <div
                        className="relative shrink-0 bg-[#0d0d0d] flex items-center justify-between px-4 shadow-[0_-12px_25px_rgba(0,0,0,0.85),inset_0_3px_5px_rgba(255,255,255,0.06),inset_0_-3px_5px_rgba(0,0,0,0.8)] z-20 h-[100px] w-full min-w-0 select-none overflow-hidden transition-all duration-500 ease-out transform-gpu border-t-2 border-[#ff6e3a]"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:3px_3px] opacity-35 pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none skew-x-12 transform-gpu" />

                        <div className="absolute inset-0 px-4 flex items-center justify-between py-2 z-10 opacity-100 scale-100">
                            <div className="flex items-center gap-4">
                                <div className="relative w-12 h-12 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                                    <div className="w-full h-full flex items-center justify-center animate-spin-slow" style={{ animationDuration: '4s' }}>
                                        <svg className="w-10 h-10 text-zinc-700/60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" />
                                            <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                            <line x1="50" y1="22" x2="50" y2="40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                            <line x1="50" y1="50" x2="25.75" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                            <line x1="50" y1="50" x2="74.25" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="font-mono text-[10px] font-black tracking-widest text-[#ff6e3a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                                        KAME - VHS
                                    </span>
                                </div>
                            </div>
                            <div className="relative w-12 h-12 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                                <div className="w-full h-full flex items-center justify-center animate-spin-slow" style={{ animationDuration: '4s' }}>
                                    <svg className="w-10 h-10 text-zinc-700/60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" />
                                        <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1.5" />
                                        <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                        <line x1="50" y1="22" x2="50" y2="40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                        <line x1="50" y1="50" x2="25.75" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                        <line x1="50" y1="50" x2="74.25" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // --- VISTA COLAPSADA / LOMO DEL VHS CON GOKU INDIVIDUAL ---
                <div
                    className="w-full h-full flex flex-col justify-between items-center py-6 px-3 relative overflow-hidden border-t-2 border-b-[6px] shadow-[inset_0_3px_5px_rgba(255,255,255,0.08),inset_0_-5px_10px_rgba(0,0,0,0.4)]"
                    style={{
                        borderColor: spineCfg.borderColor,
                        background: spineCfg.bg
                    }}
                >
                    {/* Renderizamos la imagen del Goku respectivo con un degradado en la máscara */}
                    {gokuImg && (
                        <>
                            {/* Goku de fondo difuminado (Silueta en la parte superior) */}
                            <div 
                                className="absolute inset-x-0 top-12 h-[55%] w-[160%] -left-[30%] z-0 pointer-events-none transform scale-125"
                                style={{
                                    backgroundImage: `url('${gokuImg}')`,
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center top',
                                    backgroundRepeat: 'no-repeat',
                                    opacity: 0.18,
                                    filter: 'contrast(0.8) brightness(1.1)',
                                }}
                            />
                            {/* Goku nítido en la parte inferior */}
                            <div 
                                className="absolute inset-x-0 bottom-0 h-[50%] z-0 pointer-events-none"
                                style={{
                                    backgroundImage: `url('${gokuImg}')`,
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center bottom',
                                    backgroundRepeat: 'no-repeat',
                                    opacity: 0.95,
                                    // Esto crea el efecto de que el Goku se desvanece suavemente hacia el color de fondo
                                    maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
                                    WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)'
                                }}
                            />
                        </>
                    )}


                    {/* Efecto glossy del envoltorio plastico de la caja */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] via-transparent to-black/[0.6] pointer-events-none z-10" />

                    {/* Cabecera del Lomo: Volúmen y Subtitulo */}
                    <div className="z-20 flex flex-col items-center gap-1.5 mt-2 drop-shadow-lg">
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-[0_3px_6px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(255,255,255,0.4)] border border-white/20"
                            style={{
                                backgroundColor: '#ffd54f', // Amarillo retro DB
                                color: '#1c1917'
                            }}
                        >
                            {spineCfg.vol}
                        </div>
                        <span
                            className="text-[8px] font-black tracking-[0.2em] uppercase opacity-90 drop-shadow-md"
                            style={{ color: spineCfg.accent }}
                        >
                            {spineCfg.subtitle}
                        </span>
                    </div>

                    {/* Medio del Lomo: Titulo Vertical */}
                    <div className="z-20 flex-1 flex items-center justify-center my-4 w-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                        <h3
                            className="text-sm font-extrabold text-center tracking-[0.08em] uppercase select-none w-full max-h-[220px] overflow-hidden truncate px-1"
                            style={{
                                color: spineCfg.text,
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                                textShadow: '2px 2px 6px rgba(0,0,0,0.9), 0px 0px 10px rgba(0,0,0,0.6)'
                            }}
                        >
                            {item.title}
                        </h3>
                    </div>

                    {/* Progress Bar inferior compacto */}
                    <div className="z-30 w-full px-2 shrink-0 mt-auto drop-shadow-md">
                        <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner">
                            <div
                                className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                style={{ width: `${item.progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
